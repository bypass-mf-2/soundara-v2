import React from "react";

export default function About() {
  return (
    <div className="container">
      <div className="prose">
        <h1>About Soundara</h1>
        <p>
          Soundara is a platform dedicated to creating immersive audio experiences.
          Our mission is to make high-quality binaural music accessible to everyone.
        </p>
        <p>
          You can upload your own tracks, explore our library, and enjoy personalized
          sound modes designed to enhance focus, relaxation, and sleep — so you can
          enjoy the best of both worlds.
        </p>
        <p>
          This idea was originally inspired by experiments done by the Monroe Institute
          and the CIA in the 1980s. The program, the "Gateway Experiments," explored conscious
          enhancement, remote viewing, and altered states for intelligence gathering through
          hemi-sync, which is induced by binaural beats. Hemi-sync is the idea of syncing your
          left and right brain hemispheres together.
        </p>
        <p>
          Visit the Monroe Institute website to learn more:{" "}
          <a href="https://www.monroeinstitute.org/" target="_blank" rel="noopener noreferrer">
            monroeinstitute.org
          </a>
        </p>
        <p>
          Or watch this ground-breaking video:{" "}
          <a href="https://www.youtube.com/watch?v=46E_FX-KxZ8" target="_blank" rel="noopener noreferrer">
            Watch on YouTube
          </a>
        </p>
        <p>
          Bottom line: don't just take our word for it — there is plenty of anecdotal evidence.
          Frequency is the future. How will you use it to your benefit?
        </p>

        <div className="divider" />

        <h1>About Frequencies</h1>

        <section id="gamma">
          <h2>🧠 Gamma Waves</h2>
          <p>Gamma waves are linked to high-level cognitive functioning and peak mental performance.</p>
        </section>

        <section id="alpha">
          <h2>✨ Alpha Waves</h2>
          <p>
            Alpha waves are associated with calm awareness, creativity, and relaxed focus.
            Ideal for studying and light meditation.
          </p>
        </section>

        <section id="beta">
          <h2>⚡ Beta Waves</h2>
          <p>Beta waves dominate during active thinking, problem solving, and alert mental states.</p>
        </section>

        <section id="theta">
          <h2>🧘 Theta Waves</h2>
          <p>Theta waves occur during deep meditation, intuition, and dream-like mental states.</p>
        </section>

        <section id="delta">
          <h2>😴 Delta Waves</h2>
          <p>Delta waves are present during deep sleep and are linked to physical healing and recovery.</p>
        </section>

        <section id="schumann">
          <h2>🌍 Schumann Resonance</h2>
          <p>
            The Schumann Resonance (~7.83 Hz) is Earth's natural frequency and is associated with
            grounding and balance.
          </p>
        </section>
      </div>
    </div>
  );
}
