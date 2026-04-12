# Soundara Implementation Roadmap & Security Enhancements

## Current Status Analysis

### Existing Security Measures
- Basic filename sanitization
- File extension validation (wav, mp3, flac, ogg)
- File size limits (50MB max)
- Basic audio validation
- CORS protection (localhost:5173, soundara.co)

### Security Vulnerabilities Identified
1. ❌ No rate limiting on endpoints
2. ❌ No JWT/session authentication
3. ❌ Hardcoded FFmpeg path (Windows-specific)
4. ❌ No input validation on user_id, track_name parameters
5. ❌ Stripe webhooks not implemented (subscription verification)
6. ❌ No HTTPS enforcement
7. ❌ Direct file access without proper authorization checks
8. ❌ No request size limits
9. ❌ SQL injection risk (currently using JSON files, but future DB migration vulnerable)
10. ❌ No content security policy headers
11. ❌ Secrets in codebase (need proper env management)
12. ❌ No logging/monitoring for suspicious activity

---

## 🔒 PHASE 0: CRITICAL SECURITY ENHANCEMENTS (PRIORITY)

### 0.1 Authentication & Authorization System
**Timeline: Week 1-2**

#### Implementation:
```python
# New file: backend/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
import os

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload.get("sub")
```

#### Updated Dependencies:
```txt
# Add to requirements.txt
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
```

#### Protected Endpoint Example:
```python
@app.post("/process/")
async def process_audio(
    user_id: str = Depends(verify_token),
    file: UploadFile = File(...),
    ...
):
    # Now protected with JWT verification
```

### 0.2 Rate Limiting & DDoS Protection
**Timeline: Week 2**

```python
# New file: backend/middleware/rate_limit.py
from fastapi import Request, HTTPException
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

class RateLimiter:
    def __init__(self, requests_per_minute: int = 60, requests_per_hour: int = 500):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.minute_tracker = defaultdict(list)
        self.hour_tracker = defaultdict(list)
    
    async def check_rate_limit(self, request: Request):
        client_ip = request.client.host
        now = datetime.now()
        
        # Clean old entries
        self.minute_tracker[client_ip] = [
            t for t in self.minute_tracker[client_ip] 
            if now - t < timedelta(minutes=1)
        ]
        self.hour_tracker[client_ip] = [
            t for t in self.hour_tracker[client_ip] 
            if now - t < timedelta(hours=1)
        ]
        
        # Check limits
        if len(self.minute_tracker[client_ip]) >= self.requests_per_minute:
            raise HTTPException(status_code=429, detail="Rate limit exceeded (per minute)")
        if len(self.hour_tracker[client_ip]) >= self.requests_per_hour:
            raise HTTPException(status_code=429, detail="Rate limit exceeded (per hour)")
        
        # Record request
        self.minute_tracker[client_ip].append(now)
        self.hour_tracker[client_ip].append(now)

rate_limiter = RateLimiter()

# Apply to app
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    await rate_limiter.check_rate_limit(request)
    return await call_next(request)
```

### 0.3 Enhanced Input Validation
**Timeline: Week 2**

```python
# Update: backend/cyber_prevention.py
import re
from typing import Optional
from fastapi import HTTPException

# Comprehensive validation functions
def validate_user_id(user_id: str) -> str:
    """Validate user_id format (alphanumeric, max 100 chars)"""
    if not re.match(r'^[a-zA-Z0-9_-]{1,100}$', user_id):
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    return user_id

def validate_track_name(track_name: str) -> str:
    """Validate track name (alphanumeric + spaces, max 200 chars)"""
    if not re.match(r'^[a-zA-Z0-9\s_-]{1,200}$', track_name):
        raise HTTPException(status_code=400, detail="Invalid track_name format")
    return track_name

def validate_email(email: str) -> str:
    """Basic email validation"""
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    return email.lower()

def validate_youtube_url(url: str) -> str:
    """Validate YouTube URL format"""
    youtube_regex = r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$'
    if not re.match(youtube_regex, url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    return url

def sanitize_path(filepath: str) -> str:
    """Prevent path traversal attacks"""
    if '..' in filepath or filepath.startswith('/'):
        raise HTTPException(status_code=400, detail="Invalid file path")
    return filepath

# Enhanced file validation
def validate_audio_content(filepath: str) -> bool:
    """Deep validation of audio file content"""
    try:
        import soundfile as sf
        data, samplerate = sf.read(filepath)
        
        # Check for suspicious characteristics
        if samplerate < 8000 or samplerate > 192000:
            raise ValueError("Suspicious sample rate")
        if len(data) == 0:
            raise ValueError("Empty audio file")
        
        return True
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid audio file: {str(e)}")
```

