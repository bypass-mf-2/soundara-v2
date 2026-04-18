#!/usr/bin/env python3
"""
One-shot migration: import existing JSON files into the SQLite database.

Safe to run multiple times. If the DB already has rows for a dataset, skips it.
Backs up each JSON file to <file>.pre_migration.bak before doing anything.

Usage:
    python3 backend/migrate_json_to_sqlite.py
"""

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(HERE)
sys.path.insert(0, BASE_DIR)

try:
    from backend import db
except ImportError:
    sys.path.insert(0, HERE)
    import db

DB_PATH = os.environ.get("DB_FILE") or os.path.join(BASE_DIR, "soundara.db")

FILES = {
    "library":        os.path.join(BASE_DIR, "music_library.json"),
    "user_library":   os.path.join(BASE_DIR, "user_library.json"),
    "subscriptions":  os.path.join(BASE_DIR, "user_subscriptions.json"),
    "playlists":      os.path.join(BASE_DIR, "playlists.json"),
    "events":         os.path.join(BASE_DIR, "track_event.json"),
    "free_users":     os.path.join(BASE_DIR, "free_users.json"),
    "community":      os.path.join(BASE_DIR, "community_uploads.json"),
    "creators":       os.path.join(BASE_DIR, "creator_accounts.json"),
}


def load_json_safe(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"  ! could not parse {path}: {e}")
        print(f"    leaving empty; original preserved as .pre_migration.bak")
        return default


def backup(path: str) -> None:
    if os.path.exists(path):
        bak = path + ".pre_migration.bak"
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
            print(f"  backed up -> {bak}")


def count(table: str) -> int:
    r = db._CONN.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()
    return int(r["n"])


def main() -> None:
    print(f"Initializing SQLite at {DB_PATH}")
    db.init(DB_PATH)

    # Back up every JSON first — migration is a read-only op on the files,
    # but we want a snapshot anyway.
    print("Backing up JSON files...")
    for path in FILES.values():
        backup(path)

    # --- Library ---
    print("\nMigrating music_library.json...")
    if count("tracks") == 0:
        library = load_json_safe(FILES["library"], [])
        if isinstance(library, list):
            db.save_library(library)
            print(f"  imported {len(library)} tracks")
        else:
            print("  ! library file not a list; skipped")
    else:
        print(f"  tracks table already has {count('tracks')} rows; skipped")

    # --- User library ---
    print("\nMigrating user_library.json...")
    if count("user_library") == 0:
        ul = load_json_safe(FILES["user_library"], {})
        if isinstance(ul, dict):
            db.save_user_library_all(ul)
            total = sum(len(v) for v in ul.values())
            print(f"  imported {total} user-track entries across {len(ul)} users")
        else:
            print("  ! user_library file not a dict; skipped")
    else:
        print(f"  user_library table already has {count('user_library')} rows; skipped")

    # --- Subscriptions ---
    print("\nMigrating user_subscriptions.json...")
    if count("subscriptions") == 0:
        subs = load_json_safe(FILES["subscriptions"], {})
        if isinstance(subs, dict):
            db.save_subscriptions_all(subs)
            print(f"  imported {len(subs)} subscriptions")
    else:
        print(f"  subscriptions table already has {count('subscriptions')} rows; skipped")

    # --- Playlists ---
    print("\nMigrating playlists.json...")
    if count("playlists") == 0:
        pl = load_json_safe(FILES["playlists"], {})
        if isinstance(pl, dict):
            db.save_all_playlists(pl)
            print(f"  imported playlists for {len(pl)} users")
    else:
        print(f"  playlists table already has {count('playlists')} rows; skipped")

    # --- Events ---
    print("\nMigrating track_event.json...")
    if count("events") == 0:
        events = load_json_safe(FILES["events"], [])
        if isinstance(events, list):
            db.save_events(events)
            print(f"  imported {len(events)} events")
    else:
        print(f"  events table already has {count('events')} rows; skipped")

    # --- Free users ---
    print("\nMigrating free_users.json...")
    if count("free_users") == 0:
        fu = load_json_safe(FILES["free_users"], [])
        if isinstance(fu, list):
            db.save_free_users(fu)
            print(f"  imported {len(fu)} free users")
    else:
        print(f"  free_users table already has {count('free_users')} rows; skipped")

    # --- Community uploads ---
    print("\nMigrating community_uploads.json...")
    if count("community_uploads") == 0:
        cu = load_json_safe(FILES["community"], [])
        if isinstance(cu, list):
            db.save_community(cu)
            print(f"  imported {len(cu)} community uploads")
    else:
        print(f"  community_uploads table already has {count('community_uploads')} rows; skipped")

    # --- Creator accounts ---
    print("\nMigrating creator_accounts.json...")
    if count("creator_accounts") == 0:
        ca = load_json_safe(FILES["creators"], {})
        if isinstance(ca, dict):
            db.save_creator_accounts(ca)
            print(f"  imported {len(ca)} creator accounts")
    else:
        print(f"  creator_accounts table already has {count('creator_accounts')} rows; skipped")

    print("\nMigration complete.")
    print(f"  DB: {DB_PATH}")
    print(f"  Originals preserved with .pre_migration.bak suffix")
    print(f"  Restart the backend: sudo systemctl restart soundara-backend")


if __name__ == "__main__":
    main()
