import { useState, useEffect } from "react";

export default function CreatorDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const USER_ID = user?.id;
  const API = import.meta.env.VITE_API_URL;

  const [onboardStatus, setOnboardStatus] = useState({ onboarded: false, has_account: false });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!USER_ID) return;
    Promise.all([
      fetch(`${API}/creator/onboard/status/${USER_ID}`).then(r => r.json()),
      fetch(`${API}/creator/dashboard/${USER_ID}`).then(r => r.json()),
    ])
      .then(([status, dash]) => {
        setOnboardStatus(status);
        setDashboard(dash);
      })
      .catch(err => console.error("Failed to load creator data:", err))
      .finally(() => setLoading(false));
  }, [USER_ID]);

  const handleOnboard = async () => {
    try {
      const res = await fetch(`${API}/creator/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, email: user?.email, name: user?.name }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to start onboarding: " + (data.detail || "Unknown error"));
      }
    } catch (err) {
      alert("Onboarding failed: " + err.message);
    }
  };

  if (!USER_ID) return (
    <div className="container">
      <p style={{ color: "var(--zen-earth)" }}>Please log in to access the Creator Dashboard.</p>
    </div>
  );
  if (loading) return (
    <div className="container">
      <p style={{ color: "var(--zen-earth)" }}>Loading...</p>
    </div>
  );

  const statusColor = (s) => s === "approved" ? "var(--zen-sage)" : s === "rejected" ? "var(--zen-coral)" : "var(--zen-earth)";

  return (
    <div className="container">
      <section className="hero" style={{ marginTop: "20px", paddingBottom: "20px" }}>
        <h1 className="hero-title" style={{ fontSize: "42px" }}>Creator Dashboard</h1>
        <p className="hero-subtitle">Track earnings and manage your uploads.</p>
      </section>

      {/* Stripe Connect status */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <h3 className="section-title" style={{ fontSize: "20px" }}>Payment Setup</h3>
        {onboardStatus.onboarded ? (
          <p style={{ color: "var(--zen-sage)" }}>
            ✓ Stripe Connect is active. You'll receive 70% of each sale automatically.
          </p>
        ) : (
          <div>
            <p style={{ color: "var(--zen-earth)", marginBottom: "16px" }}>
              Connect your Stripe account to receive payments when users purchase your tracks.
              You'll receive 70% of each sale, with 30% going to the platform.
            </p>
            <button className="btn btn-primary" onClick={handleOnboard}>
              {onboardStatus.has_account ? "Complete Stripe Setup" : "Connect with Stripe"}
            </button>
          </div>
        )}
      </div>

      {/* Earnings overview */}
      {dashboard && (
        <div className="frequency-grid" style={{ margin: "24px 0" }}>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", fontWeight: 300, color: "var(--zen-sage)" }}>
              {dashboard.tracks?.length || 0}
            </div>
            <div style={{ fontSize: "12px", color: "var(--zen-earth)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "6px" }}>
              Tracks Uploaded
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", fontWeight: 300, color: "var(--zen-ocean)" }}>
              {dashboard.total_plays}
            </div>
            <div style={{ fontSize: "12px", color: "var(--zen-earth)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "6px" }}>
              Total Plays
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", fontWeight: 300, color: "var(--zen-coral)" }}>
              ${(dashboard.balance_available_cents / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "12px", color: "var(--zen-earth)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "6px" }}>
              Available Balance
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "40px", fontWeight: 300, color: "var(--zen-earth)" }}>
              ${(dashboard.balance_pending_cents / 100).toFixed(2)}
            </div>
            <div style={{ fontSize: "12px", color: "var(--zen-earth)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "6px" }}>
              Pending Balance
            </div>
          </div>
        </div>
      )}

      {/* Tracks */}
      {dashboard?.tracks?.length > 0 && (
        <section>
          <h3 className="section-title" style={{ fontSize: "22px" }}>Your Tracks</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.3)" }}>
                <th style={{ textAlign: "left", padding: "12px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 500 }}>Track</th>
                <th style={{ textAlign: "left", padding: "12px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 500 }}>Genre</th>
                <th style={{ textAlign: "center", padding: "12px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: "center", padding: "12px 8px", color: "var(--zen-earth)", fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 500 }}>Plays</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.tracks.map(track => (
                <tr key={track.id} style={{ borderBottom: "1px solid rgba(196, 181, 157, 0.15)" }}>
                  <td style={{ padding: "14px 8px", color: "var(--zen-charcoal)" }}>
                    {track.name}
                    {track.description && (
                      <p style={{ fontSize: "11px", color: "var(--zen-earth)", margin: "4px 0 0" }}>{track.description}</p>
                    )}
                  </td>
                  <td style={{ padding: "14px 8px", color: "var(--zen-earth)" }}>{track.genre}</td>
                  <td style={{ padding: "14px 8px", textAlign: "center" }}>
                    <span style={{ color: statusColor(track.status), fontSize: "11px", fontWeight: 600, letterSpacing: "1px" }}>
                      {track.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "14px 8px", textAlign: "center", color: "var(--zen-charcoal)" }}>{track.plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {dashboard?.tracks?.length === 0 && (
        <p style={{ color: "var(--zen-earth)" }}>
          You haven't uploaded any tracks yet. Head to Music Tools to upload your first track.
        </p>
      )}
    </div>
  );
}