### 0.4 Stripe Webhook Integration
**Timeline: Week 2-3**

```python
# New file: backend/webhooks.py
import stripe
from fastapi import Request, HTTPException
import os
import json

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("client_reference_id")
        
        # Add track to user's library
        # (Implement proper logic here)
        
    elif event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        # Handle subscription creation
        
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        # Handle subscription cancellation
        
    return {"status": "success"}
```

### 0.5 Security Headers & HTTPS Enforcement
**Timeline: Week 3**

```python
# Add to main.py
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

# HTTPS redirect (only in production)
if os.getenv("ENVIRONMENT") == "production":
    app.add_middleware(HTTPSRedirectMiddleware)

# Trusted hosts
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["soundara.co", "www.soundara.co", "localhost"]
)

# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline';"
    return response
```

### 0.6 Logging & Monitoring
**Timeline: Week 3**

```python
# New file: backend/logging_config.py
import logging
from datetime import datetime
import json

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.FileHandler('logs/security.log')
    ]
)

logger = logging.getLogger(__name__)
security_logger = logging.getLogger('security')

def log_suspicious_activity(event_type: str, user_id: str, details: dict):
    """Log potential security threats"""
    security_logger.warning(json.dumps({
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "user_id": user_id,
        "details": details
    }))

# Example usage in endpoints:
@app.post("/process/")
async def process_audio(...):
    try:
        logger.info(f"Processing request from user {user_id}")
        # ... processing logic
    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        log_suspicious_activity("processing_error", user_id, {"error": str(e)})
```

### 0.7 Environment Variables Management
**Timeline: Week 1**

```bash
# .env.example
JWT_SECRET_KEY=your-secret-key-here-use-secrets-generator
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://user:pass@localhost/soundara
REDIS_URL=redis://localhost:6379
ENVIRONMENT=production
ALLOWED_ORIGINS=https://soundara.co,https://www.soundara.co
MAX_FILE_SIZE_MB=50
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=500
```

---

## 🚀 PHASE 1: V1 FEATURES

### 1.1 Custom Frequencies
**Timeline: Week 4-5**

#### Backend Changes:
```python
# Add to main.py
@app.post("/process_custom/")
async def process_custom_frequencies(
    user_id: str = Depends(verify_token),
    file: UploadFile = File(None),
    youtube_url: str = Form(None),
    track_name: str = Form(...),
    left_freq: float = Form(...),
    right_freq: float = Form(...),
):
    # Validate custom frequency ranges (1-100 Hz is safe for binaural)
    if not (0.5 <= left_freq <= 100) or not (0.5 <= right_freq <= 100):
        raise HTTPException(status_code=400, detail="Frequencies must be between 0.5-100 Hz")
    
    # Calculate price multiplier for custom frequencies
    custom_multiplier = 1.5  # 50% premium for custom
    
    # Process with custom frequencies
    # ... implementation
```

