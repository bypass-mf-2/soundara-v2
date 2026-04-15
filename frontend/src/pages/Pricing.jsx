import { useEffect, useState } from "react";

export default function Pricing() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const USER_ID = user?.id;
  const [userSub, setUserSub] = useState(null);
  const [billing, setBilling] = useState("monthly");
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!USER_ID) return;
    const fetchSubscription = async () => {
      try {
        const res = await fetch(`${API}/user_subscriptions/${USER_ID}`);
        if (res.ok) {
          const data = await res.json();
          setUserSub(data);
        }
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
      }
    };
    fetchSubscription();
  }, [USER_ID, API]);

  const handleSubscribe = async (plan) => {
    if (!USER_ID) {
      alert("Please log in to subscribe.");
      return;
    }
    try {
      const response = await fetch(`${API}/create_subscription_session/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, plan }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Error creating subscription session.");
    }
  };

  const currentPlan = userSub?.plan;
  const isAnnual = billing === "annual";

  const proPlanId = isAnnual ? "pro_annual" : "pro";
  const creatorPlanId = isAnnual ? "creator_annual" : "creator";

  const proPrice = isAnnual ? "$39.99" : "$4.99";
  const creatorPrice = isAnnual ? "$79.99" : "$9.99";
  const priceSuffix = isAnnual ? "/year" : "/month";

  const proMonthlyEquiv = isAnnual ? "$3.33/mo" : null;
  const creatorMonthlyEquiv = isAnnual ? "$6.67/mo" : null;

  const toggleStyle = (active) => ({
    padding: "10px 24px",
    border: active ? "1px solid var(--zen-sage)" : "1px solid rgba(196, 181, 157, 0.3)",
    background: active ? "var(--zen-sage)" : "transparent",
    color: active ? "white" : "var(--zen-charcoal)",
    fontSize: "13px",
    letterSpacing: "1px",
    textTransform: "lowercase",
    cursor: "pointer",
    transition: "all 0.3s ease",
  });

  return (
    <div className="container">
      <section className="hero" style={{ marginTop: "40px", paddingBottom: "20px" }}>
        <h1 className="hero-title" style={{ fontSize: "48px" }}>Pricing</h1>
        <p className="hero-subtitle">Start free. Upgrade when you're ready.</p>
        <p style={{ color: "var(--zen-sage)", fontSize: "13px", letterSpacing: "1px", marginTop: "8px" }}>
          ✨ 3-day free trial on all paid plans
        </p>
      </section>

      {/* Billing toggle */}
      <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: "40px" }}>
        <button style={toggleStyle(billing === "monthly")} onClick={() => setBilling("monthly")}>
          Monthly
        </button>
        <button style={toggleStyle(billing === "annual")} onClick={() => setBilling("annual")}>
          Annual <span style={{ marginLeft: "6px", fontSize: "10px", opacity: 0.9 }}>save 33%</span>
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "24px",
          margin: "0 0 40px",
        }}
      >
        {/* Free */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="frequency-hz">Free</div>
          <div style={{ fontSize: "48px", fontWeight: 300, marginBottom: "4px" }}>$0</div>
          <div style={{ color: "var(--zen-earth)", fontSize: "13px", marginBottom: "24px" }}>forever</div>
          <ul style={{ listStyle: "none", padding: 0, color: "var(--zen-earth)", fontSize: "14px", lineHeight: 2, flex: 1 }}>
            <li>✓ Upload + transform any track</li>
            <li>✓ 15-second previews only</li>
            <li>✓ Listen to community tracks</li>
            <li style={{ opacity: 0.5 }}>— No full downloads</li>
            <li style={{ opacity: 0.5 }}>— No music tools</li>
          </ul>
          <button className="btn" style={{ width: "100%", marginTop: "24px" }} disabled>
            {user ? "Current Plan" : "Sign In to Start"}
          </button>
        </div>

        {/* Pro */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            border: "2px solid var(--zen-sage)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-12px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--zen-sage)",
              color: "white",
              padding: "4px 16px",
              fontSize: "11px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            Most Popular
          </div>
          <div className="frequency-hz">Pro</div>
          <div style={{ fontSize: "48px", fontWeight: 300, marginBottom: "4px" }}>{proPrice}</div>
          <div style={{ color: "var(--zen-earth)", fontSize: "13px", marginBottom: "4px" }}>{priceSuffix}</div>
          {proMonthlyEquiv && (
            <div style={{ color: "var(--zen-sage)", fontSize: "12px", marginBottom: "24px", letterSpacing: "0.5px" }}>
              just {proMonthlyEquiv}
            </div>
          )}
          {!proMonthlyEquiv && <div style={{ marginBottom: "24px" }} />}
          <ul style={{ listStyle: "none", padding: 0, color: "var(--zen-earth)", fontSize: "14px", lineHeight: 2, flex: 1 }}>
            <li>✓ Everything in Free</li>
            <li>✓ <strong style={{ color: "var(--zen-charcoal)" }}>Unlimited full downloads</strong></li>
            <li>✓ Full-length playback</li>
            <li>✓ Personal library</li>
            <li>✓ Playlists</li>
          </ul>
          <div style={{ color: "var(--zen-sage)", fontSize: "12px", marginTop: "16px", textAlign: "center" }}>
            3-day free trial • cancel anytime
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "12px" }}
            onClick={() => handleSubscribe(proPlanId)}
            disabled={currentPlan === proPlanId}
          >
            {currentPlan === proPlanId ? "Current Plan" : "Start Free Trial"}
          </button>
        </div>

        {/* Creator */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="frequency-hz">Creator</div>
          <div style={{ fontSize: "48px", fontWeight: 300, marginBottom: "4px" }}>{creatorPrice}</div>
          <div style={{ color: "var(--zen-earth)", fontSize: "13px", marginBottom: "4px" }}>{priceSuffix}</div>
          {creatorMonthlyEquiv && (
            <div style={{ color: "var(--zen-sage)", fontSize: "12px", marginBottom: "24px", letterSpacing: "0.5px" }}>
              just {creatorMonthlyEquiv}
            </div>
          )}
          {!creatorMonthlyEquiv && <div style={{ marginBottom: "24px" }} />}
          <ul style={{ listStyle: "none", padding: 0, color: "var(--zen-earth)", fontSize: "14px", lineHeight: 2, flex: 1 }}>
            <li>✓ Everything in Pro</li>
            <li>✓ <strong style={{ color: "var(--zen-charcoal)" }}>Multi-track mixer</strong></li>
            <li>✓ Beat sequencer</li>
            <li>✓ Effects processor</li>
            <li>✓ Publish to community (earn 70%)</li>
          </ul>
          <div style={{ color: "var(--zen-sage)", fontSize: "12px", marginTop: "16px", textAlign: "center" }}>
            3-day free trial • cancel anytime
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "12px" }}
            onClick={() => handleSubscribe(creatorPlanId)}
            disabled={currentPlan === creatorPlanId}
          >
            {currentPlan === creatorPlanId ? "Current Plan" : "Start Free Trial"}
          </button>
        </div>
      </div>

      <div className="divider" />

      <section style={{ textAlign: "center", padding: "20px" }}>
        <h2 className="section-title" style={{ fontSize: "24px" }}>Community Tracks</h2>
        <p style={{ color: "var(--zen-earth)", maxWidth: "560px", margin: "0 auto 20px", lineHeight: 1.7 }}>
          Individual tracks uploaded by creators are <strong style={{ color: "var(--zen-charcoal)" }}>$1.99 each</strong>.
          70% goes to the artist, 30% supports the platform.
        </p>
      </section>
    </div>
  );
}
