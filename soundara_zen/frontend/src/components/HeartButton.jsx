import { useState, useEffect } from "react";

/**
 * Toggle-favorite heart button.
 *
 * Props:
 *   trackId: string        — ID for community uploads, filename_full for library
 *   kind:    "community" | "library"
 *   userId:  string | null
 *   initialFavorited: bool (optional — avoids a flicker if parent already knows)
 */
export default function HeartButton({ trackId, kind, userId, initialFavorited = false, size = 20 }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (!userId || busy) return;
    setBusy(true);
    const optimistic = !favorited;
    setFavorited(optimistic);
    try {
      const r = await fetch(`${API}/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, track_id: trackId, kind }),
      });
      const data = await r.json();
      if (typeof data.favorited === "boolean") setFavorited(data.favorited);
    } catch {
      setFavorited(!optimistic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      disabled={!userId}
      style={{
        background: "transparent",
        border: "none",
        cursor: userId ? "pointer" : "not-allowed",
        padding: "4px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: favorited ? "var(--zen-coral)" : "var(--zen-earth)",
        fontSize: `${size}px`,
        transition: "transform 0.15s ease",
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.9)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