#### Frontend Component:
```jsx
// New file: frontend/src/components/CustomFrequencyForm.jsx
import React, { useState } from 'react';

export default function CustomFrequencyForm({ onSubmit }) {
  const [leftFreq, setLeftFreq] = useState(10);
  const [rightFreq, setRightFreq] = useState(14);
  
  return (
    <div className="custom-freq-form">
      <h3>Custom Frequency Processing</h3>
      <p className="premium-badge">Premium Feature - 1.5x price</p>
      
      <div className="freq-controls">
        <div>
          <label>Left Ear Frequency (Hz)</label>
          <input 
            type="range" 
            min="0.5" 
            max="100" 
            step="0.1"
            value={leftFreq}
            onChange={(e) => setLeftFreq(e.target.value)}
          />
          <span>{leftFreq} Hz</span>
        </div>
        
        <div>
          <label>Right Ear Frequency (Hz)</label>
          <input 
            type="range" 
            min="0.5" 
            max="100" 
            step="0.1"
            value={rightFreq}
            onChange={(e) => setRightFreq(e.target.value)}
          />
          <span>{rightFreq} Hz</span>
        </div>
        
        <div className="binaural-diff">
          <strong>Binaural Beat: {Math.abs(rightFreq - leftFreq).toFixed(1)} Hz</strong>
        </div>
      </div>
      
      <button onClick={() => onSubmit(leftFreq, rightFreq)}>
        Process with Custom Frequencies
      </button>
    </div>
  );
}
```

### 1.2 Mode-Specific Playlists (Focus, Sleep, etc.)
**Timeline: Week 5-6**

#### Backend:
```python
# New file: backend/playlists/curated.py
CURATED_PLAYLISTS = {
    "focus": {
        "name": "Focus Mode",
        "description": "Beta waves (13-30 Hz) for concentration and productivity",
        "modes": ["beta"],
        "recommended_duration": "25-50 minutes",
        "tracks": []  # Auto-populated with beta tracks
    },
    "sleep": {
        "name": "Sleep Mode",
        "description": "Delta waves (0.5-4 Hz) for deep sleep",
        "modes": ["delta", "theta"],
        "recommended_duration": "45-90 minutes",
        "tracks": []
    },
    "meditation": {
        "name": "Meditation Mode",
        "description": "Alpha and theta waves for deep meditation",
        "modes": ["alpha", "theta"],
        "recommended_duration": "15-30 minutes",
        "tracks": []
    },
    "creative": {
        "name": "Creative Flow",
        "description": "Alpha waves (8-13 Hz) for creative thinking",
        "modes": ["alpha"],
        "recommended_duration": "20-40 minutes",
        "tracks": []
    },
    "energy": {
        "name": "Energy Boost",
        "description": "High beta and gamma for alertness",
        "modes": ["beta", "gamma"],
        "recommended_duration": "10-20 minutes",
        "tracks": []
    }
}

@app.get("/playlists/curated")
def get_curated_playlists():
    """Return curated playlists with auto-populated tracks"""
    with open(LIBRARY_FILE, "r") as f:
        library = json.load(f)
    
    result = {}
    for key, playlist in CURATED_PLAYLISTS.items():
        playlist_copy = playlist.copy()
        # Filter tracks by mode
        playlist_copy["tracks"] = [
            track for track in library 
            if track["mode"] in playlist["modes"]
        ][:10]  # Limit to 10 tracks
        result[key] = playlist_copy
    
    return result
```

#### Frontend Component:
```jsx
// New file: frontend/src/pages/ModePlaylists.jsx
import React, { useEffect, useState } from 'react';

export default function ModePlaylists() {
  const [playlists, setPlaylists] = useState({});
  const [selectedMode, setSelectedMode] = useState(null);
  
  useEffect(() => {
    fetch('http://localhost:8000/playlists/curated')
      .then(res => res.json())
      .then(data => setPlaylists(data));
  }, []);
  
  const modeIcons = {
    focus: '🎯',
    sleep: '😴',
    meditation: '🧘',
    creative: '🎨',
    energy: '⚡'
  };
  
  return (
    <div className="mode-playlists">
      <h2>Mode Playlists</h2>
      <p>Curated playlists optimized for specific mental states</p>
      
      <div className="playlist-grid">
        {Object.entries(playlists).map(([key, playlist]) => (
          <div 
            key={key} 
            className="playlist-card"
            onClick={() => setSelectedMode(key)}
          >
            <div className="playlist-icon">{modeIcons[key]}</div>
            <h3>{playlist.name}</h3>
            <p>{playlist.description}</p>
            <div className="playlist-stats">
              <span>{playlist.tracks.length} tracks</span>
              <span>{playlist.recommended_duration}</span>
            </div>
          </div>
        ))}
      </div>
      
      {selectedMode && (
        <PlaylistView 
          playlist={playlists[selectedMode]} 
          onClose={() => setSelectedMode(null)}
        />
      )}
    </div>
  );
}
```

