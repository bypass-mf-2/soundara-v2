import { Link } from "react-router-dom";
import logo from "../assets/soundara.jpg";
import { trackEvent } from "../track_event.js";

const ADMIN_EMAIL = "trevorm.goodwill@gmail.com";

export default function Navbar({ user, onLogout }) {
  const handleNavClick = (page) => {
    trackEvent({ type: "nav_click", page, user: user?.id });
  };
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <img src={logo} alt="Soundara" style={{ height: "48px", marginRight: "12px", verticalAlign: "middle" }} />
          <span>soundara</span>
        </div>

        <div className="navbar-links">
          <Link to="/" onClick={() => handleNavClick("home")}>Home</Link>
          <Link to="/library" onClick={() => handleNavClick("library")}>Library</Link>
          <Link to="/tools" onClick={() => handleNavClick("tools")}>Tools</Link>
          <Link to="/creator" onClick={() => handleNavClick("creator")}>Creator</Link>
          <Link to="/pricing" onClick={() => handleNavClick("pricing")}>Pricing</Link>
          <Link to="/refer" onClick={() => handleNavClick("refer")}>Refer</Link>
          <Link to="/about" onClick={() => handleNavClick("about")}>About</Link>
          <Link to="/future" onClick={() => handleNavClick("future")}>Future</Link>
          <Link to="/contact" onClick={() => handleNavClick("contact")}>Contact</Link>
          <Link to="/demo" onClick={() => handleNavClick("demo")}>Demo</Link>
          {isAdmin && <Link to="/admin" onClick={() => handleNavClick("admin")}>Admin</Link>}
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
