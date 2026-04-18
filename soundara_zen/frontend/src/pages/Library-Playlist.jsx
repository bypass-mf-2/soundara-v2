import React, { useState, useEffect } from "react";
import { usePlayer } from "../PlayerContext.jsx";

export default function Library({ user }) {
  const USER_ID = user?.id;
  const [tracks, setTracks] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [renamingPlaylist, setRenamingPlaylist] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedPlaylistForAdd, setSelectedPlaylistForAdd] = useState("default");

  const {
    playlists,
    currentPlaylist,
    setCurrentPlaylist,
    currentIndex,
    isPlaying,
    playTrack,
    pauseTrack,
    addToPlaylist,
    removeFromPlaylist,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    playLibrary,
  } = usePlayer();

  useEffect(() => {
    if (!USER_ID) return;
    fetch(`${import.meta.env.VITE_API_URL}/user_library/${USER_ID}`)
      .then(res => res.json())
      .then(data => setTracks(data))
      .catch(err => console.error("Failed to fetch library:", err));
  }, [USER_ID]);

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const ok = createPlaylist(newPlaylistName.trim());
    if (!ok) alert("Playlist name already exists.");
    else setNewPlaylistName("");
  };

  const handleRename = (name) => {
    const ok = renamePlaylist(name, renameValue.trim());
    if (!ok) alert("Name already taken or invalid.");
    else setRenamingPlaylist(null);
  };

  const playlistNames = Object.keys(playlists).filter(p => p !== "__library__");

  return (
    <div className="container">
      {/* ── Library ── */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h1 className="section-title" style={{ margin: 0 }}>My Library</h1>
          <button
            className="btn btn-primary"
            onClick={() => playLibrary(tracks)}
            disabled={tracks.length === 0}
          >
            ▶ Play All
          </button>
        </div>

        {(!tracks || tracks.length === 0) && (
          <p style={{ color: "var(--zen-earth)" }}>Library is empty. It will update when you get songs.</p>
        )}

        {tracks.map((track, i) => {
          const isCurrentTrack = currentPlaylist === "__library__" && currentIndex === i;
          return (
            <div key={i} className="track-row">
              <button
                className="icon-btn"
                onClick={() => (isCurrentTrack && isPlaying ? pauseTrack() : playTrack(i, "__library__"))}
              >
                {isCurrentTrack && isPlaying ? "⏸" : "▶"}
              </button>
              <div className="track-meta">
                <span className="track-name">{track.name}</span>
                <span className="track-mode">{track.mode}</span>
              </div>
              <select
                className="input"
                style={{ width: "auto", padding: "8px 32px 8px 12px", fontSize: "13px" }}
                value={selectedPlaylistForAdd}
                onChange={e => setSelectedPlaylistForAdd(e.target.value)}
              >
                {playlistNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button className="btn btn-sm" onClick={() => addToPlaylist(track, selectedPlaylistForAdd)}>
                + Add
              </button>
            </div>
          );
        })}
      </section>

      <div className="divider" />

      {/* ── Playlists ── */}
      <section>
        <h1 className="section-title">Playlists</h1>

        <div className="card" style={{ marginBottom: "24px", padding: "24px" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              placeholder="New playlist name..."
              onKeyDown={e => e.key === "Enter" && handleCreatePlaylist()}
            />
            <button className="btn btn-primary" onClick={handleCreatePlaylist}>Create</button>
          </div>
        </div>

        {playlistNames.map(name => {
          const pl = playlists[name] || [];
          const isActive = currentPlaylist === name;
          return (
            <div key={name} className="card" style={{ marginBottom: "16px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: pl.length ? "16px" : 0 }}>
                {renamingPlaylist === name ? (
                  <>
                    <input className="input" style={{ flex: 1 }} value={renameValue} onChange={e => setRenameValue(e.target.value)} />
                    <button className="btn btn-sm" onClick={() => handleRename(name)}>Save</button>
                    <button className="btn-ghost btn-sm" onClick={() => setRenamingPlaylist(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: "16px", fontWeight: 500 }}>{name}</strong>
                      <span style={{ color: "var(--zen-earth)", fontSize: "12px", marginLeft: "12px" }}>
                        {pl.length} tracks
                      </span>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => { setCurrentPlaylist(name); playTrack(0, name); }}
                      disabled={pl.length === 0}
                    >
                      ▶ Play All
                    </button>
                    {name !== "default" && (
                      <>
                        <button
                          className="icon-btn"
                          onClick={() => { setRenamingPlaylist(name); setRenameValue(name); }}
                          title="Rename"
                        >✏️</button>
                        <button
                          className="icon-btn"
                          onClick={() => deletePlaylist(name)}
                          title="Delete"
                        >🗑️</button>
                      </>
                    )}
                  </>
                )}
              </div>

              {pl.length === 0 && renamingPlaylist !== name && (
                <p style={{ fontSize: "13px", color: "var(--zen-earth)" }}>No tracks yet.</p>
              )}
              {pl.map((track, i) => {
                const isCurrentTrack = isActive && currentIndex === i;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 0",
                      borderTop: "1px solid rgba(196, 181, 157, 0.15)",
                    }}
                  >
                    <button
                      className="icon-btn"
                      onClick={() => (isCurrentTrack && isPlaying ? pauseTrack() : playTrack(i, name))}
                    >
                      {isCurrentTrack && isPlaying ? "⏸" : "▶"}
                    </button>
                    <div className="track-meta" style={{ flex: 1 }}>
                      <span className="track-name">{track.name}</span>
                      <span className="track-mode">{track.mode}</span>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => removeFromPlaylist(track.filename_full, name)}
                      title="Remove"
                    >✕</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
    </div>
  );
}