---

## 🎨 PHASE 2: V2 FEATURES

### 2.1 Search Database
**Timeline: Week 7-8**

#### Migrate to PostgreSQL:
```python
# New file: backend/database.py
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Track(Base):
    __tablename__ = "tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    filename_full = Column(String)
    filename_preview = Column(String)
    mode = Column(String, index=True)
    custom_freqs = Column(JSON, nullable=True)
    size_bytes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    plays = Column(Integer, default=0)
    tags = Column(JSON)  # For search: ["relaxing", "nature", "piano"]
    artist = Column(String, index=True, nullable=True)
    duration_seconds = Column(Float)
    is_public = Column(Boolean, default=True)
    user_id = Column(String, index=True)  # Creator

Base.metadata.create_all(bind=engine)
```

#### Search Endpoint:
```python
from sqlalchemy import or_, and_

@app.get("/search/")
async def search_tracks(
    query: str = Query(None),
    mode: str = Query(None),
    artist: str = Query(None),
    tags: str = Query(None),  # Comma-separated
    min_duration: int = Query(None),
    max_duration: int = Query(None),
    limit: int = Query(20)
):
    """
    Advanced search with multiple filters
    Example: /search/?query=relaxing&mode=alpha&tags=piano,nature
    """
    db = SessionLocal()
    
    filters = []
    
    if query:
        filters.append(or_(
            Track.name.ilike(f"%{query}%"),
            Track.artist.ilike(f"%{query}%")
        ))
    
    if mode:
        filters.append(Track.mode == mode)
    
    if artist:
        filters.append(Track.artist.ilike(f"%{artist}%"))
    
    if tags:
        tag_list = tags.split(',')
        # Search in JSON array
        for tag in tag_list:
            filters.append(Track.tags.contains([tag]))
    
    if min_duration:
        filters.append(Track.duration_seconds >= min_duration)
    
    if max_duration:
        filters.append(Track.duration_seconds <= max_duration)
    
    results = db.query(Track).filter(and_(*filters)).limit(limit).all()
    db.close()
    
    return results
```

#### Frontend Search Component:
```jsx
// frontend/src/components/SearchBar.jsx
import React, { useState, useEffect } from 'react';
import debounce from 'lodash.debounce';

export default function SearchBar({ onResults }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    mode: '',
    tags: '',
    minDuration: '',
    maxDuration: ''
  });
  
  const performSearch = debounce(async () => {
    const params = new URLSearchParams({
      query,
      ...filters
    });
    
    const res = await fetch(`http://localhost:8000/search/?${params}`);
    const data = await res.json();
    onResults(data);
  }, 300);
  
  useEffect(() => {
    if (query.length > 2) {
      performSearch();
    }
  }, [query, filters]);
  
  return (
    <div className="search-container">
      <input
        type="text"
        placeholder="Search tracks, artists, moods..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search-input"
      />
      
      <div className="search-filters">
        <select 
          value={filters.mode}
          onChange={(e) => setFilters({...filters, mode: e.target.value})}
        >
          <option value="">All Modes</option>
          <option value="alpha">Alpha</option>
          <option value="beta">Beta</option>
          <option value="gamma">Gamma</option>
          <option value="theta">Theta</option>
          <option value="delta">Delta</option>
        </select>
        
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={filters.tags}
          onChange={(e) => setFilters({...filters, tags: e.target.value})}
        />
      </div>
    </div>
  );
}
```

### 2.2 Music Creation Tools (Remix & Beat Creation)
**Timeline: Week 9-11**

#### Backend - Audio Manipulation:
```python
# New file: backend/audio_tools.py
from pydub import AudioSegment
from pydub.effects import normalize, speedup, compress_dynamic_range
import numpy as np
import soundfile as sf

