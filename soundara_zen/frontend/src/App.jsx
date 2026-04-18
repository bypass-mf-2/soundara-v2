import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Navbar from "./components/Navbar.jsx";
import Library from "./pages/Library-Playlist.jsx";
import Pricing from "./pages/Pricing.jsx";
import Future from "./pages/Envision.jsx";
import Success from "./pages/Success.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import DMCA from "./pages/DMCA.jsx";
import Demo from "./pages/Demo.jsx";
import MusicTools from "./pages/MusicTools.jsx";
import CreatorDashboard from "./pages/CreatorDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ArtistProfile from "./pages/ArtistProfile.jsx";
import Referral from "./pages/Referral.jsx";
import AudioPlayer from "./components/AudioPlayer.jsx";
import logo from "./assets/soundara.jpg";

import { usePlayer } from "./PlayerContext.jsx";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { trackEvent } from "./track_event.js";

function LoginScreen({ onLogin }) {
  return (
    <div className="login-gate">
      <div className="login-gate-card">
        <Link
          to="/demo"
          style={{
            display: "block",
            marginBottom: "24px",
            padding: "12px 20px",
            background: "var(--zen-cream)",
            border: "1px solid rgba(196, 181, 157, 0.3)",
            color: "var(--zen-charcoal)",
            fontSize: "13px",
            letterSpacing: "1px",
            textDecoration: "none",
            textAlign: "center",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--zen-sage)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--zen-cream)"; e.currentTarget.style.color = "var(--zen-charcoal)"; }}
        >
          🎧 Headphones required — hear the demo first →
        </Link>
        <img src={logo} alt="Soundara" className="login-gate-logo" />
        <h1 className="login-gate-title">soundara</h1>
        <p className="login-gate-subtitle">
          Transform your music into brain-enhancing frequencies.
          Sign in to continue.
        </p>
        <div className="login-gate-btns">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              const profile = jwtDecode(credentialResponse.credential);
              const userData = {
                name: profile.name,
                email: profile.email,
                picture: profile.picture,
                id: profile.sub,
              };
              onLogin(userData);
              trackEvent({
                type: "login",
                user: profile.sub,
                name: profile.name,
                picture: profile.picture,
              });
            }}
            onError={() => console.log("Login Failed")}
          />
        </div>
      </div>
    </div>
  );
}

function AppInner({ user, onLogin, onLogout, playlistTracks, addToPlaylist, library, setLibrary, userHasBought }) {
  const location = useLocation();

  // Routes accessible without authentication
  const publicPaths = ["/demo", "/terms", "/privacy", "/dmca"];
  const isPublic = publicPaths.includes(location.pathname);

  if (!user && !isPublic) {
    return <LoginScreen onLogin={onLogin} />;
  }

  return (
    <>
      {user && <Navbar user={user} onLogout={onLogout} />}
      <Routes>
        <Route path="/demo" element={<Demo />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/dmca" element={<DMCA />} />

        {user && (
          <>
            <Route
              path="/"
              element={
                <Home
                  user={user}
                  playlist={playlistTracks}
                  addToPlaylist={addToPlaylist}
                  library={library}
                  setLibrary={setLibrary}
                  onLogout={onLogout}
                />
              }
            />
            <Route
              path="/library"
              element={
                <Library
                  user={user}
                  playlist={playlistTracks}
                  addToPlaylist={addToPlaylist}
                  library={library}
                />
              }
            />
            <Route path="/about" element={<About playlist={playlistTracks} addToPlaylist={addToPlaylist} library={library} />} />
            <Route path="/contact" element={<Contact playlist={playlistTracks} addToPlaylist={addToPlaylist} />} />
            <Route path="/pricing" element={<Pricing playlist={playlistTracks} addToPlaylist={addToPlaylist} />} />
            <Route path="/future" element={<Future playlist={playlistTracks} addToPlaylist={addToPlaylist} />} />
            <Route path="/tools" element={<MusicTools />} />
            <Route path="/creator" element={<CreatorDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/artist/:userId" element={<ArtistProfile />} />
            <Route path="/success" element={<Success />} />
            <Route path="/refer" element={<Referral />} />
          </>
        )}

        <Route path="*" element={<Navigate to={user ? "/" : "/demo"} />} />
      </Routes>

      {user && (
        <>
          <footer className="zen-footer">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/dmca">DMCA</Link>
            <div style={{ marginTop: "12px", fontSize: "11px", opacity: 0.7 }}>
              © {new Date().getFullYear()} Soundara
            </div>
          </footer>
          <AudioPlayer playlist={playlistTracks} userHasBought={userHasBought} />
        </>
      )}
    </>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [library, setLibrary] = useState([]);

  const {
    playlists,
    currentPlaylist,
    addToPlaylist: addTrackToContext,
  } = usePlayer();

  const playlistTracks = playlists[currentPlaylist] || [];

  const userHasBought = (track) => {
    if (!user) return false;
    return track.isPurchased || false;
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    if (user) {
      trackEvent({
        type: "logout",
        name: user.name,
        email: user.email,
        id: user.id,
      });
    }
    googleLogout();
    setUser(null);
    localStorage.removeItem("user");
  };

  const addToPlaylist = (track) => {
    if (!user) {
      console.warn("User not loaded yet. Cannot add to playlist.");
      return;
    }
    addTrackToContext(track);
    trackEvent({
      type: "add_to_playlist",
      user: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      id: user.id,
      track: track.track,
    });
  };

  return (
    <BrowserRouter>
      <AppInner
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        playlistTracks={playlistTracks}
        addToPlaylist={addToPlaylist}
        library={library}
        setLibrary={setLibrary}
        userHasBought={userHasBought}
      />
    </BrowserRouter>
  );
}
