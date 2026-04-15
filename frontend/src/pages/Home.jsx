import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import SpotifyAutocomplete from "../components/SpotifyAutocomplete.jsx";

const FREQUENCIES = [
  { id: "gamma",    name: "Gamma",    hertz: "30-100 Hz", icon: "🧠", desc: "High-level cognitive functioning" },
  { id: "alpha",    name: "Alpha",    hertz: "8-12 Hz",   icon: "✨", desc: "Relaxed focus & creativity" },
  { id: "beta",     name: "Beta",     hertz: "12-30 Hz",  icon: "⚡", desc: "Alertness & problem-solving" },
  { id: "theta",    name: "Theta",    hertz: "4-8 Hz",    icon: "🧘", desc: "Deep meditation & intuition" },
  { id: "delta",    name: "Delta",    hertz: "0.5-4 Hz",  icon: "😴", desc: "Deep sleep & recovery" },
  { id: "schumann", name: "Schumann", hertz: "7.83 Hz",   icon: "🌍", desc: "Earth's natural frequency" },
];

export default function Home() {
  const navigate = useNavigate();
  const [purchasedTracks, setPurchasedTracks] = useState([]);
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const USER_ID = user?.id;
  const MIN_PRICE_CENTS = 170;

  const ensurePriceCents = (track) => {
    if (track.price_cents !== undefined) return track;
    if (!track.size_bytes) track.size_bytes = 0;
    const sizeMB = track.size_bytes / (1024 * 1024);
    const pricePerMB = track.existing ? 0.06 : 0.08;
    let price_cents = Math.ceil(sizeMB * pricePerMB * 100);
    track.price_cents = Math.max(price_cents, MIN_PRICE_CENTS);
    if (track.custom_freqs) price_cents += 150;
    track.price_cents = price_cents;
    return track;
  };

  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [trackName, setTrackName] = useState("");
  const [mode, setMode] = useState("alpha");
  const [message, setMessage] = useState("");
  const [library, setLibrary] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewUser, setReviewUser] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [playlist, setPlaylist] = useState([]);
  const bannedWords = ["Fuck", "Fucking", "Shit", "Bastard", "Retard"];
  const [lastProcessed, setLastProcessed] = useState(null);
  const [tosAccepted, setTosAccepted] = useState(
    localStorage.getItem("tosAccepted") === "true"
  );

  const loadLibrary = () => {
    fetch(`${import.meta.env.VITE_API_URL}/library/`)
      .then(res => res.json())
      .then(data => {
        const pricedData = data.map(ensurePriceCents);
        const sorted = pricedData.sort((a, b) => b.plays - a.plays);
        setLibrary(sorted);
      })
      .catch(err => console.log("Failed to load library", err));
  };

  useEffect(() => { loadLibrary(); }, []);

  useEffect(() => {
    const wasReturningFromPolicy = sessionStorage.getItem("showTosPopup");
    if (wasReturningFromPolicy) {
      setTosAccepted(false);
      sessionStorage.removeItem("showTosPopup");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && !url) return alert("Upload a file or enter a URL");
    if (!trackName) return alert("Enter a track name");

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (url) formData.append("url", url);
    formData.append("track_name", trackName);
    formData.append("mode", mode);

    setMessage("Processing...");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/process_audio/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status !== "success") {
        setMessage("Error processing audio");
      } else {
        setMessage("Track processed successfully!");
        setFile(null);
        setUrl("");
        setTrackName("");

        const processedTrack = {
          name: data.track,
          mode: data.mode,
          filename_preview: data.filename_preview,
          filename_full: data.filename_full,
          size_bytes: data.size_bytes || 0,
          existing: false,
          custom_freqs: data.custom_freqs || false,
        };

        const pricedTrack = ensurePriceCents(processedTrack);
        setLastProcessed(pricedTrack);
        loadLibrary();
      }
    } catch (err) {
      setMessage("Upload failed: " + err.message);
    }
  };

  const handleBuy = async (track) => {
    if (!user || !user.id) {
      alert("You must be logged in to buy a track!");
      return;
    }
    try {
      if (track.price_cents === undefined)
        track.price_cents = ensurePriceCents(track).price_cents;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/create_checkout_session/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: {
            name: track.name,
            mode: track.mode,
            filename_full: track.filename_full,
            filename_preview: track.filename_preview,
            custom_freqs: track.custom_freqs || false,
            size_bytes: track.size_bytes || 0,
          },
          user_id: user.id,
          user_email: user.email,
        }),
      });
      const data = await res.json();

      if (!data.url) {
        alert(`Free user! Track "${data.track}" added to your library.`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error creating checkout session: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.log(err);
      alert("Payment failed: " + err.message);
    }
  };

  const handleAddToLibrary = async (track) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user_library/${USER_ID}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      if (res.ok) alert(`${track.name} added to your library!`);
      else alert("Failed to add track.");
    } catch (err) {
      console.log(err);
      alert("Error adding track to library.");
    }
  };

  const handleAddReview = (e) => {
    e.preventDefault();
    if (!reviewUser || !reviewComment) return alert("Enter name & comment");
    if (bannedWords.some(w => reviewComment.toLowerCase().includes(w.toLowerCase()))) {
      alert("Comment contains inappropriate language.");
      return;
    }
    setReviews(prev => [...prev, { user: reviewUser, rating: reviewRating, comment: reviewComment }]);
    setReviewUser(""); setReviewRating(5); setReviewComment("");
  };

  const addToPlaylist = (track) => setPlaylist(prev => [...prev, track]);

  return (
    <div className="container">
      {/* Hero */}
      <section className="hero">
        <h1 className="hero-title">
          Transform Your Music Into <span>Brain-Enhancing</span> Frequencies
        </h1>
        <p className="hero-subtitle">
          Upload any song and apply binaural beats for focus, creativity, meditation, and deep sleep.
        </p>
      </section>

      {/* 3-column: Upload | Frequencies | Library */}
      <div className="home-columns">
        {/* Upload */}
        <div className="card">
          <h2 className="section-title">Upload Track</h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Track Name</label>
              <SpotifyAutocomplete
                value={trackName}
                onChange={setTrackName}
                placeholder="Enter track name..."
              />
            </div>
            <div className="input-group">
              <label className="input-label">Frequency</label>
              <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
                {FREQUENCIES.map(f => (
                  <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">YouTube URL (Optional)</label>
              <input
                className="input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="input-group">
              <label className="input-label">Or Upload File</label>
              <input
                type="file"
                className="input"
                onChange={e => setFile(e.target.files[0])}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Process</button>
          </form>
          {message && <p style={{ marginTop: "16px", color: "var(--zen-earth)", fontSize: "14px" }}>{message}</p>}

          {lastProcessed && (
            <div className="card" style={{ marginTop: "24px", padding: "24px" }}>
              <div style={{ fontSize: "14px", marginBottom: "8px" }}>
                {lastProcessed.name} <span style={{ color: "var(--zen-earth)" }}>({lastProcessed.mode})</span>
              </div>
              <div style={{ color: "var(--zen-sage)", fontSize: "18px", fontWeight: 500, marginBottom: "12px" }}>
                ${((lastProcessed.price_cents) / 100).toFixed(2)}
              </div>
              <audio
                controls
                src={`${import.meta.env.VITE_API_URL}/library/file/${lastProcessed.filename_preview}`}
                style={{ width: "100%", marginBottom: "12px" }}
              />
              {purchasedTracks.includes(lastProcessed.filename_full) ? (
                <a
                  className="btn btn-primary"
                  href={`${import.meta.env.VITE_API_URL}/library/file/${lastProcessed.filename_full}`}
                  download={lastProcessed.filename_full}
                  style={{ display: "inline-block" }}
                >
                  Download
                </a>
              ) : (
                <button className="btn btn-primary" onClick={() => handleBuy(lastProcessed)}>
                  Buy to Download
                </button>
              )}
            </div>
          )}
        </div>

        {/* Frequencies */}
        <div>
          <h2 className="section-title">Frequencies</h2>
          <div className="frequency-list">
            {FREQUENCIES.map(freq => (
              <div
                key={freq.id}
                className="frequency-item"
                onClick={() => navigate(`/about#${freq.id}`)}
              >
                <div className="frequency-item-icon">{freq.icon}</div>
                <div style={{ flex: 1 }}>
                  <div>
                    <span className="frequency-item-name">{freq.name}</span>
                    <span className="frequency-item-hz" style={{ marginLeft: "10px" }}>{freq.hertz}</span>
                  </div>
                  <div className="frequency-item-desc">{freq.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Library */}
        <div>
          <h2 className="section-title">Library</h2>
          {library.length === 0 ? (
            <p style={{ color: "var(--zen-earth)" }}>No tracks available.</p>
          ) : (
            library.map((track, i) => (
              <div key={i} className="track-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <div className="track-meta">
                    <span className="track-name">{track.name}</span>
                    <span className="track-mode">{track.mode} • {track.plays} plays • ${((track.price_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                  <button className="btn btn-sm" onClick={() => handleBuy(track)}>Buy</button>
                </div>
                <audio
                  controls
                  src={`${import.meta.env.VITE_API_URL}/library/file/${track.filename_preview}?user_id=${USER_ID}`}
                  onPlay={() => {
                    fetch(`${import.meta.env.VITE_API_URL}/track_event/`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "audio_play", track: track.name }),
                    });
                  }}
                  style={{ width: "100%" }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Playlist */}
      {playlist.length > 0 && (
        <>
          <div className="divider" />
          <section>
            <h2 className="section-title">Playlist</h2>
            {playlist.map((track, i) => (
              <div key={i} className="track-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="track-meta" style={{ marginBottom: "8px" }}>
                  <span className="track-name">{track.name}</span>
                  <span className="track-mode">{track.mode}</span>
                </div>
                <audio controls src={`${import.meta.env.VITE_API_URL}/library/file/${track.filename_full}`} style={{ width: "100%" }} />
              </div>
            ))}
          </section>
        </>
      )}

      {/* Reviews */}
      <div className="divider" />
      <section>
        <h2 className="section-title">Reviews</h2>
        <form onSubmit={handleAddReview} className="card" style={{ marginBottom: "32px" }}>
          <div className="input-group">
            <label className="input-label">Name</label>
            <input className="input" placeholder="Your name" value={reviewUser} onChange={e => setReviewUser(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Rating</label>
            <select className="input" value={reviewRating} onChange={e => setReviewRating(+e.target.value)}>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ⭐</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Comment</label>
            <input className="input" placeholder="Share your experience..." value={reviewComment} onChange={e => setReviewComment(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Add Review</button>
        </form>

        {reviews.length === 0 ? (
          <p style={{ color: "var(--zen-earth)" }}>No reviews yet.</p>
        ) : (
          reviews.map((r, i) => (
            <div key={i} className="review-card">
              <div className="review-head">
                <strong>{r.user}</strong>
                <span className="review-rating">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              <p className="review-body">{r.comment}</p>
            </div>
          ))
        )}
      </section>

      {/* TOS Modal */}
      {user && !tosAccepted && (
        <div className="zen-modal-backdrop">
          <div className="zen-modal">
            <h2>Welcome</h2>
            <p>
              Please review our <Link to="/terms">Terms of Service</Link>,{" "}
              <Link to="/privacy">Privacy Policy</Link>, and <Link to="/dmca">DMCA Policy</Link> before continuing.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setTosAccepted(true);
                localStorage.setItem("tosAccepted", "true");
              }}
            >
              I Agree
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
