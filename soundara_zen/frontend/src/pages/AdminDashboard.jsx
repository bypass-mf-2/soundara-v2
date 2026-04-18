import { useState, useEffect } from "react";

const ADMIN_EMAIL = "trevorm.goodwill@gmail.com";

export default function AdminDashboard() {
  const [user] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (user?.email !== ADMIN_EMAIL) return;
    const adminToken = localStorage.getItem("admin_token") || "";
    fetch(`${API}/admin/stats`, {
      headers: { "X-Admin-Token": adminToken },
    })
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, API]);

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="container" style={{ display: "flex", justifyContent: "center", minHeight: "60vh", alignItems: "center" }}>
        <div className="card" style={{ textAlign: "center", padding: "48px 40px" }}>
          <h2 style={{ fontWeight: 300 }}>Access Denied</h2>
          <p style={{ color: "var(--zen-earth)", marginTop: "12px" }}>This area is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="container"><p style={{ color: "var(--zen-earth)" }}>Loading dashboard...</p></div>;
  if (!stats) return (
    <div className="container">
      <p style={{ color: "var(--zen-earth)" }}>
        Failed to load stats. Make sure the <code>ADMIN_API_TOKEN</code> env var is set on the server
        and you have set <code>admin_token</code> in localStorage.
      </p>
    </div>
  );

  const tabs = ["overview", "events", "library", "subscriptions", "moderation"];

  const pillColors = {
    login:      { bg: "rgba(139, 168, 136, 0.15)", fg: "var(--zen-sage)" },
    audio_play: { bg: "rgba(108, 155, 209, 0.15)", fg: "var(--zen-ocean)" },
    default:    { bg: "rgba(196, 181, 157, 0.15)", fg: "var(--zen-earth)" },
  };

  const statBoxes = [
    { label: "Total Tracks", value: stats.total_tracks, color: "var(--zen-sage)" },
    { label: "Total Users", value: stats.total_users, color: "var(--zen-ocean)" },
    { label: "Total Plays", value: stats.total_plays, color: "var(--zen-coral)" },
    { label: "Unique Visitors", value: stats.unique_visitors, color: "var(--zen-earth)" },
    { label: "Active Subs", value: stats.active_subscriptions, color: "var(--zen-sage)" },
    { label: "Total Events", value: stats.total_events, color: "var(--zen-ocean)" },
  ];

  const handleModerate = async (trackId, action) => {
    await fetch(`${API}/community/moderate/${trackId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": localStorage.getItem("admin_token") || "",
      },
      body: JSON.stringify({ action }),
    });
    window.location.reload();
  };

  return (
    <div className="container">
      <section className="hero" style={{ marginTop: "20px", paddingBottom: "20px" }}>
        <h1 className="hero-title" style={{ fontSize: "42px" }}>Admin Dashboard</h1>
        <p className="hero-subtitle">Platform statistics and moderation.</p>
      </section>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: "32px", borderBottom: "1px solid rgba(196, 181, 157, 0.3)" }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 24px",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--zen-sage)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab ? "var(--zen-sage)" : "var(--zen-earth)",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 500 : 400,
              textTransform: "lowercase",
              letterSpacing: "1px",
              fontSize: "13px",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div>
          <div className="frequency-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "20px", margin: "0 0 40px" }}>
            {statBoxes.map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                <div style={{ fontSize: "36px", fontWeight: 300, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: "11px", color: "var(--zen-earth)", marginTop: "6px", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <h3 className="section-title" style={{ fontSize: "20px" }}>Event Breakdown</h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "40px" }}>
            {Object.entries(stats.event_breakdown || {}).map(([type, count]) => (
              <div key={type} className="tag">
                <strong>{type}</strong>: {count}
              </div>
            ))}
          </div>

          <h3 className="section-title" style={{ fontSize: "20px" }}>Daily Activity (Last 14 Days)</h3>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "140px", padding: "16px", background: "white", border: "1px solid rgba(196, 181, 157, 0.2)" }}>
            {Object.entries(stats.daily_events || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-14)
              .map(([date, count]) => {
                const maxCount = Math.max(...Object.values(stats.daily_events || { "": 1 }));
                const height = Math.max(4, (count / maxCount) * 100);
                return (
                  <div key={date} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div
                      title={`${date}: ${count} events`}
                      style={{ width: "100%", height: `${height}%`, backgroundColor: "var(--zen-sage)", minWidth: "20px" }}
                    />
                    <div style={{ fontSize: "9px", color: "var(--zen-earth)", marginTop: "6px" }}>{date.slice(5)}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Events */}
      {activeTab === "events" && (
        <div>
          <h3 className="section-title" style={{ fontSize: "20px" }}>Recent Events (Last 50)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.3)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Time</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Type</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>User</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent_events || []).map((ev, i) => {
                const colors = pillColors[ev.type] || pillColors.default;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.15)" }}>
                    <td style={{ padding: "8px", color: "var(--zen-earth)" }}>{ev.timestamp?.slice(0, 16).replace("T", " ")}</td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ padding: "3px 10px", fontSize: "11px", background: colors.bg, color: colors.fg, letterSpacing: "0.5px" }}>
                        {ev.type}
                      </span>
                    </td>
                    <td style={{ padding: "8px", color: "var(--zen-charcoal)" }}>{ev.name || ev.user || "-"}</td>
                    <td style={{ padding: "8px", color: "var(--zen-earth)" }}>{ev.track || ev.page || ev.email || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Library */}
      {activeTab === "library" && (
        <div>
          <h3 className="section-title" style={{ fontSize: "20px" }}>All Tracks ({stats.library?.length || 0})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.3)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Name</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Mode</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Plays</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Size</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats.library || [])
                .sort((a, b) => (b.plays || 0) - (a.plays || 0))
                .map((track, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.15)" }}>
                    <td style={{ padding: "8px", color: "var(--zen-charcoal)" }}>{track.name}</td>
                    <td style={{ padding: "8px", color: "var(--zen-sage)" }}>{track.mode}</td>
                    <td style={{ padding: "8px", color: "var(--zen-charcoal)" }}>{track.plays || 0}</td>
                    <td style={{ padding: "8px", color: "var(--zen-earth)" }}>{((track.size_bytes || 0) / 1024 / 1024).toFixed(1)} MB</td>
                    <td style={{ padding: "8px", color: "var(--zen-earth)" }}>{track.timestamp?.slice(0, 10)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscriptions */}
      {activeTab === "subscriptions" && (
        <div>
          <h3 className="section-title" style={{ fontSize: "20px" }}>Active Subscriptions ({Object.keys(stats.subscriptions || {}).length})</h3>
          {Object.keys(stats.subscriptions || {}).length === 0 ? (
            <p style={{ color: "var(--zen-earth)" }}>No active subscriptions yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.3)" }}>
                  <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>User ID</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Plan</th>
                  <th style={{ textAlign: "left", padding: "10px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.subscriptions || {}).map(([userId, sub], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.15)" }}>
                    <td style={{ padding: "8px", fontFamily: "monospace", fontSize: "11px", color: "var(--zen-earth)" }}>{userId.slice(0, 12)}...</td>
                    <td style={{ padding: "8px", color: "var(--zen-sage)" }}>{sub.plan || sub.type || "unknown"}</td>
                    <td style={{ padding: "8px", color: "var(--zen-earth)" }}>{JSON.stringify(sub).slice(0, 80)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Moderation */}
      {activeTab === "moderation" && (
        <div>
          <h3 className="section-title" style={{ fontSize: "20px" }}>Pending Uploads ({stats.pending_uploads?.length || 0})</h3>
          {(stats.pending_uploads || []).length === 0 ? (
            <p style={{ color: "var(--zen-earth)" }}>No uploads pending review.</p>
          ) : (
            stats.pending_uploads.map(track => (
              <div key={track.id} className="card" style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <strong>{track.name}</strong>
                    <span style={{ color: "var(--zen-earth)", fontSize: "13px", marginLeft: "8px" }}>by {track.artist}</span>
                    <span style={{ marginLeft: "12px", color: "var(--zen-earth)", fontSize: "12px" }}>
                      {track.genre} · {track.timestamp?.slice(0, 10)}
                    </span>
                    {track.description && (
                      <p style={{ color: "var(--zen-earth)", fontSize: "13px", margin: "6px 0 0" }}>{track.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleModerate(track.id, "approved")}>Approve</button>
                    <button className="btn btn-sm" style={{ borderColor: "var(--zen-coral)", color: "var(--zen-coral)" }} onClick={() => handleModerate(track.id, "rejected")}>Reject</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
