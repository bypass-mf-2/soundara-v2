import { Link } from "react-router-dom";
import logo from "../assets/soundara.jpg";
import { trackEvent } from "../track_event.js";

export default function Navbar({ user, onLogout }) {
  const handleNavClick = (page) => {
    trackEvent({ type: "nav_click", page, user: user?.id });
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <img src={logo} alt="Soundara" style={{ height: "48px", marginRight: "12px", verticalAlign: "middle" }} />
          <span>soundara</span>
        </div>

        <div className="navbar-links">
          <Link to="/" onClick={() => handleNavClick("home")}>Home</Link>
          <Link to="/library" onClick={() => handleNavClick("library")}>My Library</Link>
          <Link to="/pricing" onClick={() => handleNavClick("pricing")}>Pricing</Link>
          <Link to="/about" onClick={() => handleNavClick("about")}>About</Link>
          <Link to="/future" onClick={() => handleNavClick("future")}>Future</Link>
          <Link to="/contact" onClick={() => handleNavClick("contact")}>Contact</Link>
        </div>

        {user && (
          <div className="navbar-user">
            <span className="greeting">Hi, {user.name?.split(" ")[0] || user.name}</span>
            <button onClick={onLogout} className="btn-ghost">Sign Out</button>
          </div>
        )}
      </div>
    </nav>
  );
}
