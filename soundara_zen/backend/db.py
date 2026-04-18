"""
SQLite storage layer.

Exposes helpers that return the same Python shapes the JSON files used to,
so route handlers change minimally.

Thread-safe via check_same_thread=False + WAL mode. Good enough for a
single-process uvicorn; revisit if we ever scale out to multiple workers.
"""

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from typing import Any

_DB_PATH = None
_LOCK = threading.RLock()
_CONN: sqlite3.Connection | None = None


SCHEMA = """
CREATE TABLE IF NOT EXISTS tracks (
    filename_full TEXT PRIMARY KEY,
    name TEXT,
    mode TEXT,
    filename_preview TEXT,
    size_bytes INTEGER,
    plays INTEGER DEFAULT 0,
    price_cents INTEGER,
    timestamp TEXT,
    custom_freqs INTEGER DEFAULT 0,
    extra TEXT
);

CREATE TABLE IF NOT EXISTS user_library (
    user_id TEXT NOT NULL,
    filename_full TEXT NOT NULL,
    name TEXT,
    mode TEXT,
    filename_preview TEXT,
    size_bytes INTEGER,
    added_at TEXT,
    extra TEXT,
    PRIMARY KEY (user_id, filename_full)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordinal INTEGER,
    timestamp TEXT,
    type TEXT,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_ordinal ON events(ordinal);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

CREATE TABLE IF NOT EXISTS free_users (
    user_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS community_uploads (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    status TEXT,
    artist_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_status ON community_uploads(status);
CREATE INDEX IF NOT EXISTS idx_community_artist ON community_uploads(artist_id);

CREATE TABLE IF NOT EXISTS creator_accounts (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    added_at TEXT,
    PRIMARY KEY (user_id, track_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_track ON favorites(track_id, kind);

CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    followed_at TEXT,
    PRIMARY KEY (follower_id, artist_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_artist ON follows(artist_id);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    track_id TEXT,
    mode TEXT,
    rating INTEGER,
    session_minutes INTEGER,
    timestamp TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_mode ON feedback(mode);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);

CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    bio TEXT,
    picture TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS referral_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

CREATE TABLE IF NOT EXISTS referral_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_user_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    stripe_session_id TEXT,
    created_at TEXT,
    UNIQUE (referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referrer ON referral_redemptions(referrer_user_id);
"""


def init(db_path: str) -> None:
    """Initialize connection and schema. Call once at startup."""
    global _DB_PATH, _CONN
    _DB_PATH = db_path
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    _CONN = sqlite3.connect(db_path, check_same_thread=False, isolation_level=None)
    _CONN.row_factory = sqlite3.Row
    _CONN.execute("PRAGMA journal_mode=WAL")
    _CONN.execute("PRAGMA foreign_keys=ON")
    _CONN.execute("PRAGMA busy_timeout=5000")
    _CONN.executescript(SCHEMA)


@contextmanager
def _tx():
    """Serialized transaction context. SQLite only supports one writer at a time."""
    with _LOCK:
        _CONN.execute("BEGIN IMMEDIATE")
        try:
            yield _CONN
            _CONN.execute("COMMIT")
        except Exception:
            _CONN.execute("ROLLBACK")
            raise


def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None


