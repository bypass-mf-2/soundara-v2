import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../track_event.js";

export default function Demo() {
  const API = import.meta.env.VITE_API_URL;
  const [demos, setDemos] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/demo/list`)
      .then(r => r.json())
      .then(data => setDemos(Array.isArray(data) ? data : []))
      .catch(() => setDemos([]));
    trackEvent({ type: "demo_view" });
  }, [API]);

  const play = (id, url) => {
    if (!audioRef.current) return;
    if (currentId === id) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        trackEvent({ type: "demo_play", mode: id, action: "resume" });
      } else {
        audioRef.current.pause();
        trackEvent({ type: "demo_play", mode: id, action: "pause" });
      }
      return;
    }
    audioRef.current.pause();
    audioRef.current.src = `${API}${url}`;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    setCurrentId(id);
    trackEvent({ type: "demo_play", mode: id, action: "start" });
  };

  const handleEnded = () => {
    if (currentId) trackEvent({ type: "demo_play", mode: currentId, action: "complete" });
    setCurrentId(null);
  };

  return (
    <div className="container" style={{ paddingTop: "40px" }}>
      <section className="hero" style={{ marginTop: "40px", paddingBottom: "40px" }}>
        <h1 className="hero-title">
          Hear The <span>Difference</span> In 60 Seconds
        </h1>
        <p className="hero-subtitle">
          Same track, six brainwave frequencies. Put your headphones on and tap
          any card below to hear how binaural processing changes the experience.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginTop: "24px" }}>
          <Link to="/" className="btn btn-primary">Sign In & Upload Your Own</Link>
          <Link to="/about" className="btn">Learn More</Link>
        </div>
        <p style={{ marginTop: "20px", color: "var(--zen-earth)", fontSize: "13px", letterSpacing: "1px" }}>
          🎧 Best experienced with headphones
        </p>
      </section>

      {demos.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--zen-earth)" }}>Demo clips aren't available yet.</p>
        </div>
      ) : (
        <div className="frequency-grid">
          {demos.map(d => {
            const isActive = currentId === d.id;
            return (
              <div
                key={d.id}
                className="frequency-card"
                onClick={() => play(d.id, d.url)}
                style={{ cursor: "pointer" }}
              >
                <div className="frequency-icon">{d.icon}</div>
                <div className="frequency-name">{d.name}</div>
                <div className="frequency-hz">{d.hz}</div>
                <div className="frequency-desc" style={{ marginBottom: "20px" }}>{d.desc}</div>
                <button
                  className={`btn ${isActive ? "btn-primary" : ""}`}
                  onClick={(e) => { e.stopPropagation(); play(d.id, d.url); }}
                  style={{ width: "100%" }}
                >
                  {isActive ? "⏸ pause" : "▶ play 15s preview"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="divider" />

      <section style={{ textAlign: "center", padding: "40px 20px" }}>
        <h2 className="section-title" style={{ fontSize: "28px" }}>Ready to try your own track?</h2>
        <p style={{ color: "var(--zen-earth)", maxWidth: "560px", margin: "0 auto 32px", lineHeight: 1.7 }}>
          Upload any song and transform it into a binaural experience tuned to
          whatever state you want — focus, meditation, sleep, or performance.
        </p>
        <Link to="/" className="btn btn-primary">Get Started</Link>
      </section>

      <audio ref={audioRef} onEnded={handleEnded} style={{ display: "none" }} />
    </div>
  );
}