class AudioRemixer:
    @staticmethod
    def adjust_tempo(filepath: str, factor: float) -> AudioSegment:
        """Adjust tempo without changing pitch (0.5 = half speed, 2.0 = double speed)"""
        audio = AudioSegment.from_file(filepath)
        return speedup(audio, playback_speed=factor)
    
    @staticmethod
    def add_reverb(filepath: str, room_size: float = 0.5) -> np.ndarray:
        """Simple reverb effect"""
        data, sr = sf.read(filepath)
        # Implement convolution reverb
        # (Simplified - would use actual impulse response)
        delay_samples = int(sr * 0.05 * room_size)
        reverb = np.zeros(len(data) + delay_samples)
        reverb[:len(data)] = data
        reverb[delay_samples:] += data * 0.3 * room_size
        return reverb, sr
    
    @staticmethod
    def create_loop(filepath: str, num_loops: int = 4) -> AudioSegment:
        """Create seamless loop"""
        audio = AudioSegment.from_file(filepath)
        return audio * num_loops
    
    @staticmethod
    def mix_tracks(track1_path: str, track2_path: str, balance: float = 0.5):
        """Mix two tracks together (balance: 0=all track1, 1=all track2)"""
        t1 = AudioSegment.from_file(track1_path)
        t2 = AudioSegment.from_file(track2_path)
        
        # Normalize lengths
        if len(t1) > len(t2):
            t2 = t2 + AudioSegment.silent(duration=len(t1) - len(t2))
        else:
            t1 = t1 + AudioSegment.silent(duration=len(t2) - len(t1))
        
        # Apply balance
        t1_vol = -20 * (1 - balance)  # dB reduction
        t2_vol = -20 * balance
        
        mixed = t1 + t1_vol + t2 + t2_vol
        return mixed

@app.post("/remix/")
async def remix_track(
    user_id: str = Depends(verify_token),
    track_id: int = Form(...),
    tempo_factor: float = Form(1.0),
    add_reverb: bool = Form(False),
    reverb_amount: float = Form(0.5),
    loop_count: int = Form(1)
):
    """Apply remix effects to a track"""
    # Retrieve original track
    # Apply effects
    # Save as new track
    # Return processed result
    pass
```

#### Frontend Remix Studio:
```jsx
// frontend/src/pages/RemixStudio.jsx
import React, { useState } from 'react';

export default function RemixStudio() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [effects, setEffects] = useState({
    tempo: 1.0,
    reverb: false,
    reverbAmount: 0.5,
    loops: 1
  });
  
  return (
    <div className="remix-studio">
      <h2>🎛️ Remix Studio</h2>
      
      <div className="studio-layout">
        <div className="track-selector">
          <h3>Select Track to Remix</h3>
          {/* Track selection UI */}
        </div>
        
        <div className="effects-panel">
          <h3>Effects</h3>
          
          <div className="effect-control">
            <label>Tempo</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={effects.tempo}
              onChange={(e) => setEffects({...effects, tempo: e.target.value})}
            />
            <span>{effects.tempo}x</span>
          </div>
          
          <div className="effect-control">
            <label>
              <input
                type="checkbox"
                checked={effects.reverb}
                onChange={(e) => setEffects({...effects, reverb: e.target.checked})}
              />
              Reverb
            </label>
            {effects.reverb && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={effects.reverbAmount}
                onChange={(e) => setEffects({...effects, reverbAmount: e.target.value})}
              />
            )}
          </div>
          
          <div className="effect-control">
            <label>Loop Count</label>
            <input
              type="number"
              min="1"
              max="10"
              value={effects.loops}
              onChange={(e) => setEffects({...effects, loops: e.target.value})}
            />
          </div>
        </div>
        
        <div className="preview-panel">
          <button className="btn-preview">Preview</button>
          <button className="btn-save">Save Remix</button>
        </div>
      </div>
    </div>
  );
}
```

### 2.3 Direct Upload & Community Sharing
**Timeline: Week 11-12**

#### Backend:
```python
@app.post("/upload/original/")
async def upload_original_content(
    user_id: str = Depends(verify_token),
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    tags: str = Form(None),  # Comma-separated
    is_public: bool = Form(True),
    license_type: str = Form("all_rights_reserved")  # or "creative_commons"
):
    """
    Allow users to upload their own original content
    """
    # Validate file
    validate_file_extension(file.filename)
    
    # Save file
    filepath = f"user_uploads/{user_id}/{sanitize_filename(file.filename)}"
    
    # Create track entry in database
    db = SessionLocal()
    track = Track(
        name=title,
        user_id=user_id,
        description=description,
        tags=tags.split(',') if tags else [],
        is_public=is_public,
        license_type=license_type,
        filename_full=filepath
    )
    db.add(track)
    db.commit()
    
    return {"status": "success", "track_id": track.id}

