import { useEffect, useState } from "react";

export default function Pricing() {
  const user = localStorage.getItem("userId");
  const [userSub, setUserSub] = useState(null);

  useEffect(() => {
    if (!user) return;
    const fetchSubscription = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/user_subscriptions/${user}`);
        if (res.ok) {
          const data = await res.json();
          setUserSub(data);
        }
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
      }
    };
    fetchSubscription();
  }, [user]);

  const handleSubscribe = async (plan) => {
    if (!user) {
      alert("Please log in to subscribe.");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/create_subscription_session/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, plan }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Error creating subscription session.");
    }
  };

  const remainingTracks = userSub?.plan === "limited" ? 20 - (userSub.tracks_used || 0) : null;

  return (
    <div className="container">
      <section className="hero" style={{ marginTop: "40px", paddingBottom: "40px" }}>
        <h1 className="hero-title" style={{ fontSize: "48px" }}>Pricing</h1>
        <p className="hero-subtitle">Simple, transparent pricing for every kind of listener.</p>
      </section>

      <div className="card" style={{ marginBottom: "24px" }}>
        <h2 className="section-title" style={{ marginBottom: "8px" }}>Per Track</h2>
        <p style={{ color: "var(--zen-earth)", marginBottom: "12px" }}>
          Tracks are <strong style={{ color: "var(--zen-charcoal)" }}>$0.08 per MB</strong>.
          Popular tracks may have adjusted pricing based on demand.
        </p>
      </div>

      <div className="frequency-grid" style={{ margin: "24px 0" }}>
        <div className="card">
          <div className="frequency-hz">Limited</div>
          <div style={{ fontSize: "48px", fontWeight: 300, marginBottom: "8px" }}>$12.99</div>
          <div style={{ color: "var(--zen-earth)", fontSize: "13px", marginBottom: "24px" }}>/month</div>
          <p style={{ marginBottom: "24px", color: "var(--zen-earth)" }}>
            Up to 20 tracks per month.
          </p>
          {userSub && userSub.plan === "limited" && (
            <p style={{ color: "var(--zen-sage)", fontSize: "13px", marginBottom: "16px" }}>
              {remainingTracks} tracks remaining this month
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => handleSubscribe("limited")}
            disabled={userSub !== null}
          >
            {userSub && userSub.plan === "limited" ? "Current Plan" : "Subscribe"}
          </button>
        </div>

        <div className="card">
          <div className="frequency-hz">Unlimited</div>
          <div style={{ fontSize: "48px", fontWeight: 300, marginBottom: "8px" }}>$16.99</div>
          <div style={{ color: "var(--zen-earth)", fontSize: "13px", marginBottom: "24px" }}>/month</div>
          <p style={{ marginBottom: "24px", color: "var(--zen-earth)" }}>
            Unlimited tracks per month.
          </p>
          {userSub && userSub.plan === "unlimited" && (
            <p style={{ color: "var(--zen-sage)", fontSize: "13px", marginBottom: "16px" }}>
              Unlimited access
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => handleSubscribe("unlimited")}
            disabled={userSub !== null}
          >
            {userSub && userSub.plan === "unlimited" ? "Current Plan" : "Subscribe"}
          </button>
        </div>
      </div>
    </div>
  );
}
