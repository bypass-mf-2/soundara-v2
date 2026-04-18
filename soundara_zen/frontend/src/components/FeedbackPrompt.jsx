import { useState } from "react";

/**
 * Modal that asks users whether a track helped them focus/relax.
 * Submits to /feedback; aggregated responses power marketing claims.
 */
export default function FeedbackPrompt({ track, mode, onClose }) {
  const API = import.meta.env.VITE_API_URL;
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [submitted, setSubmitted] = useState(false);

  const submit = async (rating) => {
    try {
      await fetch(`${API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || "",
          track_id: track?.filename_full || track?.id || "unknown",
          mode: mode || track?.mode || "unknown",
          rating,
        }),
      });
    } catch {}
    setSubmitted(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="zen-modal-backdrop" onClick={onClose}>
      <div className="zen-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>✓</div>
            <h2>Thanks!</h2>
            <p>Your feedback helps us improve.</p>
          </>
        ) : (
          <>
            <h2>How did that feel?</h2>
            <p style={{ marginBottom: "24px" }}>
              Did {mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : "this session"} help you{" "}
              {mode === "delta" ? "relax" : mode === "theta" ? "meditate" : mode === "alpha" || mode === "schumann" ? "focus" : "stay engaged"}?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => submit(1)}>👍 Yes</button>
              <button className="btn" onClick={() => submit(-1)}>👎 Not really</button>
              <button className="btn" onClick={onClose} style={{ opacity: 0.6 }}>Skip</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
