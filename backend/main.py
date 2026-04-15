import numpy as np
import soundfile as sf
import librosa
import shutil
import os
import sys
import yt_dlp
import re
import json
import requests
import stripe
import time
import uuid
import hmac

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, Form, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from datetime import datetime
from pydub import AudioSegment
from fastapi import Query
from dotenv import load_dotenv

# Import payment module
try:
    from backend import payment
    from backend.payment import calculate_price, MIN_PRICE_CENTS
except ImportError:
    import payment
    from payment import calculate_price, MIN_PRICE_CENTS

# Import wave configs
try:
    from backend.gamma import config as gamma
    from backend.alpha import config as alpha
    from backend.beta import config as beta
    from backend.theta import config as theta
    from backend.delta import config as delta
    from backend.schumann_resonance import config as schumann
except ImportError:
    from gamma import config as gamma
    from alpha import config as alpha
    from beta import config as beta
    from theta import config as theta
    from delta import config as delta
    from schumann_resonance import config as schumann

# Import security modules
try:
    from backend.auth import (
        verify_token, 
        get_current_user_id, 
        verify_admin,
        create_access_token,
        hash_password,
        verify_password
    )
    from backend.cyber_prevention import (
        sanitize_filename,
        validate_file_extension,
        validate_file_size,
        validate_audio,
        validate_user_id,
        validate_track_name,
        validate_email,
        validate_youtube_url,
        validate_mode
    )
    from backend.rate_limit import rate_limiter, apply_endpoint_limit
    from backend.logging_config import (
        logger,
        log_security_event,
        log_access,
        log_error,
        log_file_operation,
        log_payment_event,
        security_monitor
    )
    from backend.webhooks import handle_stripe_webhook
except ImportError:
    # Running from backend directory
    from auth import (
        verify_token, 
        get_current_user_id, 
        verify_admin,
        create_access_token,
        hash_password,
        verify_password
    )
    from cyber_prevention import (
        sanitize_filename,
        validate_file_extension,
        validate_file_size,
        validate_audio,
        validate_user_id,
        validate_track_name,
        validate_email,
        validate_youtube_url,
        validate_mode
    )
    from rate_limit import rate_limiter, apply_endpoint_limit
    from logging_config import (
        logger,
        log_security_event,
        log_access,
        log_error,
        log_file_operation,
        log_payment_event,
        security_monitor
    )
    from webhooks import handle_stripe_webhook

# --------------------
# Global files & folders
# --------------------
load_dotenv()

# Determine base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.basename(os.getcwd()) == "backend":
    BASE_DIR = os.path.dirname(os.getcwd())

LIBRARY_FILE = os.path.join(BASE_DIR, "music_library.json")
LIBRARY_FOLDER = os.path.join(BASE_DIR, "music_library")
TRACK_FILE = os.path.join(BASE_DIR, "track_event.json")
USER_LIBRARY_FILE = os.path.join(BASE_DIR, "user_library.json")
PLAYLISTS_FILE = os.path.join(BASE_DIR, "playlists.json")
SUBS_FILE = os.path.join(BASE_DIR, "user_subscriptions.json")
FREE_USERS_FILE = os.path.join(BASE_DIR, "free_users.json")
LOGS_DIR = os.path.join(BASE_DIR, "logs")

# Community / Creator
COMMUNITY_FILE = os.path.join(BASE_DIR, "community_uploads.json")
COMMUNITY_FOLDER = os.path.join(BASE_DIR, "community_library")
CREATOR_ACCOUNTS_FILE = os.path.join(BASE_DIR, "creator_accounts.json")
VALID_GENRES = ["ambient", "electronic", "lo-fi", "classical", "meditation", "nature", "hip-hop", "rock", "pop", "other"]

# Admin
ADMIN_EMAIL = "trevorm.goodwill@gmail.com"
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
MIN_PRICE_CENTS = 170

# SQLite database
DB_FILE = os.environ.get("DB_FILE") or os.path.join(BASE_DIR, "soundara.db")

# Create necessary directories
os.makedirs(LIBRARY_FOLDER, exist_ok=True)
os.makedirs(COMMUNITY_FOLDER, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

# Initialize database (creates schema on first run)
try:
    from backend import db
except ImportError:
    import db
db.init(DB_FILE)

# --------------------
# FastAPI setup
# --------------------
app = FastAPI(title="Soundara API", version="1.0.0")

# Load allowed origins from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://soundara.co").split(",")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["soundara.co", "www.soundara.co", "localhost", "127.0.0.1", "*"]
)

