import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import MultiTrackMixer from "../components/tools/MultiTrackMixer.jsx";
import BeatSequencer from "../components/tools/BeatSequencer.jsx";
import EffectsProcessor from "../components/tools/EffectsProcessor.jsx";
import SpotifyAutocomplete from "../components/SpotifyAutocomplete.jsx";
import HeartButton from "../components/HeartButton.jsx";

const TABS = ["Upload", "Browse", "Mixer", "Beat Maker", "Effects"];
const GENRES = ["ambient", "electronic", "lo-fi", "classical", "meditation", "nature", "hip-hop", "rock", "pop", "other"];

export default function MusicTools() {
  const [activeTab, setActiveTab] = useState("Upload");

  const [file, setFile] = useState(null);
  const [trackName, setTrackName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("ambient");
  const [description, setDescription] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [myUploads, setMyUploads] = useState([]);
  const [communityTracks, setCommunityTracks] = useState([]);

  // Search state
  const [searchQ, setSearchQ] = useState("");
  const [filterGenre, setFilterGenre] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const USER_ID = user?.id;
  const API = import.meta.env.VITE_API_URL;

  const loadCommunity = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQ) params.append("q", searchQ);
    if (filterGenre) params.append("genre", filterGenre);
    const url = params.toString() ? `${API}/community/search?${params}` : `${API}/community/`;
    fetch(url)
      .then(r => r.json())
      .then(data => setCommunityTracks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [API, searchQ, filterGenre]);

  useEffect(() => {
    if (USER_ID) {
      fetch(`${API}/community/all/${USER_ID}`)
        .then(r => r.json())
        .then(data => setMyUploads(Array.isArray(data) ? data : []))
        .catch(() => {});
      fetch(`${API}/favorites/ids/${USER_ID}/community`)
        .then(r => r.json())
        .then(ids => setFavoriteIds(new Set(Array.isArray(ids) ? ids : [])))
        .catch(() => {});
    }
  }, [USER_ID, API]);

  useEffect(() => {
    const t = setTimeout(loadCommunity, 250);
    return () => clearTimeout(t);
  }, [loadCommunity]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !trackName || !artistName) return alert("Fill in all required fields");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("track_name", trackName);
    formData.append("artist_name", artistName);
    formData.append("genre", genre);
    formData.append("description", description);
    formData.append("user_id", USER_ID);

    setUploadMessage("Uploading...");
    try {
      const res = await fetch(`${API}/community/upload/`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Server ${res.status}: ${res.statusText || "upload rejected"}`);
      const data = await res.json();
      if (data.status === "success") {
        setUploadMessage("Upload successful! Your track is pending review.");
        setFile(null);
        setTrackName("");
        setDescription("");
        const refreshed = await fetch(`${API}/community/all/${USER_ID}`).then(r => r.json());
        setMyUploads(Array.isArray(refreshed) ? refreshed : []);
      } else {
        setUploadMessage("Upload failed: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      setUploadMessage("Upload failed: " + err.message);
    }
  };

  const handleBuyCommunity = async (track) => {
    if (!USER_ID) return alert("You must be logged in");
    try {
      const res = await fetch(`${API}/create_community_checkout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: track.id, user_id: USER_ID, user_email: user?.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.detail || "Checkout failed");
    } catch (err) {
      alert("Payment failed: " + err.message);
    }
  };

  const statusColor = (s) => s === "approved" ? "var(--zen-sage)" : s === "rejected" ? "var(--zen-coral)" : "var(--zen-earth)";

  return (
    <div className="container">
      <section className="hero" style={{ marginTop: "20px", paddingBottom: "20px" }}>
        <h1 className="hero-title" style={{ fontSize: "42px" }}>Music Tools</h1>
        <p className="hero-subtitle">Upload original tracks, layer stems, build beats, and apply effects.</p>
      </section>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "0", borderBottom: "1px solid rgba(196, 181, 157, 0.3)" }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 24px",
              cursor: "pointer",
              background: activeTab === tab ? "var(--zen-sage)" : "transparent",
              color: activeTab === tab ? "white" : "var(--zen-charcoal)",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--zen-sage)" : "2px solid transparent",
              fontSize: "13px",
              fontWeight: activeTab === tab ? 500 : 400,
              letterSpacing: "1px",
              textTransform: "lowercase",
              transition: "all 0.3s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="card" style={{ borderRadius: 0, padding: "32px" }}>
        {activeTab === "Upload" && (
          <div>
            <h3 className="section-title" style={{ fontSize: "22px" }}>Upload Original Content</h3>
            <p style={{ fontSize: "13px", color: "var(--zen-earth)", marginBottom: "24px" }}>
              Share your music with the Soundara community. Uploads are reviewed before publishing.
            </p>

            <form onSubmit={handleUpload} style={{ maxWidth: "560px" }}>
              <div className="input-group">
                <label className="input-label">Audio File *</label>
                <input type="file" accept="audio/*" className="input" onChange={e => setFile(e.target.files[0])} />
              </div>
              <div className="input-group">
                <label className="input-label">Track Name *</label>
                <SpotifyAutocomplete value={trackName} onChange={setTrackName} placeholder="Track name" />
              </div>
              <div className="input-group">
                <label className="input-label">Artist Name *</label>
                <input className="input" value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Your artist name" />
              </div>
              <div className="input-group">
                <label className="input-label">Genre</label>
                <select className="input" value={genre} onChange={e => setGenre(e.target.value)}>
                  {GENRES.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Description (optional)</label>
                <textarea className="input" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your track..." maxLength={500}
                  style={{ minHeight: "80px", resize: "vertical" }} />
              </div>
              <button type="submit" className="btn btn-primary">Upload</button>
            </form>
            {uploadMessage && (
              <p style={{ marginTop: "16px", color: uploadMessage.includes("success") ? "var(--zen-sage)" : "var(--zen-coral)" }}>
                {uploadMessage}
              </p>
            )}

            {myUploads.length > 0 && (
              <div style={{ marginTop: "40px" }}>
                <h4 className="section-title" style={{ fontSize: "18px" }}>Your Uploads</h4>
                {myUploads.map(track => (
                  <div key={track.id} className="track-row">
                    <div className="track-meta">
                      <span className="track-name">{track.name}</span>
                      <span className="track-mode">{track.genre}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: statusColor(track.status), fontWeight: 600, letterSpacing: "1px" }}>
                      {track.status.toUpperCase()}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--zen-earth)" }}>{track.plays} plays</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {activeTab === "Browse" && (
          <div>
            <h3 className="section-title" style={{ fontSize: "22px" }}>Browse Community Tracks</h3>

            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
              <input
                className="input"
                style={{ flex: "2 1 240px", minWidth: "200px" }}
                placeholder="Search by name, artist, or description..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <select
                className="input"
                style={{ flex: "0 1 200px", minWidth: "140px" }}
                value={filterGenre}
                onChange={e => setFilterGenre(e.target.value)}
              >
                <option value="">All genres</option>
                {GENRES.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>

            {communityTracks.length === 0 ? (
              <p style={{ color: "var(--zen-earth)" }}>
                {searchQ || filterGenre ? "No tracks match your filters." : "No community tracks yet."}
              </p>
            ) : (
              communityTracks.map(track => (
                <div key={track.id} className="track-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="track-meta" style={{ flex: 1 }}>
                      <span className="track-name">
                        {track.name}{" "}
                        <Link
                          to={`/artist/${track.artist_id}`}
                          style={{ color: "var(--zen-earth)", fontSize: "12px", textDecoration: "none" }}
                        >
                          by {track.artist}
                        </Link>
                      </span>
                      <span className="track-mode">{track.genre}</span>
                    </div>
                    <HeartButton
                      trackId={track.id}
                      kind="community"
                      userId={USER_ID}
                      initialFavorited={favoriteIds.has(track.id)}
                    />
                    <button className="btn btn-sm" onClick={() => handleBuyCommunity(track)}>$1.99</button>
                  </div>
                  <audio controls src={`${API}/community/file/${track.filename_preview}`} style={{ width: "100%" }} />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "Mixer" && <MultiTrackMixer />}
        {activeTab === "Beat Maker" && <BeatSequencer />}
        {activeTab === "Effects" && <EffectsProcessor />}
      </div>
    </div>
  );
}
