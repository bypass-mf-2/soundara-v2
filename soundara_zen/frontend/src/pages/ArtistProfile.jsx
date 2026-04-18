import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import HeartButton from "../components/HeartButton.jsx";

export default function ArtistProfile() {
  const { userId } = useParams();
  const viewer = JSON.parse(localStorage.getItem("user") || "null");
  const VIEWER_ID = viewer?.id;
  const API = import.meta.env.VITE_API_URL;
  const isOwner = VIEWER_ID === userId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const load = () => {
    const url = VIEWER_ID
      ? `${API}/artist/${userId}?viewer_id=${VIEWER_ID}`
      : `${API}/artist/${userId}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setDisplayName(d?.profile?.display_name || "");
        setBio(d?.profile?.bio || "");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId, VIEWER_ID]);

  const handleFollow = async () => {
    if (!VIEWER_ID || VIEWER_ID === userId) return;
    try {
      const r = await fetch(`${API}/artist/${userId}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follower_id: VIEWER_ID }),
      });
      const d = await r.json();
      setData(prev => ({ ...prev, is_following: d.following, follower_count: d.follower_count }));
    } catch {}
  };

  const handleSaveProfile = async () => {
    try {
      await fetch(`${API}/artist/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewer_id: VIEWER_ID, display_name: displayName, bio }),
      });
      setEditing(false);
      load();
    } catch (err) {
      alert("Failed to save: " + err.message);
    }
  };

  if (loading) return <div className="container"><p style={{ color: "var(--zen-earth)" }}>Loading...</p></div>;
  if (!data) return <div className="container"><p style={{ color: "var(--zen-earth)" }}>Artist not found.</p></div>;

  const name = data.profile?.display_name || (data.tracks[0]?.artist) || "Unnamed Artist";

  return (
    <div className="container">
      <section className="card" style={{ marginTop: "20px", padding: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "var(--zen-cream)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "48px",
              fontWeight: 300,
              color: "var(--zen-sage)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {data.profile?.picture ? (
              <img src={data.profile.picture} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ flex: 1, minWidth: "240px" }}>
            {editing ? (
              <>
                <input
                  className="input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  style={{ marginBottom: "12px" }}
                />
                <textarea
                  className="input"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Short bio"
                  maxLength={500}
                  style={{ minHeight: "80px", resize: "vertical", marginBottom: "12px" }}
                />
                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveProfile}>Save</button>
                  <button className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: "36px", fontWeight: 300, margin: 0, color: "var(--zen-charcoal)" }}>{name}</h1>
                {data.profile?.bio && (
                  <p style={{ color: "var(--zen-earth)", marginTop: "12px", lineHeight: 1.7 }}>{data.profile.bio}</p>
                )}
                <div style={{ display: "flex", gap: "20px", marginTop: "20px", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "22px", fontWeight: 400, color: "var(--zen-charcoal)" }}>{data.follower_count}</div>
                    <div style={{ fontSize: "11px", color: "var(--zen-earth)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                      Followers
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "22px", fontWeight: 400, color: "var(--zen-charcoal)" }}>{data.tracks.length}</div>
                    <div style={{ fontSize: "11px", color: "var(--zen-earth)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                      Tracks
                    </div>
                  </div>
                  {isOwner ? (
                    <button className="btn btn-sm" onClick={() => setEditing(true)} style={{ marginLeft: "auto" }}>
                      Edit Profile
                    </button>
                  ) : VIEWER_ID ? (
                    <button
                      className={data.is_following ? "btn btn-sm" : "btn btn-primary btn-sm"}
                      onClick={handleFollow}
                      style={{ marginLeft: "auto" }}
                    >
                      {data.is_following ? "Following" : "Follow"}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="divider" />

      <section>
        <h2 className="section-title" style={{ fontSize: "22px" }}>Tracks</h2>
        {data.tracks.length === 0 ? (
          <p style={{ color: "var(--zen-earth)" }}>No published tracks yet.</p>
        ) : (
          data.tracks.map(track => (
            <div key={track.id} className="track-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="track-meta" style={{ flex: 1 }}>
                  <span className="track-name">{track.name}</span>
                  <span className="track-mode">{track.genre} • {track.plays} plays</span>
                </div>
                <HeartButton trackId={track.id} kind="community" userId={VIEWER_ID} />
              </div>
              <audio controls src={`${API}/community/file/${track.filename_preview}`} style={{ width: "100%" }} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