# ------------------------------------------------------------------
# Library (music_library.json: list of track dicts)
# ------------------------------------------------------------------
def load_library() -> list[dict]:
    rows = _CONN.execute(
        "SELECT filename_full, name, mode, filename_preview, size_bytes, plays, "
        "price_cents, timestamp, custom_freqs, extra FROM tracks"
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["custom_freqs"] = bool(d["custom_freqs"])
        extra = d.pop("extra")
        if extra:
            try:
                d.update(json.loads(extra))
            except Exception:
                pass
        out.append(d)
    return out


def save_library(tracks: list[dict]) -> None:
    """Full replace. Used when existing code did open+write of the whole list."""
    with _tx() as c:
        c.execute("DELETE FROM tracks")
        for t in tracks:
            _insert_track(c, t)


def upsert_track(track: dict) -> None:
    with _tx() as c:
        _insert_track(c, track)


def _insert_track(conn: sqlite3.Connection, t: dict) -> None:
    core = {
        "filename_full": t.get("filename_full"),
        "name": t.get("name"),
        "mode": t.get("mode"),
        "filename_preview": t.get("filename_preview"),
        "size_bytes": t.get("size_bytes"),
        "plays": t.get("plays", 0),
        "price_cents": t.get("price_cents"),
        "timestamp": t.get("timestamp"),
        "custom_freqs": 1 if t.get("custom_freqs") else 0,
    }
    extra = {k: v for k, v in t.items() if k not in core}
    conn.execute(
        "INSERT INTO tracks (filename_full, name, mode, filename_preview, size_bytes, plays, "
        "price_cents, timestamp, custom_freqs, extra) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(filename_full) DO UPDATE SET "
        "name=excluded.name, mode=excluded.mode, filename_preview=excluded.filename_preview, "
        "size_bytes=excluded.size_bytes, plays=excluded.plays, "
        "price_cents=excluded.price_cents, timestamp=excluded.timestamp, "
        "custom_freqs=excluded.custom_freqs, extra=excluded.extra",
        (
            core["filename_full"], core["name"], core["mode"], core["filename_preview"],
            core["size_bytes"], core["plays"], core["price_cents"], core["timestamp"],
            core["custom_freqs"], json.dumps(extra) if extra else None,
        ),
    )


def increment_track_plays(filename_full: str) -> None:
    with _tx() as c:
        c.execute("UPDATE tracks SET plays = plays + 1 WHERE filename_full = ?", (filename_full,))


# ------------------------------------------------------------------
# User library (user_library.json: dict user_id -> [track, ...])
# ------------------------------------------------------------------
def load_user_library_all() -> dict[str, list[dict]]:
    rows = _CONN.execute("SELECT * FROM user_library").fetchall()
    out: dict[str, list[dict]] = {}
    for r in rows:
        d = dict(r)
        uid = d.pop("user_id")
        d.pop("added_at", None)
        extra = d.pop("extra")
        if extra:
            try:
                d.update(json.loads(extra))
            except Exception:
                pass
        out.setdefault(uid, []).append(d)
    return out


def save_user_library_all(data: dict[str, list[dict]]) -> None:
    """Full replace. Used when existing code wrote the whole dict."""
    with _tx() as c:
        c.execute("DELETE FROM user_library")
        for uid, tracks in data.items():
            for t in tracks:
                _insert_user_track(c, uid, t)


def get_user_library(user_id: str) -> list[dict]:
    return load_user_library_all().get(user_id, [])


def add_to_user_library(user_id: str, track: dict) -> None:
    with _tx() as c:
        _insert_user_track(c, user_id, track)


def _insert_user_track(conn: sqlite3.Connection, user_id: str, t: dict) -> None:
    core = {
        "filename_full": t.get("filename_full") or t.get("file"),
        "name": t.get("name"),
        "mode": t.get("mode"),
        "filename_preview": t.get("filename_preview"),
        "size_bytes": t.get("size_bytes"),
        "added_at": t.get("added_at"),
    }
    extra = {k: v for k, v in t.items() if k not in core and k != "file"}
    conn.execute(
        "INSERT OR REPLACE INTO user_library "
        "(user_id, filename_full, name, mode, filename_preview, size_bytes, added_at, extra) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, core["filename_full"], core["name"], core["mode"],
         core["filename_preview"], core["size_bytes"], core["added_at"],
         json.dumps(extra) if extra else None),
    )


# ------------------------------------------------------------------
# Subscriptions (user_subscriptions.json: dict user_id -> subscription dict)
# ------------------------------------------------------------------
def get_subscriptions_all() -> dict[str, dict]:
    rows = _CONN.execute("SELECT user_id, data FROM subscriptions").fetchall()
    return {r["user_id"]: json.loads(r["data"]) for r in rows}


def get_subscription(user_id: str) -> dict | None:
    r = _CONN.execute("SELECT data FROM subscriptions WHERE user_id = ?", (user_id,)).fetchone()
    return json.loads(r["data"]) if r else None


def set_subscription(user_id: str, sub: dict) -> None:
    with _tx() as c:
        c.execute(
            "INSERT INTO subscriptions (user_id, data) VALUES (?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data",
            (user_id, json.dumps(sub)),
        )


def save_subscriptions_all(data: dict[str, dict]) -> None:
    with _tx() as c:
        c.execute("DELETE FROM subscriptions")
        for uid, sub in data.items():
            c.execute(
                "INSERT INTO subscriptions (user_id, data) VALUES (?, ?)",
                (uid, json.dumps(sub)),
            )