# Load free users (snapshot; call db.load_free_users() if you need a fresh read)
FREE_USERS = db.load_free_users()

# --------------------
# Wave mode configs
# --------------------
WAVE_MODES = {
    "gamma": gamma,
    "alpha": alpha,
    "beta": beta,
    "theta": theta,
    "delta": delta,
    "schumann": schumann,
}

# --------------------
# Middleware
# --------------------

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # HTTPS enforcement in production
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://js.stripe.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.stripe.com;"
    )
    
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting to all requests"""
    start_time = time.time()
    
    try:
        # Check rate limit
        await rate_limiter.check_rate_limit(request)
        
        # Process request
        response = await call_next(request)
        
        # Calculate response time
        process_time = (time.time() - start_time) * 1000
        
        # Log access
        log_access(
            method=request.method,
            endpoint=str(request.url.path),
            ip_address=request.client.host if request.client else None,
            status_code=response.status_code,
            response_time_ms=process_time
        )
        
        return response
        
    except HTTPException as e:
        # Log rate limit exceeded
        log_security_event(
            event_type="rate_limit_exceeded",
            severity="medium",
            ip_address=request.client.host if request.client else None,
            details={
                "endpoint": str(request.url.path),
                "method": request.method
            }
        )
        raise


# --------------------
# DSP / Audio functions
# --------------------

def check_subscription(user_id: str):
    """
    Returns subscription info for a user:
    - None if no active subscription
    - dict with {'type': 'limited' or 'unlimited', 'remaining': int} if active
    """
    return db.get_subscription(user_id)


def make_binaural_from_file(path: str, freq_shift_hz: float):
    data, sr = sf.read(path)
    if data.ndim == 2:
        mono = np.mean(data, axis=1)
    else:
        mono = data
    semitones = 12 * np.log2(1 + freq_shift_hz / sr)
    shifted = librosa.effects.pitch_shift(y=mono, sr=sr, n_steps=semitones)
    min_len = min(len(mono), len(shifted))
    mono = mono[:min_len]
    shifted = shifted[:min_len]
    stereo = np.column_stack([mono, shifted])
    return stereo, sr


def create_preview(full_path, preview_path, seconds=15):
    audio = AudioSegment.from_file(full_path)
    preview = audio[:seconds * 1000]
    preview.export(preview_path, format="wav")


def get_audio_file(track, user_has_paid):
    if track["is_binaural"] and not user_has_paid:
        return track["filename_preview"]
    return track["filename_full"]


def add_to_library(track_name: str, full_path: str, mode: str, custom_freqs=None):
    """
    Stores a processed track in the library folder, generates a preview,
    and saves metadata in LIBRARY_FILE.
    Returns dict with filenames for frontend.
    """
    # Safe track name for filenames
    safe_name = re.sub(r"[^\w\-]", "_", track_name)
    timestamp_str = datetime.now().strftime('%Y%m%d%H%M%S')

    # Preview filename
    preview_filename = f"preview_{safe_name}_{timestamp_str}.wav"
    preview_path = os.path.join(LIBRARY_FOLDER, preview_filename)

    # Generate 7-second preview
    create_preview(full_path, preview_path, seconds=15)

    # Move full file into library folder (if not already there)
    final_full_path = os.path.join(LIBRARY_FOLDER, os.path.basename(full_path))
    if os.path.abspath(full_path) != os.path.abspath(final_full_path):
        shutil.move(full_path, final_full_path)

    # Save entry in library.json
    library_entry = {
        "name": track_name,
        "filename_full": os.path.basename(final_full_path),
        "filename_preview": preview_filename,
        "mode": mode,
        "is_binaural": True,
        "custom_freqs": custom_freqs,
        "size_bytes": os.path.getsize(final_full_path),
        "timestamp": datetime.now().isoformat(),
        "plays": 0
    }
    db.upsert_track(library_entry)

    # Return info needed for frontend immediately
    return {
        "filename_full": os.path.basename(final_full_path),
        "filename_preview": preview_filename,
        "size_bytes": library_entry["size_bytes"],
        "custom_freqs": custom_freqs
    }


def download_youtube_audio(url: str, output_path: str):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'temp_audio.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'ffmpeg_location': os.getenv('FFMPEG_PATH', r'C:\Users\trevo\Downloads\ffmpeg\bin')
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    if os.path.exists('temp_audio.wav'):
        os.rename('temp_audio.wav', output_path)
    else:
        raise RuntimeError("Failed to download YouTube audio.")


# --------------------
# API Endpoints
# --------------------

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Soundara API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# --------------------
# Public demo (no auth)
# --------------------
DEMO_MODES = [
    {"id": "gamma",    "name": "Gamma",    "hz": "30-100 Hz", "icon": "🧠", "desc": "High-level cognitive functioning"},
    {"id": "alpha",    "name": "Alpha",    "hz": "8-12 Hz",   "icon": "✨", "desc": "Relaxed focus & creativity"},
    {"id": "beta",     "name": "Beta",     "hz": "12-30 Hz",  "icon": "⚡", "desc": "Alertness & problem-solving"},
    {"id": "theta",    "name": "Theta",    "hz": "4-8 Hz",    "icon": "🧘", "desc": "Deep meditation & intuition"},
    {"id": "delta",    "name": "Delta",    "hz": "0.5-4 Hz",  "icon": "😴", "desc": "Deep sleep & recovery"},
    {"id": "schumann", "name": "Schumann", "hz": "7.83 Hz",   "icon": "🌍", "desc": "Earth's natural frequency"},
]
DEMO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


@app.get("/demo/list")
async def demo_list():
    """Return metadata for the 6 demo clips. Only includes entries whose file exists."""
    out = []
    for m in DEMO_MODES:
        path = os.path.join(DEMO_DIR, f"demo_{m['id']}.wav")
        if os.path.exists(path):
            out.append({**m, "url": f"/demo/file/demo_{m['id']}.wav"})
    return out


@app.get("/demo/file/{filename}")
async def demo_file(filename: str):
    """Serve a pre-generated demo clip."""
    safe = sanitize_filename(filename)
    if not safe.startswith("demo_") or not safe.endswith(".wav"):
        raise HTTPException(status_code=404, detail="Not found")
    path = os.path.join(DEMO_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="audio/wav", filename=safe)


@app.get("/user_playlists/{user_id}")
async def get_user_playlists(user_id: str):
    """Get user's playlists"""
    user_id = validate_user_id(user_id)
    pls = db.get_playlists(user_id)
    return pls if pls else {"default": []}


