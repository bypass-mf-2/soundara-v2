"""
One-time setup: create the two Stripe coupons used by Soundara.

Both coupons are `duration: once` — they discount the first invoice
after the 3-day trial, then the subscription reverts to list price.

Run from the repo root (with the same env that the app uses):

    python backend/create_coupons.py

Safe to re-run: Stripe rejects duplicate coupon IDs and we catch that.
"""

import os
import sys

import stripe


COUPONS = [
    {
        "id": "LAUNCH50",
        "name": "Launch Email — 50% off first month",
        "percent_off": 50,
        "duration": "once",
    },
    {
        "id": "REFER33",
        "name": "Referral — 33% off first month",
        "percent_off": 33,
        "duration": "once",
    },
]


def main() -> int:
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        print("ERROR: STRIPE_SECRET_KEY is not set in the environment.", file=sys.stderr)
        return 1
    stripe.api_key = key

    for spec in COUPONS:
        try:
            c = stripe.Coupon.create(**spec)
            print(f"created coupon {c.id} ({c.percent_off}% off, duration={c.duration})")
        except stripe.error.InvalidRequestError as e:
            msg = str(e)
            if "already exists" in msg:
                print(f"coupon {spec['id']} already exists — skipping")
            else:
                print(f"ERROR creating {spec['id']}: {msg}", file=sys.stderr)
                return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
