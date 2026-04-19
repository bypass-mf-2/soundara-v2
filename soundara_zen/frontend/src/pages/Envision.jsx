import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL;

const PHASES = [
  {
    key: "next",
    label: "Next",
    blurb: "Shipping soon after launch.",
    accent: "var(--zen-sage)",
    features: [
      {
        id: "custom_frequencies",
        title: "Custom Frequencies",
        body: "Input your own frequencies to create personalized tracks that target specific brainwave states. Premium-priced per track due to customization.",
      },
      {
        id: "mode_playlists",
        title: "Mode Playlists",
        body: "Curated playlists like Focus Mode and Sleep Mode, tuned for specific use cases and refined from user feedback. Free and selectable.",
      },
    ],
  },
  {
    key: "later",
    label: "Later",
    blurb: "On the roadmap, further out.",
    accent: "var(--zen-ocean)",
    features: [
      {
        id: "search_database",
        title: "Search Database",
        body: "Search tracks by frequency, mood, or use case. Also makes uploads smoother — find the song you're crediting without typing it from scratch.",
      },
      {
        id: "additional_music_tools",
        title: "Music Tools",
        body: "Broader access to remix tools and beat creation so users can craft their own sounds directly on Soundara.",
      },
      {
        id: "direct_upload",
        title: "Direct Upload",
        body: "Original creators can upload tracks directly to the platform and share them with the community.",
      },
      {
        id: "royalty",
        title: "Creator Royalties",
        body: "Creators profit from uploads and originals — incentives for high-quality content and a path to earning.",
      },
    ],
  },
  {
    key: "future",
    label: "Future",
    blurb: "Long-term direction.",
    accent: "var(--zen-coral)",
    features: [
      {
        id: "ai_tracks",
        title: "AI-Generated Tracks",
        body: "Generate tracks based on user preferences and feedback — dynamic, personal, always fresh.",
      },
      {
        id: "mobile_app",
        title: "Mobile App",
        body: "Native mobile experience for sessions on the go with smooth playlist management.",
      },
    ],
  },
];

export default function Envision() {
  const [counts, setCounts] = useState({});
  const [voted, setVoted] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // "success" | "error" | null
  const [submitMsg, setSubmitMsg] = useState("");

  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const url = user?.id
      ? `${API}/api/envision/upvotes?user_id=${encodeURIComponent(user.id)}`
      : `${API}/api/envision/upvotes`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setCounts(data.counts || {});
        setVoted(data.voted || []);
      })
      .catch(() => {});
  }, [user?.id]);

  const handleUpvote = async (featureId) => {
    if (voted.includes(featureId)) return;
    setVoted(v => [...v, featureId]); // optimistic
    setCounts(c => ({ ...c, [featureId]: (c[featureId] || 0) + 1 }));
    try {
      const res = await fetch(`${API}/api/envision/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_id: featureId, user_id: user?.id || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setCounts(data.counts || {});
        setVoted(data.voted || []);
      }
    } catch {
      // rollback on hard failure
      setVoted(v => v.filter(id => id !== featureId));
      setCounts(c => ({ ...c, [featureId]: Math.max(0, (c[featureId] || 1) - 1) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitStatus(null);
    setSubmitMsg("");

    if (!email.trim()) {
      setSubmitStatus("error");
      setSubmitMsg("Please enter your email so we can reach you.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, interest, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitMsg(data.detail || "Something went wrong. Try again in a moment.");
      } else {
        setSubmitStatus("success");
        setSubmitMsg("Thanks — we got it. We'll be in touch.");
        setName(""); setEmail(""); setInterest(""); setNotes("");
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <section className="hero" style={{ marginTop: "20px", paddingBottom: "20px" }}>
        <h1 className="hero-title" style={{ fontSize: "52px" }}>Roadmap</h1>
        <p className="hero-subtitle">
          Where Soundara is going. Vote on the features you'd like to see first.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "32px",
          marginBottom: "60px",
        }}
      >
        {PHASES.map(phase => (
          <div key={phase.key}>
            <div style={{ marginBottom: "20px", borderLeft: `3px solid ${phase.accent}`, paddingLeft: "14px" }}>
              <div
                style={{
                  fontSize: "11px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: phase.accent,
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                {phase.label}
              </div>
              <div style={{ fontSize: "13px", color: "var(--zen-earth)" }}>{phase.blurb}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {phase.features.map(feat => {
                const count = counts[feat.id] || 0;
                const hasVoted = voted.includes(feat.id);
                return (
                  <div key={feat.id} className="card" style={{ padding: "24px 26px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
                      <h4 style={{ fontSize: "17px", fontWeight: 500, color: "var(--zen-charcoal)", margin: 0 }}>
                        {feat.title}
                      </h4>
                      <button
                        onClick={() => handleUpvote(feat.id)}
                        disabled={hasVoted}
                        title={hasVoted ? "You've already voted" : "Upvote this feature"}
                        style={{
                          border: `1px solid ${hasVoted ? phase.accent : "rgba(196,181,157,0.4)"}`,
                          background: hasVoted ? phase.accent : "transparent",
                          color: hasVoted ? "white" : "var(--zen-charcoal)",
                          padding: "6px 12px",
                          cursor: hasVoted ? "default" : "pointer",
                          fontSize: "12px",
                          letterSpacing: "0.5px",
                          minWidth: "58px",
                          transition: "all 0.3s ease",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <span>▲</span>
                        <span>{count}</span>
                      </button>
                    </div>
                    <p style={{ color: "var(--zen-earth)", fontSize: "14px", lineHeight: 1.7, marginTop: "10px", marginBottom: 0 }}>
                      {feat.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="divider" style={{ margin: "40px 0" }} />

      <div className="prose" style={{ textAlign: "center" }}>
        <h2 style={{ fontWeight: 300 }}>Want to help build this?</h2>
        <p>
          If you want to join the development team or share ideas, drop us a note below.
          We read every submission.
        </p>
        <button
          className="btn btn-primary"
          style={{ marginTop: "16px" }}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? "Close form" : "Show interest"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ marginTop: "32px", maxWidth: "640px", margin: "32px auto 0" }}
        >
          <h3 className="section-title" style={{ fontSize: "22px" }}>Interest form</h3>
          <div className="input-group">
            <label className="input-label">Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Email *</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Area of Interest</label>
            <select
              className="input"
              value={interest}
              onChange={e => setInterest(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select...</option>
              <option value="programming">Programming</option>
              <option value="design">Design</option>
              <option value="marketing">Marketing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Notes (optional)</label>
            <textarea
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={submitting}
              style={{ minHeight: "100px", resize: "vertical" }}
            />
          </div>

          {submitStatus === "success" && (
            <p style={{ color: "var(--zen-sage)", fontSize: "14px", marginBottom: "16px" }}>
              {submitMsg}
            </p>
          )}
          {submitStatus === "error" && (
            <p style={{ color: "var(--zen-coral)", fontSize: "14px", marginBottom: "16px" }}>
              {submitMsg}
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Sending..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