# ------------------------------------------------------------------
# Playlists (playlists.json: dict user_id -> playlists dict)
# ------------------------------------------------------------------
def get_playlists(user_id: str) -> dict:
    r = _CONN.execute("SELECT data FROM playlists WHERE user_id = ?", (user_id,)).fetchone()
    return json.loads(r["data"]) if r else {}


def save_playlists(user_id: str, data: dict) -> None:
    with _tx() as c:
        c.execute(
            "INSERT INTO playlists (user_id, data) VALUES (?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data",
            (user_id, json.dumps(data)),
        )


def get_all_playlists() -> dict[str, dict]:
    rows = _CONN.execute("SELECT user_id, data FROM playlists").fetchall()
    return {r["user_id"]: json.loads(r["data"]) for r in rows}


def save_all_playlists(data: dict[str, dict]) -> None:
    with _tx() as c:
        c.execute("DELETE FROM playlists")
        for uid, pls in data.items():
            c.execute(
                "INSERT INTO playlists (user_id, data) VALUES (?, ?)",
                (uid, json.dumps(pls)),
            )


# ------------------------------------------------------------------
# Events (track_event.json: list of event dicts, append-only in practice)
# ------------------------------------------------------------------
def load_events() -> list[dict]:
    rows = _CONN.execute(
        "SELECT data FROM events ORDER BY ordinal ASC, id ASC"
    ).fetchall()
    return [json.loads(r["data"]) for r in rows]


def append_event(event: dict) -> None:
    with _tx() as c:
        c.execute(
            "INSERT INTO events (ordinal, timestamp, type, data) VALUES ("
            "(SELECT COALESCE(MAX(ordinal), 0) + 1 FROM events), ?, ?, ?)",
            (event.get("timestamp"), event.get("type"), json.dumps(event)),
        )


def save_events(events: list[dict]) -> None:
    with _tx() as c:
        c.execute("DELETE FROM events")
        for i, e in enumerate(events):
            c.execute(
                "INSERT INTO events (ordinal, timestamp, type, data) VALUES (?, ?, ?, ?)",
                (i + 1, e.get("timestamp"), e.get("type"), json.dumps(e)),
            )


# ------------------------------------------------------------------
# Free users (free_users.json: list of user_id strings)
# ------------------------------------------------------------------
def load_free_users() -> list[str]:
    rows = _CONN.execute("SELECT user_id FROM free_users").fetchall()
    return [r["user_id"] for r in rows]


def is_free_user(user_id: str) -> bool:
    r = _CONN.execute("SELECT 1 FROM free_users WHERE user_id = ?", (user_id,)).fetchone()
    return r is not None


def add_free_user(user_id: str) -> None:
    with _tx() as c:
        c.execute("INSERT OR IGNORE INTO free_users (user_id) VALUES (?)", (user_id,))


def save_free_users(user_ids: list[str]) -> None:
    with _tx() as c:
        c.execute("DELETE FROM free_users")
        for uid in user_ids:
            c.execute("INSERT OR IGNORE INTO free_users (user_id) VALUES (?)", (uid,))


# ------------------------------------------------------------------
# Community uploads (community_uploads.json: list of track dicts)
# ------------------------------------------------------------------
def load_community() -> list[dict]:
    rows = _CONN.execute(
        "SELECT data FROM community_uploads ORDER BY rowid ASC"
    ).fetchall()
    return [json.loads(r["data"]) for r in rows]


def save_community(uploads: list[dict]) -> None:
    with _tx() as c:
        c.execute("DELETE FROM community_uploads")
        for u in uploads:
            c.execute(
                "INSERT INTO community_uploads (id, data, status, artist_id) VALUES (?, ?, ?, ?)",
                (u.get("id"), json.dumps(u), u.get("status"), u.get("artist_id")),
            )


def add_community_upload(upload: dict) -> None:
    with _tx() as c:
        c.execute(
            "INSERT INTO community_uploads (id, data, status, artist_id) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status, artist_id=excluded.artist_id",
            (upload.get("id"), json.dumps(upload), upload.get("status"), upload.get("artist_id")),
        )


