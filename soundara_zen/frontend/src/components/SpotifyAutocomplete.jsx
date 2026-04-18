import { useState, useEffect, useRef } from "react";

/**
 * Track Name input with Spotify-backed autocomplete.
 *
 * Selecting a suggestion sets the value to "Track Name - Artist".
 * If SPOTIFY_CLIENT_ID/SECRET aren't configured on the server, the
 * endpoint returns [] and this degrades gracefully to a plain input.
 */
export default function SpotifyAutocomplete({ value, onChange, placeholder = "Enter track name..." }) {
  const [results, setResults] = useState([]);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!value || value.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/spotify/search?q=${encodeURIComponent(value)}&limit=6`);
        const data = await r.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [value, API]);

  const pick = (s) => {
    const composite = `${s.name} - ${s.artist}`;
    onChange(composite);
    setShowList(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowList(true); }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 200)}
        placeholder={placeholder}
      />
      {showList && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid rgba(196, 181, 157, 0.3)",
            borderTop: "none",
            maxHeight: "280px",
            overflowY: "auto",
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
          }}
        >
          {results.map((r) => (
            <div
              key={r.id}
              onMouseDown={() => pick(r)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                cursor: "pointer",
                borderBottom: "1px solid rgba(196, 181, 157, 0.15)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--zen-cream)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
            >
              {r.image && <img src={r.image} alt="" style={{ width: "40px", height: "40px", objectFit: "cover" }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", color: "var(--zen-charcoal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--zen-earth)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.artist}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {loading && value.length >= 2 && results.length === 0 && (
        <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", color: "var(--zen-earth)" }}>
          searching…
        </div>
      )}
    </div>
  );
}
