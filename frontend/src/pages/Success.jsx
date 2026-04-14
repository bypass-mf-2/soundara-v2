import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function Success() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const user = params.get("user");
  const trackFile = params.get("track");
  const trackName = params.get("track_name");
  const subscription = params.get("subscription");

  useEffect(() => {
    if (!user) return;

    const updateLibrary = async () => {
      try {
        if (trackFile && trackName) {
          await fetch(`${import.meta.env.VITE_API_URL}/user_library/${user}/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file: trackFile, name: trackName }),
          });
        }

        if (subscription) {
          await fetch(`${import.meta.env.VITE_API_URL}/user_subscriptions/${user}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: subscription }),
          });
        }

        alert("Purchase successful!");
        navigate("/");
      } catch (err) {
        console.error(err);
        alert("Something went wrong updating your library or subscription.");
      }
    };

    updateLibrary();
  }, []);

  return (
    <div className="container" style={{ display: "flex", justifyContent: "center", minHeight: "60vh", alignItems: "center" }}>
      <div className="card" style={{ textAlign: "center", maxWidth: "480px", padding: "60px 40px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
        <h1 style={{ fontSize: "32px", fontWeight: 300, marginBottom: "12px", color: "var(--zen-charcoal)" }}>
          Payment Successful
        </h1>
        <p style={{ color: "var(--zen-earth)", lineHeight: 1.7 }}>
          Your track or subscription has been added to your account.
        </p>
      </div>
    </div>
  );
}
