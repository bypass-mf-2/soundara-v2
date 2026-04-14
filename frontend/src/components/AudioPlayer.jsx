import { useEffect, useRef, useState} from "react";
import { usePlayer } from "../PlayerContext.jsx";
import { trackEvent } from "../track_event.js";

export default function AudioPlayer() {
  const audioRef = useRef(null);
  const prevUrlRef = useRef("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const {
    playlists,
    currentPlaylist,
    currentIndex,
    isPlaying,
    playTrack,
    pauseTrack,
    nextTrack,
    prevTrack,
    shuffle,
    toggleShuffle,
    repeat,
    toggleRepeat,
  } = usePlayer();

  const track = playlists[currentPlaylist]?.[currentIndex] || null;
  const audioUrl = track
    ? `${import.meta.env.VITE_API_URL}/library/file/${track.filename_full}`
    : "";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track || !audioUrl) return;

    const trackChanged = audioUrl !== prevUrlRef.current;

    if (trackChanged) {
      prevUrlRef.current = audioUrl;
      audio.pause();
      audio.src = audioUrl;
      audio.load();
      setProgress(0);
      setDuration(0);

      if (isPlaying) {
        audio.oncanplay = () => {
          audio.oncanplay = null;
          audio.play().catch(() => {});
          trackEvent({ type: "audio_play", track: track.name });
        };
      }
    } else {
      if (isPlaying) {
        audio.play().catch(() => {});
        trackEvent({ type: "audio_play", track: track.name });
      } else {
        audio.pause();
      }
    }
  }, [audioUrl, isPlaying, track]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setProgress(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = e.target.value;
    setProgress(e.target.value);
  };

  const handleEnded = () => nextTrack();

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!track) return null;

  const progressPct = duration ? (progress / duration) * 100 : 0;
  const playlistLabel = currentPlaylist === "__library__" ? "Library" : currentPlaylist;

  return (
    <div className="audio-player-bar">
      <div className="player-track-info">
        <div className="player-track-name">{track.name}</div>
        <div className="player-track-mode">
          {track.mode}{playlistLabel && ` • ${playlistLabel}`}
        </div>
      </div>

      <div className="player-controls">
        <button className="player-btn" onClick={prevTrack} title="Previous">⏮</button>
        <button
          className={`player-btn ${isPlaying ? "playing" : ""}`}
          onClick={() => (isPlaying ? pauseTrack() : playTrack(currentIndex))}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button className="player-btn" onClick={nextTrack} title="Next">⏭</button>
        <button
          className="player-btn"
          onClick={toggleShuffle}
          style={{ opacity: shuffle ? 1 : 0.4 }}
          title="Shuffle"
        >🔀</button>
        <button
          className="player-btn"
          onClick={toggleRepeat}
          style={{ opacity: repeat ? 1 : 0.4 }}
          title="Repeat"
        >🔁</button>
      </div>

      <div style={{ flex: 2, display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <span style={{ fontSize: "11px", color: "var(--zen-earth)", minWidth: "36px" }}>
          {formatTime(progress)}
        </span>
        <div className="progress-bar" style={{ flex: 1, position: "relative" }}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </div>
        <span style={{ fontSize: "11px", color: "var(--zen-earth)", minWidth: "36px" }}>
          {formatTime(duration)}
        </span>
      </div>

      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        style={{ display: "none" }}
      />
    </div>
  );
}