@app.get("/community/")
async def get_community_tracks(
    limit: int = Query(20),
    sort_by: str = Query("recent")  # recent, popular, trending
):
    """Get public community uploads"""
    db = SessionLocal()
    query = db.query(Track).filter(Track.is_public == True)
    
    if sort_by == "popular":
        query = query.order_by(Track.plays.desc())
    elif sort_by == "trending":
        # Tracks with most plays in last 7 days
        # (Requires additional tracking)
        pass
    else:  # recent
        query = query.order_by(Track.created_at.desc())
    
    tracks = query.limit(limit).all()
    db.close()
    return tracks
```

### 2.4 Royalty System
**Timeline: Week 13-14**

```python
# New file: backend/royalty.py
from decimal import Decimal

class RoyaltyCalculator:
    # Revenue split: 70% creator, 20% platform, 10% payment processing
    CREATOR_SHARE = Decimal('0.70')
    PLATFORM_SHARE = Decimal('0.20')
    PROCESSING_FEE = Decimal('0.10')
    
    @staticmethod
    def calculate_payout(sale_price_cents: int) -> dict:
        """Calculate royalty distribution"""
        total = Decimal(sale_price_cents) / 100
        
        return {
            "creator_amount": float(total * RoyaltyCalculator.CREATOR_SHARE),
            "platform_amount": float(total * RoyaltyCalculator.PLATFORM_SHARE),
            "processing_fee": float(total * RoyaltyCalculator.PROCESSING_FEE),
            "currency": "USD"
        }

@app.get("/royalties/{user_id}/earnings")
async def get_user_earnings(
    user_id: str = Depends(verify_token),
    start_date: str = Query(None),
    end_date: str = Query(None)
):
    """Get creator earnings summary"""
    # Query sales of user's tracks
    # Calculate total earnings
    # Return breakdown
    pass

@app.post("/royalties/payout")
async def request_payout(
    user_id: str = Depends(verify_token),
    amount: float = Form(...),
    payout_method: str = Form(...)  # stripe, paypal, etc.
):
    """Creator requests payout of accumulated earnings"""
    # Minimum payout threshold
    MIN_PAYOUT = 50.00
    
    if amount < MIN_PAYOUT:
        raise HTTPException(400, detail=f"Minimum payout is ${MIN_PAYOUT}")
    
    # Process payout via Stripe Connect
    # (Implementation depends on Stripe Connect setup)
    pass
```

---

## 🤖 PHASE 3: V3 FEATURES

### 3.1 AI-Generated Tracks
**Timeline: Week 15-18**

#### Option 1: Integration with Existing AI Music Models
```python
# New file: backend/ai_generation.py
import requests
import os

STABILITY_AI_KEY = os.getenv("STABILITY_AI_KEY")
# Or use: Audiocraft, MusicGen, Riffusion