@app.post("/user_playlists/{user_id}")
async def save_user_playlists(user_id: str, request: Request):
    """Save user's playlists"""
    user_id = validate_user_id(user_id)
    data = await request.json()
    db.save_playlists(user_id, data)
    return {"status": "ok"}


@app.get("/library/")
async def get_library():
    """Get public library of tracks"""
    return db.load_library()


@app.get("/user_library/{user_id}")
async def get_user_library(user_id: str):
    """Get user's purchased library"""
    user_id = validate_user_id(user_id)
    return db.get_user_library(user_id)


@app.post("/user_library/{user_id}/add")
async def add_to_user_library(user_id: str, request: Request):
    """Add track to user's library"""
    user_id = validate_user_id(user_id)
    data = await request.json()
    db.add_to_user_library(user_id, data)
    return {"status": "ok"}


@app.post("/process/")
async def process_audio(
    request: Request,
    file: UploadFile = File(None),
    youtube_url: str = Form(None),
    track_name: str = Form(...),
    mode: str = Form(...),
    user_freqs: str = Form(None)
):
    """
    Process audio file with binaural beats
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Apply endpoint-specific rate limit
    await apply_endpoint_limit("/process/", client_ip)
    
    # Validate inputs
    track_name = validate_track_name(track_name)
    mode = validate_mode(mode)
    
    tmp_path = None
    
    try:
        # Handle file upload or YouTube URL
        if file:
            # Validate file
            validate_file_extension(file.filename)
            
            # Save uploaded file temporarily
            tmp_path = os.path.join(BASE_DIR, f"temp_{sanitize_filename(file.filename)}")
            with open(tmp_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Validate file size and content
            validate_file_size(tmp_path)
            validate_audio(tmp_path)
            
            log_file_operation(
                operation="upload",
                filename=file.filename,
                file_size_bytes=os.path.getsize(tmp_path),
                success=True
            )
            
        elif youtube_url:
            # Validate YouTube URL
            youtube_url = validate_youtube_url(youtube_url)
            
            tmp_path = os.path.join(BASE_DIR, "temp_youtube.wav")
            try:
                download_youtube_audio(youtube_url, tmp_path)
                validate_audio(tmp_path)
            except Exception as e:
                log_error(
                    error_type="youtube_download_failed",
                    error_message=str(e),
                    endpoint="/process/"
                )
                raise HTTPException(status_code=400, detail=f"YouTube download failed: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="No file or URL provided")

        # Process binaural
        config = WAVE_MODES[mode] if mode in WAVE_MODES else None
        freq = getattr(config, "FIXED_DIFF", config.DEFAULT_DIFF) if config else 0
        output, sr = make_binaural_from_file(tmp_path, freq)

        # Prepare safe filenames
        safe_name = re.sub(r"[^\w\-]", "_", track_name)
        full_filename = f"processed_{safe_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.wav"
        full_path = os.path.join(LIBRARY_FOLDER, full_filename)

        # Save full processed file
        sf.write(full_path, output, sr)

        # Add to library (creates preview automatically)
        stored_files = add_to_library(track_name, full_path, mode, custom_freqs=user_freqs)
        
        log_file_operation(
            operation="process",
            filename=full_filename,
            file_size_bytes=os.path.getsize(full_path),
            success=True
        )

        # Return exact filenames to frontend
        return {
            "status": "success",
            "track": track_name,
            "mode": mode,
            "filename_full": stored_files["filename_full"],
            "filename_preview": stored_files["filename_preview"],
            "size_bytes": os.path.getsize(full_path),
            "custom_freqs": user_freqs or None
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error(
            error_type="processing_error",
            error_message=str(e),
            endpoint="/process/"
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    
    finally:
        # Clean up temporary uploaded or downloaded file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/track_event/")
async def track_event(request: Request):
    """Track user events"""
    data = await request.json()
    data["timestamp"] = datetime.now().isoformat()

    db.append_event(data)

    if data.get("type") == "audio_play" and "track" in data:
        track_name = data["track"]
        library = db.load_library()
        for track in library:
            if track["name"] == track_name:
                db.upsert_track({**track, "plays": track.get("plays", 0) + 1})
                break

    return {"status": "ok"}


@app.post("/create_checkout_session/")
async def create_checkout_session(request: Request):
    """Create Stripe checkout session"""
    data = await request.json()
    
    try:
        logger.info("Checkout request received")

        track = data.get("track")
        user_id = data.get("user_id")
        user_email = data.get("user_email")

        if not track:
            raise HTTPException(status_code=400, detail="Missing track data")

        if not user_id:
            raise HTTPException(status_code=400, detail="User must be logged in")
        
        user_id = validate_user_id(user_id)
        if user_email:
            user_email = validate_email(user_email)

        # Free user bypass
        if user_email in FREE_USERS:
            logger.info(f"Free user detected: {user_email}")

            db.add_to_user_library(user_id, track)

            return {
                "url": None,
                "message": "Free user, track added to library",
                "track": track["name"]
            }

        # Paid checkout flow
        filename = track.get("filename_full") or track.get("filename") or track.get("file_full")
        if not filename:
            raise HTTPException(status_code=400, detail="Missing filename in track data")
        
        track_file_path = os.path.join(LIBRARY_FOLDER, filename)

        if not os.path.exists(track_file_path):
            raise HTTPException(status_code=400, detail="Track file not found")

        file_size_bytes = os.path.getsize(track_file_path)
        custom_mode = track.get("mode") not in WAVE_MODES
        price_cents = payment.calculate_price(file_size_bytes, custom_mode=custom_mode)

        logger.info(f"Calculated price (cents): {price_cents}")

        base_url = "https://soundara.co" if os.getenv("ENVIRONMENT") == "production" else "http://localhost:5173"

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": track["name"]
                    },
                    "unit_amount": price_cents
                },
                "quantity": 1
            }],
            mode="payment",
            success_url=f"{base_url}/success?user={user_id}&track={filename}",
            cancel_url=f"{base_url}/",
            metadata={
                "user_id": user_id,
                "track_name": track["name"]
            }
        )

        return {"url": session.url}

    except HTTPException:
        raise
    except Exception as e:
        log_error(
            error_type="checkout_session_error",
            error_message=str(e),
            user_id=data.get("user_id"),
            endpoint="/create_checkout_session/"
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create_subscription_session/")
async def create_subscription_session(request: Request):
    """Create subscription checkout session"""
    data = await request.json()
    
    user_id = data.get("user_id")
    plan = data.get("plan")

    if not user_id or not plan:
        raise HTTPException(status_code=400, detail="Missing user_id or plan")
    
    user_id = validate_user_id(user_id)

    # Current plan names: "pro" / "pro_annual" / "creator" / "creator_annual"
    # Legacy names ("limited" / "unlimited") kept for backward-compat.
    PRICE_IDS = {
        "pro":             os.getenv("STRIPE_PRICE_PRO",             os.getenv("STRIPE_PRICE_LIMITED", "price_missing_pro")),
        "pro_annual":      os.getenv("STRIPE_PRICE_PRO_ANNUAL",      "price_missing_pro_annual"),
        "creator":         os.getenv("STRIPE_PRICE_CREATOR",         os.getenv("STRIPE_PRICE_UNLIMITED", "price_missing_creator")),
        "creator_annual":  os.getenv("STRIPE_PRICE_CREATOR_ANNUAL",  "price_missing_creator_annual"),
        "limited":         os.getenv("STRIPE_PRICE_LIMITED",         "price_missing_pro"),
        "unlimited":       os.getenv("STRIPE_PRICE_UNLIMITED",       "price_missing_creator"),
    }

    if plan not in PRICE_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan}")

    try:
        base_url = "https://soundara.co" if os.getenv("ENVIRONMENT") == "production" else "http://localhost:5173"

        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": PRICE_IDS[plan],
                "quantity": 1
            }],
            subscription_data={
                "trial_period_days": 3,
                "metadata": {
                    "user_id": user_id,
                    "plan": plan,
                },
            },
            success_url=f"{base_url}/success?user={user_id}&subscription={plan}",
            cancel_url=f"{base_url}/pricing",
            metadata={
                "user_id": user_id,
                "plan": plan
            }
        )
        return {"url": session.url}
    except Exception as e:
        log_error(
            error_type="subscription_session_error",
            error_message=str(e),
            user_id=user_id,
            endpoint="/create_subscription_session/"
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/user_subscriptions/{user_id}/add")
async def add_subscription(user_id: str, request: Request):
    """Add/update user subscription"""
    user_id = validate_user_id(user_id)
    
    data = await request.json()
    db.set_subscription(user_id, data)
    return {"status": "ok"}


@app.get("/play/{track_name}")
async def play_track(track_name: str, user_id: str):
    """Play a track"""
    track_name = validate_track_name(track_name)
    user_id = validate_user_id(user_id)
    
    library = db.load_library()
    user_tracks = db.get_user_library(user_id)
    user_sub = db.get_subscription(user_id)

    track = next((t for t in library if t["name"] == track_name), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    has_paid = any(t.get("name") == track_name for t in user_tracks)
    is_subscribed = False

    if user_sub:
        plan = user_sub["plan"]
        # Current plans (pro, creator, and their annual variants) get unlimited playback.
        # "unlimited" is the legacy name for creator; grandfathered in.
        if plan in ("pro", "pro_annual", "creator", "creator_annual", "unlimited"):
            is_subscribed = True
        elif plan == "limited" and user_sub["tracks_used"] < 20:
            # Legacy limited plan — keep the 20-track cap for grandfathered users
            is_subscribed = True
            user_sub["tracks_used"] += 1
            db.set_subscription(user_id, user_sub)

    filename = get_audio_file(track, has_paid or is_subscribed)
    path = os.path.join(LIBRARY_FOLDER, filename)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path, media_type="audio/wav", filename=filename)


@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook endpoint"""
    return await handle_stripe_webhook(request)


