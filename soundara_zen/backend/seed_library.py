"""
Seed the public music library with well-known public-domain classical tracks,
each processed with binaural frequency adjustment for its assigned wave mode.

Usage:
    python -m backend.seed_library

Idempotent: skips tracks whose name already exists in the library.
Requires yt-dlp + ffmpeg (already used by /process/ endpoint).
"""

import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime

import numpy as np
import soundfile as sf
import librosa
import yt_dlp
from pydub import AudioSegment

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIBRARY_FOLDER = os.path.join(BASE_DIR, "music_library")
SEED_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_tracks.json")
DB_FILE = os.environ.get("DB_FILE") or os.path.join(BASE_DIR, "soundara.db")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", r"C:\Users\trevo\Downloads\ffmpeg\bin")

os.makedirs(LIBRARY_FOLDER, exist_ok=True)

try:
    from backend import db
    from backend.alpha import config as alpha
    from backend.beta import config as beta
    from backend.gamma import config as gamma
    from backend.theta import config as theta
    from backend.delta import config as delta
except ImportError:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import db
    from alpha import config as alpha
    from beta import config as beta
    from gamma import config as gamma
    from theta import config as theta
    from delta import config as delta

db.init(DB_FILE)

WAVE_MODES = {
    "alpha": alpha,
    "beta": beta,
    "gamma": gamma,
    "theta": theta,
    "delta": delta,
}


def make_binaural_from_file(path: str, freq_shift_hz: float):
    data, sr = sf.read(path)
    mono = np.mean(data, axis=1) if data.ndim == 2 else data
    semitones = 12 * np.log2(1 + freq_shift_hz / sr)
    shifted = librosa.effects.pitch_shift(y=mono, sr=sr, n_steps=semitones)
    n = min(len(mono), len(shifted))
    stereo = np.column_stack([mono[:n], shifted[:n]])
    return stereo, sr


def create_preview(full_path, preview_path, seconds=15):
    AudioSegment.from_file(full_path)[: seconds * 1000].export(preview_path, format="wav")


def download_search(query: str, output_path: str) -> None:
    """Download first YouTube result for query as wav."""
    tmp_template = os.path.join(tempfile.gettempdir(), f"seed_{os.getpid()}_%(autonumber)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": tmp_template,
        "default_search": "ytsearch1",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }],
        "ffmpeg_location": FFMPEG_PATH,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([query])

    produced = [
        os.path.join(tempfile.gettempdir(), f)
        for f in os.listdir(tempfile.gettempdir())
        if f.startswith(f"seed_{os.getpid()}_") and f.endswith(".wav")
    ]
    if not produced:
        raise RuntimeError(f"yt-dlp produced no wav for query: {query}")
    shutil.move(produced[0], output_path)
    for leftover in produced[1:]:
        try:
            os.remove(leftover)
        except OSError:
            pass


def seed_track(entry: dict) -> str:
    name = entry["name"]
    mode = entry["mode"]
    query = entry["search_query"]

    if mode not in WAVE_MODES:
        raise ValueError(f"Unknown mode '{mode}' for track '{name}'")

    existing = {t["name"].lower() for t in db.load_library()}
    if name.lower() in existing:
        return "skipped (already in library)"

    cfg = WAVE_MODES[mode]
    freq = getattr(cfg, "FIXED_DIFF", cfg.DEFAULT_DIFF)

    safe_name = re.sub(r"[^\w\-]", "_", name)
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    raw_path = os.path.join(LIBRARY_FOLDER, f"raw_{safe_name}_{ts}.wav")
    full_filename = f"processed_{safe_name}_{ts}.wav"
    full_path = os.path.join(LIBRARY_FOLDER, full_filename)
    preview_filename = f"preview_{safe_name}_{ts}.wav"
    preview_path = os.path.join(LIBRARY_FOLDER, preview_filename)

    try:
        download_search(query, raw_path)
        stereo, sr = make_binaural_from_file(raw_path, freq)
        sf.write(full_path, stereo, sr)
        create_preview(full_path, preview_path, seconds=15)

        db.upsert_track({
            "name": name,
            "filename_full": full_filename,
            "filename_preview": preview_filename,
            "mode": mode,
            "is_binaural": True,
            "custom_freqs": None,
            "size_bytes": os.path.getsize(full_path),
            "timestamp": datetime.now().isoformat(),
            "plays": 0,
            "composer": entry.get("composer"),
            "license": entry.get("license", "PD"),
            "source_query": query,
        })
        return "added"
    finally:
        if os.path.exists(raw_path):
            try:
                os.remove(raw_path)
            except OSError:
                pass


def main():
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        seed = json.load(f)

    tracks = seed["tracks"]
    print(f"Seeding {len(tracks)} tracks from {SEED_FILE}")

    added = skipped = failed = 0
    for i, entry in enumerate(tracks, 1):
        label = f"[{i}/{len(tracks)}] {entry['composer']} - {entry['name']} ({entry['mode']})"
        try:
            result = seed_track(entry)
            print(f"  {label}: {result}")
            if result == "added":
                added += 1
            else:
                skipped += 1
        except Exception as e:
            failed += 1
            print(f"  {label}: FAILED - {e}")

    print(f"\nDone. added={added} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