@app.post("/generate/ai/")
async def generate_ai_track(
    user_id: str = Depends(verify_token),
    prompt: str = Form(...),
    duration: int = Form(30),  # seconds
    style: str = Form("ambient"),
    mode: str = Form("alpha")  # Apply binaural to generated track
):
    """
    Generate AI track based on text prompt
    Example prompt: "Peaceful piano melody with rain sounds, 432Hz tuning"
    """
    
    # Call AI music generation API
    response = requests.post(
        "https://api.stability.ai/v2beta/music/generate",
        headers={"Authorization": f"Bearer {STABILITY_AI_KEY}"},
        json={
            "prompt": prompt,
            "duration": duration,
            "style": style
        }
    )
    
    if response.status_code == 200:
        audio_data = response.content
        
        # Save generated audio
        filename = f"ai_generated_{user_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.wav"
        filepath = os.path.join(LIBRARY_FOLDER, filename)
        
        with open(filepath, 'wb') as f:
            f.write(audio_data)
        
        # Apply binaural processing
        config = WAVE_MODES[mode]
        freq = config.FIXED_DIFF if hasattr(config, 'FIXED_DIFF') else config.DEFAULT_DIFF
        output, sr = make_binaural_from_file(filepath, freq)
        
        # Save processed version
        processed_path = filepath.replace('.wav', '_processed.wav')
        sf.write(processed_path, output, sr)
        
        return {
            "status": "success",
            "filename": processed_path,
            "prompt": prompt
        }
    
    raise HTTPException(500, detail="AI generation failed")
```

#### Frontend AI Generator:
```jsx
// frontend/src/pages/AIGenerator.jsx
import React, { useState } from 'react';