# --------------------
# Admin authentication
# --------------------
def _require_admin(request: Request):
    """Constant-time check of the X-Admin-Token header against the env token."""
    if not ADMIN_API_TOKEN:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    provided = request.headers.get("x-admin-token", "")
    if not hmac.compare_digest(provided, ADMIN_API_TOKEN):
        raise HTTPException(status_code=403, detail="Not authorized")


@app.get("/admin/stats")
async def get_admin_stats(request: Request):
    """Get full platform statistics (admin only)."""
    _require_admin(request)
    try:
        library = db.load_library()
        user_library = db.load_user_library_all()
        events = db.load_events()
        subs = db.get_subscriptions_all()

        total_plays = sum(track.get("plays", 0) for track in library)

        event_types = {}
        unique_visitors = set()
        daily_events = {}
        for ev in events:
            t = ev.get("type", "unknown")
            event_types[t] = event_types.get(t, 0) + 1
            if ev.get("id") or ev.get("user"):
                unique_visitors.add(ev.get("id") or ev.get("user"))
            date = ev.get("timestamp", "")[:10]
            if date:
                daily_events[date] = daily_events.get(date, 0) + 1

        recent_events = events[-50:][::-1]

        community_tracks = db.load_community()
        pending_uploads = [t for t in community_tracks if t.get("status") == "pending"]

        return {
            "total_tracks": len(library),
            "total_users": len(user_library),
            "total_plays": total_plays,
            "total_events": len(events),
            "unique_visitors": len(unique_visitors),
            "active_subscriptions": len(subs),
            "event_breakdown": event_types,
            "daily_events": daily_events,
            "recent_events": recent_events,
            "pending_uploads": pending_uploads,
            "library": library,
            "subscriptions": subs,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------
# Community uploads
# --------------------
@app.post("/community/upload/")
async def community_upload(
    request: Request,
    file: UploadFile = File(...),
    track_name: str = Form(...),
    artist_name: str = Form(...),
    genre: str = Form(...),
    description: str = Form(""),
    user_id: str = Form(...),
):
    """Upload original content for community sharing (pending moderation)."""
    track_name = validate_track_name(track_name)
    user_id = validate_user_id(user_id)
    genre = genre.lower().strip()
    if genre not in VALID_GENRES:
        raise HTTPException(status_code=400, detail=f"Invalid genre. Must be one of: {', '.join(VALID_GENRES)}")
    description = description[:500].strip()

    validate_file_extension(file.filename)
    tmp_path = os.path.join(
        BASE_DIR,
        f"temp_community_{uuid.uuid4().hex}_{sanitize_filename(file.filename)}",
    )
    try:
        with open(tmp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        validate_file_size(tmp_path)
        validate_audio(tmp_path)

        track_id = str(uuid.uuid4())
        safe_name = re.sub(r"[^\w\-]", "_", track_name)
        timestamp_str = datetime.now().strftime('%Y%m%d%H%M%S')
        community_filename = f"community_{safe_name}_{timestamp_str}.wav"
        community_path = os.path.join(COMMUNITY_FOLDER, community_filename)

        data, sr = sf.read(tmp_path)
        sf.write(community_path, data, sr)

        preview_filename = f"community_preview_{safe_name}_{timestamp_str}.wav"
        preview_path = os.path.join(COMMUNITY_FOLDER, preview_filename)
        create_preview(community_path, preview_path, seconds=15)

        entry = {
            "id": track_id,
            "name": track_name,
            "artist": artist_name[:100],
            "artist_id": user_id,
            "genre": genre,
            "description": description,
            "filename": community_filename,
            "filename_preview": preview_filename,
            "size_bytes": os.path.getsize(community_path),
            "timestamp": datetime.now().isoformat(),
            "plays": 0,
            "status": "pending",
            "is_binaural": False,
        }
        db.add_community_upload(entry)

        return {"status": "success", "track_id": track_id, "message": "Track uploaded and pending review"}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/community/")
async def get_community_tracks():
    """List approved community tracks."""
    return [t for t in db.load_community() if t.get("status") == "approved"]


@app.get("/community/all/{user_id}")
async def get_user_community_tracks(user_id: str):
    """Get all tracks uploaded by a specific user (any status)."""
    user_id = validate_user_id(user_id)
    return [t for t in db.load_community() if t.get("artist_id") == user_id]


@app.get("/community/file/{filename}")
async def serve_community_file(filename: str):
    """Serve a community audio file."""
    safe = sanitize_filename(filename)
    path = os.path.join(COMMUNITY_FOLDER, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/wav", filename=safe)


@app.post("/community/moderate/{track_id}")
async def moderate_community_track(track_id: str, request: Request):
    """Admin approve/reject community track."""
    _require_admin(request)
    body = await request.json()
    action = body.get("action", "").lower()
    if action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Action must be 'approved' or 'rejected'")

    if not db.set_community_status(track_id, action):
        raise HTTPException(status_code=404, detail="Track not found")

    return {"status": "success", "track_id": track_id, "action": action}


# --------------------
# Creator (Stripe Connect)
# --------------------
@app.post("/creator/onboard")
async def creator_onboard(request: Request):
    """Create a Stripe Connect Express account and onboarding link."""
    body = await request.json()
    user_id = validate_user_id(body.get("user_id", ""))
    user_email = body.get("email", "")

    try:
        account = stripe.Account.create(
            type="express",
            email=user_email,
            capabilities={"transfers": {"requested": True}},
        )

        db.set_creator_account(user_id, {
            "stripe_account_id": account.id,
            "onboarded": False,
            "name": body.get("name", ""),
            "email": user_email,
        })

        base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{base_url}/creator",
            return_url=f"{base_url}/creator",
            type="account_onboarding",
        )
        return {"status": "success", "url": account_link.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/creator/onboard/status/{user_id}")
async def creator_onboard_status(user_id: str):
    """Check if creator has completed Stripe Connect onboarding."""
    user_id = validate_user_id(user_id)
    acct = db.get_creator_account(user_id)
    if not acct:
        return {"onboarded": False, "has_account": False}

    account_id = acct["stripe_account_id"]
    try:
        account = stripe.Account.retrieve(account_id)
        is_onboarded = account.charges_enabled or account.details_submitted
        acct["onboarded"] = is_onboarded
        db.set_creator_account(user_id, acct)
        return {"onboarded": is_onboarded, "has_account": True}
    except stripe.error.StripeError:
        return {"onboarded": False, "has_account": True}


@app.get("/creator/dashboard/{user_id}")
async def creator_dashboard(user_id: str):
    """Get creator dashboard: uploaded tracks, plays, and Stripe balance."""
    user_id = validate_user_id(user_id)

    my_tracks = [t for t in db.load_community() if t.get("artist_id") == user_id]
    total_plays = sum(t.get("plays", 0) for t in my_tracks)

    balance_available = 0
    balance_pending = 0
    acct = db.get_creator_account(user_id)
    if acct and acct.get("onboarded"):
        try:
            balance = stripe.Balance.retrieve(stripe_account=acct["stripe_account_id"])
            for b in balance.available:
                balance_available += b.amount
            for b in balance.pending:
                balance_pending += b.amount
        except stripe.error.StripeError:
            pass

    return {
        "tracks": my_tracks,
        "total_plays": total_plays,
        "balance_available_cents": balance_available,
        "balance_pending_cents": balance_pending,
    }


@app.post("/create_community_checkout/")
async def create_community_checkout(request: Request):
    """Stripe checkout for a community track with a 70/30 split to the creator."""
    body = await request.json()
    track_id = body.get("track_id", "")
    user_id = validate_user_id(body.get("user_id", ""))

    track = next((t for t in db.load_community() if t["id"] == track_id and t["status"] == "approved"), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found or not approved")

    price_cents = calculate_price(track["size_bytes"])

    creator_id = track["artist_id"]
    acct = db.get_creator_account(creator_id)
    if not acct or not acct.get("onboarded"):
        raise HTTPException(status_code=400, detail="Creator has not completed payment setup")

    creator_stripe_id = acct["stripe_account_id"]
    application_fee = int(price_cents * 0.30)

    base_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{track['name']} by {track['artist']}"},
                    "unit_amount": price_cents,
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{base_url}/success?track_id={track_id}&user={user_id}",
            cancel_url=f"{base_url}/tools",
            payment_intent_data={
                "application_fee_amount": application_fee,
                "transfer_data": {"destination": creator_stripe_id},
            },
            metadata={
                "user_id": user_id,
                "track_id": track_id,
                "type": "community_purchase",
            },
        )
        return {"url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --------------------
# Community search
# --------------------
@app.get("/community/search")
async def community_search(q: str = "", genre: str = "", limit: int = 50):
    """Search community tracks by free-text query and/or genre."""
    results = [t for t in db.load_community() if t.get("status") == "approved"]
    if genre:
        results = [t for t in results if t.get("genre", "").lower() == genre.lower()]
    if q:
        ql = q.lower()
        results = [
            t for t in results
            if ql in (t.get("name", "") or "").lower()
            or ql in (t.get("artist", "") or "").lower()
            or ql in (t.get("description", "") or "").lower()
        ]
    return results[:max(1, min(limit, 200))]


# --------------------
# Favorites
# --------------------
@app.post("/favorites/toggle")
async def favorites_toggle(request: Request):
    body = await request.json()
    user_id = validate_user_id(body.get("user_id", ""))
    track_id = body.get("track_id", "")
    kind = body.get("kind", "")
    if kind not in ("community", "library"):
        raise HTTPException(status_code=400, detail="kind must be 'community' or 'library'")
    if not track_id:
        raise HTTPException(status_code=400, detail="track_id required")
    now_favorited = db.toggle_favorite(user_id, track_id, kind)
    count = db.favorite_count(track_id, kind)
    return {"favorited": now_favorited, "count": count}


@app.get("/favorites/{user_id}")
async def favorites_list(user_id: str):
    user_id = validate_user_id(user_id)
    favs = db.list_user_favorites(user_id)

    community = db.load_community()
    community_by_id = {t["id"]: t for t in community}
    library = db.load_library()
    library_by_id = {t.get("filename_full"): t for t in library}

    hydrated = []
    for f in favs:
        if f["kind"] == "community":
            t = community_by_id.get(f["track_id"])
        else:
            t = library_by_id.get(f["track_id"])
        if t:
            hydrated.append({**t, "kind": f["kind"], "favorited_at": f["added_at"]})
    return hydrated


@app.get("/favorites/ids/{user_id}/{kind}")
async def favorites_ids(user_id: str, kind: str):
    """Fast membership lookup so the frontend can render filled/empty hearts."""
    user_id = validate_user_id(user_id)
    if kind not in ("community", "library"):
        raise HTTPException(status_code=400, detail="kind must be 'community' or 'library'")
    return list(db.user_favorite_ids(user_id, kind))


# --------------------
# Artist profile + follows
# --------------------
@app.get("/artist/{user_id}")
async def artist_profile(user_id: str, viewer_id: str | None = None):
    user_id = validate_user_id(user_id)
    profile = db.get_profile(user_id) or {"user_id": user_id, "display_name": None, "bio": None, "picture": None}
    tracks = [t for t in db.load_community() if t.get("artist_id") == user_id and t.get("status") == "approved"]
    return {
        "profile": profile,
        "tracks": tracks,
        "follower_count": db.follower_count(user_id),
        "is_following": db.is_following(viewer_id, user_id) if viewer_id else False,
    }


@app.put("/artist/{user_id}")
async def update_artist_profile(user_id: str, request: Request):
    user_id = validate_user_id(user_id)
    body = await request.json()
    viewer_id = body.get("viewer_id")
    if viewer_id != user_id:
        raise HTTPException(status_code=403, detail="Can only edit your own profile")
    db.upsert_profile(
        user_id,
        display_name=(body.get("display_name") or None),
        bio=(body.get("bio") or None),
        picture=(body.get("picture") or None),
    )
    return {"status": "ok"}


@app.post("/artist/{user_id}/follow")
async def follow_artist(user_id: str, request: Request):
    user_id = validate_user_id(user_id)
    body = await request.json()
    follower_id = validate_user_id(body.get("follower_id", ""))
    if follower_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    following = db.toggle_follow(follower_id, user_id)
    return {"following": following, "follower_count": db.follower_count(user_id)}


# --------------------
# Feedback loop
# --------------------
@app.post("/feedback")
async def submit_feedback(request: Request):
    body = await request.json()
    user_id = validate_user_id(body.get("user_id", ""))
    track_id = body.get("track_id", "")
    mode = body.get("mode", "")
    rating = int(body.get("rating", 0))
    session_minutes = int(body.get("session_minutes", 0))
    if rating not in (-1, 0, 1):
        raise HTTPException(status_code=400, detail="rating must be -1, 0, or 1")
    db.add_feedback(user_id, track_id, mode, rating, session_minutes)
    return {"status": "ok"}


@app.get("/feedback/aggregate")
async def feedback_stats():
    """Public aggregate. Powers marketing claims like '97% of Alpha listeners...'"""
    return db.feedback_aggregate()


# --------------------
# Spotify proxy (track name autocomplete)
# --------------------
_SPOTIFY_TOKEN_CACHE = {"token": None, "expires_at": 0}


def _spotify_token() -> str | None:
    import base64
    import time as _time
    cid = os.getenv("SPOTIFY_CLIENT_ID")
    secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not cid or not secret:
        return None
    now = _time.time()
    if _SPOTIFY_TOKEN_CACHE["token"] and _SPOTIFY_TOKEN_CACHE["expires_at"] > now + 10:
        return _SPOTIFY_TOKEN_CACHE["token"]
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    _SPOTIFY_TOKEN_CACHE["token"] = data["access_token"]
    _SPOTIFY_TOKEN_CACHE["expires_at"] = now + data.get("expires_in", 3600)
    return _SPOTIFY_TOKEN_CACHE["token"]


@app.get("/spotify/search")
async def spotify_search(q: str, limit: int = 6):
    """Lightweight Spotify track search for autocomplete. Returns [] if not configured."""
    token = _spotify_token()
    if not token or not q:
        return []
    try:
        resp = requests.get(
            "https://api.spotify.com/v1/search",
            headers={"Authorization": f"Bearer {token}"},
            params={"q": q, "type": "track", "limit": max(1, min(limit, 10))},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        items = resp.json().get("tracks", {}).get("items", [])
        return [
            {
                "id": t.get("id"),
                "name": t.get("name"),
                "artist": ", ".join(a.get("name", "") for a in (t.get("artists") or [])),
                "album": (t.get("album") or {}).get("name"),
                "image": ((t.get("album") or {}).get("images") or [{}])[-1].get("url"),
                "preview_url": t.get("preview_url"),
            }
            for t in items
            if t
        ]
    except Exception:
        return []


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
