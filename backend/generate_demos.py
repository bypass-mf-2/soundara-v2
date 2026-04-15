#!/usr/bin/env python3
"""
Generate 15-second binaural demo clips from assets/demo_source.mp3.

Output: backend/assets/demo_<mode>.wav for each of:
    gamma, alpha, beta, theta, delta, schumann

Idempotent — skips modes whose demo file already exists.

Usage:
    python3 backend/generate_demos.py          # generate missing
    python3 backend/generate_demos.py --force  # regenerate all
"""

import os
import sys
import argparse

import numpy as np
import soundfile as sf
import librosa

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(HERE)
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, HERE)

try:
    from backend.alpha import config as alpha
    from backend.beta import config as beta
    from backend.gamma import config as gamma
    from backend.theta import config as theta
    from backend.delta import config as delta
    from backend.schumann_resonance import config as schumann
except ImportError:
    from alpha import config as alpha
    from beta import config as beta
    from gamma import config as gamma
    from theta import config as theta
    from delta import config as delta
    from schumann_resonance import config as schumann

MODES = {
    "gamma":    gamma.DEFAULT_DIFF,
    "alpha":    alpha.DEFAULT_DIFF,
    "beta":     beta.DEFAULT_DIFF,
    "theta":    theta.DEFAULT_DIFF,
    "delta":    delta.DEFAULT_DIFF,
    "schumann": schumann.DEFAULT_DIFF,
}

ASSETS_DIR = os.path.join(HERE, "assets")
SOURCE_FILE = os.path.join(ASSETS_DIR, "demo_source.mp3")
DEMO_SECONDS = 15
# Skip the first N seconds so the demo starts after silence / intro
SKIP_SECONDS = 20


def make_binaural_clip(mono: np.ndarray, sr: int, freq_shift_hz: float) -> np.ndarray:
    """Return a stereo array where the right channel is pitch-shifted by freq_shift_hz."""
    semitones = 12 * np.log2(1 + freq_shift_hz / sr)
    shifted = librosa.effects.pitch_shift(y=mono, sr=sr, n_steps=semitones)
    min_len = min(len(mono), len(shifted))
    left = mono[:min_len]
    right = shifted[:min_len]
    return np.stack([left, right], axis=-1)


def fade_in_out(stereo: np.ndarray, sr: int, seconds: float = 0.5) -> np.ndarray:
    n = int(sr * seconds)
    if n <= 0 or stereo.shape[0] < 2 * n:
        return stereo
    env = np.ones(stereo.shape[0])
    env[:n] = np.linspace(0, 1, n)
    env[-n:] = np.linspace(1, 0, n)
    return stereo * env[:, None]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate even if demo files exist")
    args = parser.parse_args()

    if not os.path.exists(SOURCE_FILE):
        print(f"Source file missing: {SOURCE_FILE}")
        print("(skipping demo generation)")
        return

    os.makedirs(ASSETS_DIR, exist_ok=True)

    need = [m for m in MODES if args.force or not os.path.exists(os.path.join(ASSETS_DIR, f"demo_{m}.wav"))]
    if not need:
        print("All demo files present; nothing to do.")
        return

    print(f"Loading source {SOURCE_FILE}...")
    mono, sr = librosa.load(SOURCE_FILE, sr=None, mono=True)
    print(f"  sr={sr} Hz, duration={len(mono) / sr:.1f}s")

    start = min(int(SKIP_SECONDS * sr), max(0, len(mono) - int(DEMO_SECONDS * sr)))
    end = start + int(DEMO_SECONDS * sr)
    if end > len(mono):
        end = len(mono)
        start = max(0, end - int(DEMO_SECONDS * sr))
    clip = mono[start:end]
    print(f"  using samples [{start}:{end}] ({(end - start) / sr:.1f}s)")

    for mode in need:
        freq = MODES[mode]
        out_path = os.path.join(ASSETS_DIR, f"demo_{mode}.wav")
        print(f"  rendering {mode} ({freq} Hz shift)...")
        stereo = make_binaural_clip(clip, sr, freq)
        stereo = fade_in_out(stereo, sr, seconds=0.5)
        sf.write(out_path, stereo, sr, subtype="PCM_16")
        size_kb = os.path.getsize(out_path) / 1024
        print(f"    -> {out_path} ({size_kb:.0f} KB)")

    print("\nDemo generation complete.")


if __name__ == "__main__":
    main()