export default function AIGenerator() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('ambient');
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState('alpha');
  const [generating, setGenerating] = useState(false);
  
  const handleGenerate = async () => {
    setGenerating(true);
    
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('duration', duration);
    formData.append('style', style);
    formData.append('mode', mode);
    
    const res = await fetch('http://localhost:8000/generate/ai/', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await res.json();
    setGenerating(false);
    
    // Handle result
  };
  
  return (
    <div className="ai-generator">
      <h2>🤖 AI Track Generator</h2>
      <p>Describe the track you want to create</p>
      
      <div className="generator-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., 'Peaceful ocean waves with soft piano, perfect for meditation'"
          rows={4}
        />
        
        <div className="generation-params">
          <div>
            <label>Style</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="ambient">Ambient</option>
              <option value="nature">Nature Sounds</option>
              <option value="electronic">Electronic</option>
              <option value="classical">Classical</option>
              <option value="lofi">Lo-Fi</option>
            </select>
          </div>
          
          <div>
            <label>Duration (seconds)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="10"
              max="300"
            />
          </div>
          
          <div>
            <label>Binaural Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="alpha">Alpha (Relaxation)</option>
              <option value="beta">Beta (Focus)</option>
              <option value="gamma">Gamma (High Focus)</option>
              <option value="theta">Theta (Meditation)</option>
              <option value="delta">Delta (Sleep)</option>
            </select>
          </div>
        </div>
        
        <button 
          onClick={handleGenerate}
          disabled={generating || !prompt}
          className="btn-generate"
        >
          {generating ? '⏳ Generating...' : '✨ Generate Track'}
        </button>
        
        {generating && (
          <div className="generation-status">
            <p>Creating your AI-powered binaural track...</p>
            <div className="progress-bar"></div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3.2 Mobile App (React Native)
**Timeline: Week 19-24**

#### Project Structure:
```
soundara-mobile/
├── App.js
├── package.json
├── app.json
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js
│   │   ├── LibraryScreen.js
│   │   ├── PlayerScreen.js
│   │   ├── SearchScreen.js
│   │   └── ProfileScreen.js
│   ├── components/
│   │   ├── AudioPlayer.js
│   │   ├── TrackCard.js
│   │   └── PlaylistView.js
│   ├── services/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── storage.js
│   └── utils/
│       ├── audioUtils.js
│       └── constants.js
```

#### Key Mobile Features:
```javascript
// src/services/audioService.js
import TrackPlayer from 'react-native-track-player';

class AudioService {
  async setupPlayer() {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      stopWithApp: false,
      capabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
        TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
      ],
      compactCapabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
      ],
    });
  }
  
  async playTrack(track) {
    await TrackPlayer.add({
      id: track.id,
      url: track.url,
      title: track.name,
      artist: track.artist || 'Soundara',
      artwork: track.artwork || require('../assets/default-artwork.png'),
    });
    await TrackPlayer.play();
  }
  
  // Offline playback support
  async downloadTrack(track) {
    const downloadPath = `${RNFS.DocumentDirectoryPath}/${track.id}.wav`;
    await RNFS.downloadFile({
      fromUrl: track.url,
      toFile: downloadPath,
    }).promise;
    
    // Store in local database
    await AsyncStorage.setItem(`track_${track.id}`, JSON.stringify({
      ...track,
      localPath: downloadPath,
      downloadedAt: new Date().toISOString()
    }));
  }
}

export default new AudioService();
```

#### Background Audio & Notifications:
```javascript
// App.js
import React, { useEffect } from 'react';
import TrackPlayer from 'react-native-track-player';
import PushNotification from 'react-native-push-notification';

export default function App() {
  useEffect(() => {
    // Setup background audio
    TrackPlayer.registerPlaybackService(() => require('./service'));
    
    // Setup notifications
    PushNotification.configure({
      onNotification: function(notification) {
        console.log('Notification:', notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
    });
  }, []);
  
  return <AppNavigator />;
}
```

---

## 📊 IMPLEMENTATION PRIORITIES & TIMELINE

### Critical Path (Must Complete First):
1. **Week 1-3: Security Enhancements** ⚠️ HIGHEST PRIORITY
   - JWT Authentication
   - Rate Limiting
   - Input Validation
   - Stripe Webhooks
   - HTTPS & Security Headers

2. **Week 4-6: V1 Features**
   - Custom Frequencies
   - Mode Playlists

3. **Week 7-14: V2 Features**
   - Search Database
   - Music Tools
   - Direct Upload
   - Royalty System

4. **Week 15-24: V3 Features**
   - AI Generation
   - Mobile App

### Resource Requirements:

#### Development Tools:
- PostgreSQL database
- Redis (for rate limiting & caching)
- AWS S3 or DigitalOcean Spaces (file storage)
- Stripe Connect account (for royalties)
- AI Music API subscription (Stability AI or similar)
- React Native development environment

#### Estimated Costs:
- Database hosting: $20-50/month
- File storage: $5-20/month (scales with usage)
- AI API: $0.10-0.50 per generation
- Mobile app developer account: $99/year (Apple) + $25 one-time (Google)

### Testing Checklist:

#### Security Testing:
- [ ] Penetration testing
- [ ] SQL injection attempts
- [ ] XSS vulnerability testing
- [ ] Rate limit stress testing
- [ ] Authentication bypass attempts
- [ ] File upload exploits

#### Feature Testing:
- [ ] Custom frequency processing accuracy
- [ ] Search result relevance
- [ ] Audio mixing quality
- [ ] Payment flow end-to-end
- [ ] Mobile app offline functionality

---

## 🚨 IMMEDIATE ACTION ITEMS

### This Week:
1. Set up `.env` file with all secrets
2. Implement JWT authentication
3. Add rate limiting middleware
4. Deploy Stripe webhooks
5. Add comprehensive input validation

### Next Week:
1. Start V1 custom frequencies
2. Create mode playlists
3. Security audit

### Month 1 Goal:
- All security vulnerabilities patched
- V1 features live
- V2 database migration complete

---

## 📈 SUCCESS METRICS

### Security Metrics:
- Zero successful unauthorized access attempts
- 100% of endpoints protected with authentication
- < 0.1% of requests flagged as suspicious
- All payments verified via webhooks

### Feature Metrics:
- V1: 30% of users use custom frequencies
- V2: 1000+ community uploads within 3 months
- V3: 500+ AI-generated tracks per week
- Mobile: 5000+ downloads in first month

---

## 🛠️ DEVELOPMENT BEST PRACTICES

1. **Version Control**: Create feature branches for each phase
2. **Testing**: Write unit tests for all new functions
3. **Documentation**: Update API docs with each endpoint
4. **Code Review**: All security-related code requires review
5. **Deployment**: Use staging environment for testing before production
6. **Monitoring**: Set up error tracking (Sentry) and performance monitoring

---

**Ready to start implementation? I recommend beginning with Phase 0 (Security) immediately.**

Let me know which component you'd like to tackle first, and I'll provide the complete implementation code!
