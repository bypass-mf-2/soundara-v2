import { useState, useRef, useEffect, useCallback } from "react";
import { loadAudioBuffer, renderToWav, drawWaveform } from "../../utils/audioHelpers.js";

const MAX_TRACKS = 6;

function TrackLane({ index, track, onRemove }) {
  const canvasRef = useRef(null);
  const [volume, setVolume] = useState(0.8);
  const [pan, setPan] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (canvasRef.current && track.buffer) drawWaveform(canvasRef.current, track.buffer);
  }, [track.buffer]);

  useEffect(() => {
    if (track.gainNode) track.gainNode.gain.value = muted ? 0 : volume;
  }, [volume, muted, track.gainNode]);

  useEffect(() => {
    if (track.panNode) track.panNode.pan.value = pan;
  }, [pan, track.panNode]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px", border: "1px solid rgba(196, 181, 157, 0.3)",
      marginBottom: "10px", background: "white"
    }}>
      <span style={{ width: "20px", color: "var(--zen-earth)", fontSize: "12px" }}>#{index + 1}</span>
      <canvas ref={canvasRef} width={200} height={40} style={{ flex: "0 0 200px" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
        <span style={{ color: "var(--zen-charcoal)", fontWeight: 500 }}>{track.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "var(--zen-earth)" }}>Vol</label>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            style={{ width: "80px", accentColor: "var(--zen-sage)" }} />
          <span style={{ width: "34px", color: "var(--zen-earth)" }}>{Math.round(volume * 100)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "var(--zen-earth)" }}>Pan</label>
          <input type="range" min={-1} max={1} step={0.01} value={pan}
            onChange={e => setPan(parseFloat(e.target.value))}
            style={{ width: "80px", accentColor: "var(--zen-sage)" }} />
          <span style={{ width: "34px", color: "var(--zen-earth)" }}>
            {pan === 0 ? "C" : pan < 0 ? `L${Math.round(-pan * 100)}` : `R${Math.round(pan * 100)}`}
          </span>
        </div>
      </div>

      <button onClick={() => setMuted(!muted)} className="btn-ghost btn-sm"
        style={{ opacity: muted ? 1 : 0.5, borderColor: muted ? "var(--zen-coral)" : undefined, color: muted ? "var(--zen-coral)" : undefined }}>
        M
      </button>
      <button onClick={onRemove} className="btn-ghost btn-sm">X</button>
    </div>
  );
}

export default function MultiTrackMixer() {
  const [tracks, setTracks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);
  const sourceNodesRef = useRef([]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.value = masterVolume;
  }, [masterVolume]);

  const handleAddTrack = async (e) => {
    const file = e.target.files[0];
    if (!file || tracks.length >= MAX_TRACKS) return;
    const ctx = getAudioContext();
    try {
      const buffer = await loadAudioBuffer(file, ctx);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.8;
      const panNode = ctx.createStereoPanner();
      gainNode.connect(panNode);
      panNode.connect(masterGainRef.current);
      setTracks(prev => [...prev, { name: file.name, buffer, gainNode, panNode, file }]);
    } catch (err) {
      alert("Failed to load audio file: " + err.message);
    }
    e.target.value = "";
  };

  const handlePlay = () => {
    if (tracks.length === 0) return;
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    sourceNodesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourceNodesRef.current = [];
    tracks.forEach(track => {
      const source = ctx.createBufferSource();
      source.buffer = track.buffer;
      source.connect(track.gainNode);
      source.start(0);
      sourceNodesRef.current.push(source);
    });
    setIsPlaying(true);
  };

  const handleStop = () => {
    sourceNodesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourceNodesRef.current = [];
    setIsPlaying(false);
  };

  const handleRemoveTrack = (index) => {
    handleStop();
    setTracks(prev => {
      const updated = [...prev];
      const removed = updated.splice(index, 1)[0];
      removed.gainNode.disconnect();
      removed.panNode.disconnect();
      return updated;
    });
  };

  const handleExport = async () => {
    if (tracks.length === 0) return;
    const maxLength = Math.max(...tracks.map(t => t.buffer.length));
    const sampleRate = tracks[0].buffer.sampleRate;

    const offline = new OfflineAudioContext(2, maxLength, sampleRate);
    const offlineMaster = offline.createGain();
    offlineMaster.gain.value = masterVolume;
    offlineMaster.connect(offline.destination);

    tracks.forEach(track => {
      const source = offline.createBufferSource();
      source.buffer = track.buffer;
      const gain = offline.createGain();
      gain.gain.value = track.gainNode.gain.value;
      const pan = offline.createStereoPanner();
      pan.pan.value = track.panNode.pan.value;
      source.connect(gain);
      gain.connect(pan);
      pan.connect(offlineMaster);
      source.start(0);
    });

    const rendered = await offline.startRendering();
    const blob = renderToWav(rendered);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mix_export.wav";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h3 className="section-title" style={{ fontSize: "22px" }}>Multi-Track Mixer</h3>
      <p style={{ fontSize: "13px", color: "var(--zen-earth)", marginBottom: "20px" }}>
        Layer up to {MAX_TRACKS} tracks. Adjust volume and pan per track.
      </p>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" onClick={handlePlay} disabled={tracks.length === 0 || isPlaying}>Play</button>
        <button className="btn btn-sm" onClick={handleStop} disabled={!isPlaying}>Stop</button>
        <button className="btn btn-sm" onClick={handleExport} disabled={tracks.length === 0}>Export Mix</button>

        <span style={{ marginLeft: "20px", fontSize: "13px", color: "var(--zen-earth)" }}>Master Vol</span>
        <input type="range" min={0} max={1} step={0.01} value={masterVolume}
          onChange={e => setMasterVolume(parseFloat(e.target.value))}
          style={{ width: "100px", accentColor: "var(--zen-sage)" }} />
        <span style={{ fontSize: "13px", color: "var(--zen-earth)" }}>{Math.round(masterVolume * 100)}%</span>
      </div>

      {tracks.map((track, i) => (
        <TrackLane key={i} index={i} track={track} onRemove={() => handleRemoveTrack(i)} />
      ))}

      {tracks.length < MAX_TRACKS && (
        <label className="file-upload" style={{ display: "inline-block", padding: "16px 32px", cursor: "pointer", fontSize: "13px", marginTop: "8px" }}>
          + Add Track
          <input type="file" accept="audio/*" onChange={handleAddTrack} style={{ display: "none" }} />
        </label>
      )}
    </div>
  );
}