def set_community_status(track_id: str, status: str) -> bool:
    with _tx() as c:
        r = c.execute("SELECT data FROM community_uploads WHERE id = ?", (track_id,)).fetchone()
        if not r:
            return False
        data = json.loads(r["data"])
        data["status"] = status
        c.execute(
            "UPDATE community_uploads SET data = ?, status = ? WHERE id = ?",
            (json.dumps(data), status, track_id),
        )
        return True


# ------------------------------------------------------------------
# Creator accounts (creator_accounts.json: dict user_id -> account dict)
# ------------------------------------------------------------------
def load_creator_accounts() -> dict[str, dict]:
    rows = _CONN.execute("SELECT user_id, data FROM creator_accounts").fetchall()
    return {r["user_id"]: json.loads(r["data"]) for r in rows}


def save_creator_accounts(data: dict[str, dict]) -> None:
    with _tx() as c:
        c.execute("DELETE FROM creator_accounts")
        for uid, acct in data.items():
            c.execute(
                "INSERT INTO creator_accounts (user_id, data) VALUES (?, ?)",
                (uid, json.dumps(acct)),
            )


def get_creator_account(user_id: str) -> dict | None:
    r = _CONN.execute("SELECT data FROM creator_accounts WHERE user_id = ?", (user_id,)).fetchone()
    return json.loads(r["data"]) if r else None


def set_creator_account(user_id: str, acct: dict) -> None:
    with _tx() as c:
        c.execute(
            "INSERT INTO creator_accounts (user_id, data) VALUES (?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data",
            (user_id, json.dumps(acct)),
        )


# ------------------------------------------------------------------
# Favorites
# ------------------------------------------------------------------
def toggle_favorite(user_id: str, track_id: str, kind: str) -> bool:
    """Add or remove a favorite. Returns True if now favorited, False if removed."""
    from datetime import datetime
    with _tx() as c:
        row = c.execute(
            "SELECT 1 FROM favorites WHERE user_id=? AND track_id=? AND kind=?",
            (user_id, track_id, kind),
        ).fetchone()
        if row:
            c.execute(
                "DELETE FROM favorites WHERE user_id=? AND track_id=? AND kind=?",
                (user_id, track_id, kind),
            )
            return False
        c.execute(
            "INSERT INTO favorites (user_id, track_id, kind, added_at) VALUES (?, ?, ?, ?)",
            (user_id, track_id, kind, datetime.utcnow().isoformat()),
        )
        return True


def is_favorited(user_id: str, track_id: str, kind: str) -> bool:
    r = _CONN.execute(
        "SELECT 1 FROM favorites WHERE user_id=? AND track_id=? AND kind=?",
        (user_id, track_id, kind),
    ).fetchone()
    return r is not None


def favorite_count(track_id: str, kind: str) -> int:
    r = _CONN.execute(
        "SELECT COUNT(*) AS n FROM favorites WHERE track_id=? AND kind=?",
        (track_id, kind),
    ).fetchone()
    return int(r["n"])


