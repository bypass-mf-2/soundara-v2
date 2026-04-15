"""
Stripe webhook handler for Soundara
Handles payment confirmations, subscription events, and refunds
"""

import stripe
import os
from fastapi import Request, HTTPException, status
from backend.logging_config import log_payment_event, log_security_event, logger

try:
    from backend import db
except ImportError:
    import db

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")


async def handle_stripe_webhook(request: Request):
    """Verify signature and dispatch to the right handler."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        log_security_event(
            event_type="webhook_missing_signature",
            severity="medium",
            ip_address=request.client.host if request.client else None,
            details={"endpoint": "/webhook/stripe"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        log_security_event(
            event_type="webhook_invalid_payload",
            severity="medium",
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        log_security_event(
            event_type="webhook_invalid_signature",
            severity="high",
            ip_address=request.client.host if request.client else None,
            details={"reason": "Possible webhook spoofing attempt"},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    event_type = event["type"]
    logger.info(f"Processing Stripe webhook: {event_type}")

    try:
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(event)
        elif event_type == "customer.subscription.created":
            await handle_subscription_created(event)
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(event)
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(event)
        elif event_type == "charge.refunded":
            await handle_refund(event)
        elif event_type == "payment_intent.payment_failed":
            await handle_payment_failed(event)
        else:
            logger.info(f"Unhandled webhook event type: {event_type}")
    except Exception as e:
        logger.error(f"Error processing webhook {event_type}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook processing failed")

    return {"status": "success"}


async def handle_checkout_completed(event: dict):
    """Add purchased track to user's library."""
    session = event["data"]["object"]
    success_url = session.get("success_url", "")

    import urllib.parse
    parsed = urllib.parse.urlparse(success_url)
    params = urllib.parse.parse_qs(parsed.query)

    user_id = params.get("user", [None])[0]
    track_filename = params.get("track", [None])[0]

    if not user_id or not track_filename:
        logger.error(f"Missing user_id or track_filename in checkout session: {session['id']}")
        return

    # Find the track in main library
    track = next(
        (t for t in db.load_library() if t.get("filename_full") == track_filename),
        None,
    )
    if not track:
        logger.error(f"Track not found: {track_filename}")
        return

    # Check if already owned
    owned = any(t.get("filename_full") == track_filename for t in db.get_user_library(user_id))
    if owned:
        return

    db.add_to_user_library(user_id, track)
    logger.info(f"Track added to library - User: {user_id}, Track: {track['name']}")

    log_payment_event(
        event_type="purchase",
        user_id=user_id,
        amount_cents=session.get("amount_total", 0),
        track_name=track["name"],
        success=True,
        details={"session_id": session["id"], "payment_status": session.get("payment_status")},
    )


async def handle_subscription_created(event: dict):
    """Record a new subscription."""
    subscription = event["data"]["object"]
    user_id = subscription.get("metadata", {}).get("user_id")
    if not user_id:
        logger.error(f"No user_id in subscription metadata: {subscription['id']}")
        return

    plan_nickname = subscription["items"]["data"][0]["price"].get("nickname") or ""
    plan_type = "unlimited" if "unlimited" in plan_nickname.lower() else "limited"

    db.set_subscription(user_id, {
        "plan": plan_type,
        "stripe_subscription_id": subscription["id"],
        "status": subscription["status"],
        "current_period_end": subscription["current_period_end"],
        "tracks_used": 0 if plan_type == "limited" else None,
        "created_at": subscription["created"],
    })

    logger.info(f"Subscription created - User: {user_id}, Plan: {plan_type}")

    log_payment_event(
        event_type="subscription",
        user_id=user_id,
        amount_cents=subscription["items"]["data"][0]["price"]["unit_amount"],
        success=True,
        details={"subscription_id": subscription["id"], "plan": plan_type},
    )


async def handle_subscription_updated(event: dict):
    subscription = event["data"]["object"]
    user_id = subscription.get("metadata", {}).get("user_id")
    if not user_id:
        return

    existing = db.get_subscription(user_id)
    if existing:
        existing["status"] = subscription["status"]
        existing["current_period_end"] = subscription["current_period_end"]
        db.set_subscription(user_id, existing)
        logger.info(f"Subscription updated - User: {user_id}, Status: {subscription['status']}")


async def handle_subscription_deleted(event: dict):
    subscription = event["data"]["object"]
    user_id = subscription.get("metadata", {}).get("user_id")
    if not user_id:
        return

    existing = db.get_subscription(user_id)
    if existing:
        existing["status"] = "canceled"
        db.set_subscription(user_id, existing)
        logger.info(f"Subscription canceled - User: {user_id}")


async def handle_refund(event: dict):
    charge = event["data"]["object"]
    logger.info(f"Refund processed - Amount: {charge['amount_refunded']}")


async def handle_payment_failed(event: dict):
    payment_intent = event["data"]["object"]
    logger.warning(f"Payment failed - ID: {payment_intent['id']}, Error: {payment_intent.get('last_payment_error')}")
    log_payment_event(
        event_type="failed",
        user_id=payment_intent.get("metadata", {}).get("user_id", "unknown"),
        amount_cents=payment_intent["amount"],
        success=False,
        details={"error": payment_intent.get("last_payment_error", {}).get("message")},
    )
