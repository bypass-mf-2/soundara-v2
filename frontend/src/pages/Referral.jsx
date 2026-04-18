import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Referral() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const USER_ID = user?.id;
  const API = import.meta.env.VITE_API_URL;

  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!USER_ID) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API}/api/referral/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: USER_ID }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.detail || "Could not load referral code");
        } else {
          setCode(data.code);
          setTotalReferrals(data.total_referrals || 0);
        }
      } catch (err) {
        setErrorMsg("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, [USER_ID, API]);

  const referralUrl = code ? `${window.location.origin}/pricing?ref=${code}` : "";

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="container" style={{ maxWidth: "680px", margin: "60px auto", padding: "0 20px" }}>
      <section className="hero" style={{ paddingBottom: "20px" }}>
        <h1 className="hero-title" style={{ fontSize: "40px" }}>Refer a friend</h1>
        <p className="hero-subtitle">
          Share your link — friends get <strong>33% off their first month</strong> (monthly plans).
        </p>
      </section>

      {loading && (
        <div className="card" style={{ textAlign: "center" }}>Loading…</div>
      )}

      {!loading && errorMsg && (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--zen-earth)", marginBottom: "16px" }}>{errorMsg}</p>
          <Link to="/pricing" className="btn btn-primary">See Plans</Link>
        </div>
      )}

      {!loading && !errorMsg && code && (
        <>
          <div className="card" style={{ marginBottom: "24px" }}>
            <div className="frequency-hz" style={{ textAlign: "center" }}>Your link</div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                wordBreak: "break-all",
                background: "var(--zen-cream)",
                padding: "14px",
                margin: "12px 0",
                border: "1px solid rgba(196, 181, 157, 0.3)",
                textAlign: "center",
              }}
            >
              {referralUrl}
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={copyLink}>
              {copied ? "✓ Copied" : "Copy Link"}
            </button>
          </div>

          <div className="card" style={{ textAlign: "center" }}>
            <div className="frequency-hz">Total signups</div>
            <div style={{ fontSize: "56px", fontWeight: 300, color: "var(--zen-sage)" }}>
              {totalReferrals}
            </div>
            <div style={{ color: "var(--zen-earth)", fontSize: "13px" }}>
              Friends who subscribed using your link
            </div>
          </div>
        </>
      )}

      {!loading && !USER_ID && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>Please sign in to get your referral link.</p>
        </div>
      )}
    </div>
  );
}