def list_user_favorites(user_id: str) -> list[dict]:
    rows = _CONN.execute(
        "SELECT track_id, kind, added_at FROM favorites WHERE user_id=? ORDER BY added_at DESC",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def user_favorite_ids(user_id: str, kind: str) -> set[str]:
    rows = _CONN.execute(
        "SELECT track_id FROM favorites WHERE user_id=? AND kind=?",
        (user_id, kind),
    ).fetchall()
    return {r["track_id"] for r in rows}


# ------------------------------------------------------------------
# Follows
# ------------------------------------------------------------------
def toggle_follow(follower_id: str, artist_id: str) -> bool:
    from datetime import datetime
    with _tx() as c:
        row = c.execute(
            "SELECT 1 FROM follows WHERE follower_id=? AND artist_id=?",
            (follower_id, artist_id),
        ).fetchone()
        if row:
            c.execute(
                "DELETE FROM follows WHERE follower_id=? AND artist_id=?",
                (follower_id, artist_id),
            )
            return False
        c.execute(
            "INSERT INTO follows (follower_id, artist_id, followed_at) VALUES (?, ?, ?)",
            (follower_id, artist_id, datetime.utcnow().isoformat()),
        )
        return True


def is_following(follower_id: str, artist_id: str) -> bool:
    r = _CONN.execute(
        "SELECT 1 FROM follows WHERE follower_id=? AND artist_id=?",
        (follower_id, artist_id),
    ).fetchone()
    return r is not None


def follower_count(artist_id: str) -> int:
    r = _CONN.execute(
        "SELECT COUNT(*) AS n FROM follows WHERE artist_id=?", (artist_id,)
    ).fetchone()
    return int(r["n"])


# ------------------------------------------------------------------
# Feedback
# ------------------------------------------------------------------
def add_feedback(user_id: str, track_id: str, mode: str, rating: int, session_minutes: int = 0) -> None:
    from datetime import datetime
    with _tx() as c:
        c.execute(
            "INSERT INTO feedback (user_id, track_id, mode, rating, session_minutes, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, track_id, mode, rating, session_minutes, datetime.utcnow().isoformat()),
        )


def feedback_aggregate() -> dict:
    """Return percent-positive and counts per mode."""
    rows = _CONN.execute(
        "SELECT mode, "
        "SUM(CASE WHEN rating > 0 THEN 1 ELSE 0 END) AS positives, "
        "COUNT(*) AS total "
        "FROM feedback WHERE mode IS NOT NULL AND rating != 0 GROUP BY mode"
    ).fetchall()
    out = {}
    for r in rows:
        total = int(r["total"]) or 1
        pos = int(r["positives"])
        out[r["mode"]] = {
            "positive_pct": round(pos * 100 / total),
            "total_responses": total,
        }
    return out


# ------------------------------------------------------------------
# Profiles
# ------------------------------------------------------------------
def get_profile(user_id: str) -> dict | None:
    r = _CONN.execute(
        "SELECT user_id, display_name, bio, picture, updated_at FROM profiles WHERE user_id=?",
        (user_id,),
    ).fetchone()
    return dict(r) if r else None


def upsert_profile(user_id: str, display_name: str | None, bio: str | None, picture: str | None) -> None:
    from datetime import datetime
    with _tx() as c:
        c.execute(
            "INSERT INTO profiles (user_id, display_name, bio, picture, updated_at) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "display_name = COALESCE(excluded.display_name, display_name), "
            "bio = COALESCE(excluded.bio, bio), "
            "picture = COALESCE(excluded.picture, picture), "
            "updated_at = excluded.updated_at",
            (user_id, display_name, bio, picture, datetime.utcnow().isoformat()),
        )


# ------------------------------------------------------------------
# Referrals
# ------------------------------------------------------------------
def get_referral_code_for_user(user_id: str) -> str | None:
    r = _CONN.execute(
        "SELECT code FROM referral_codes WHERE user_id = ?", (user_id,)
    ).fetchone()
    return r["code"] if r else None


def get_user_id_for_referral_code(code: str) -> str | None:
    r = _CONN.execute(
        "SELECT user_id FROM referral_codes WHERE code = ?", (code,)
    ).fetchone()
    return r["user_id"] if r else None


def create_referral_code(user_id: str, code: str) -> None:
    from datetime import datetime
    with _tx() as c:
        c.execute(
            "INSERT OR IGNORE INTO referral_codes (code, user_id, created_at) VALUES (?, ?, ?)",
            (code, user_id, datetime.utcnow().isoformat()),
        )


def record_referral_redemption(
    referrer_user_id: str,
    referred_user_id: str,
    code: str,
    stripe_session_id: str | None = None,
) -> bool:
    """Record a redemption. Returns False if this user already redeemed a referral."""
    from datetime import datetime
    with _tx() as c:
        try:
            c.execute(
                "INSERT INTO referral_redemptions "
                "(referrer_user_id, referred_user_id, code, stripe_session_id, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (referrer_user_id, referred_user_id, code, stripe_session_id,
                 datetime.utcnow().isoformat()),
            )
            return True
        except sqlite3.IntegrityError:
            return False


def user_has_redeemed_referral(user_id: str) -> bool:
    r = _CONN.execute(
        "SELECT 1 FROM referral_redemptions WHERE referred_user_id = ?", (user_id,)
    ).fetchone()
    return r is not None


def referral_count_for_user(user_id: str) -> int:
    r = _CONN.execute(
        "SELECT COUNT(*) AS n FROM referral_redemptions WHERE referrer_user_id = ?",
        (user_id,),
    ).fetchone()
    return int(r["n"])
