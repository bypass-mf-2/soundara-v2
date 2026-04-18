import React, { useState } from "react";

export default function Envision() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ name, email, interest, notes });
  };

  return (
    <div className="container">
      <div className="prose">
        <h1>Future Projection</h1>
        <p>
          Here we show version one which hopes to come shortly after release and version
          two which will come later on.
        </p>

        <h2>Soundara V1</h2>

        <h4>Custom Frequencies</h4>
        <p>
          Instead of the preset frequencies, users will be able to input their own frequencies
          and create custom tracks. This allows more personalized experiences and the ability to
          target specific brainwave states.
        </p>
        <p>However this will come at a greater price per track due to customization.</p>

        <h4>Specific Mode Playlists</h4>
        <p>
          Specific mode playlists will be available — like "Focus Mode" or "Sleep Mode" —
          curated by our team and based on user feedback. These playlists will be optimized for
          their specific use cases.
        </p>
        <p>These mode playlists will be free and selectable.</p>

        <h2>Soundara V2</h2>

        <h4>Search Database</h4>
        <p>
          Users will be able to search our database of tracks by specific frequencies, moods, or
          use cases. This makes it easy to find tracks that fit specific needs and preferences.
        </p>
        <p>
          When uploading a song, you'll also be able to use search to find the song you want —
          making it easier to name the track and credit the author.
        </p>

        <h4>Additional Music Tools</h4>
        <p>
          Users will have broader access to remix tools and beat creations, allowing for their
          own song creations.
        </p>

        <h4>Direct Upload</h4>
        <p>
          Users who create original content will be able to directly upload tracks to the platform
          and share them with the community.
        </p>

        <h4>Royalty</h4>
        <p>
          Users will be able to profit from direct uploads and creations. This incentivizes
          high-quality content and lets creators earn from their work.
        </p>

        <h2>Soundara V3</h2>

        <h4>AI-Generated Tracks</h4>
        <p>
          We hope to implement AI-generated tracks based on user preferences and feedback,
          allowing for a more personalized and dynamic experience.
        </p>

        <h4>Mobile App</h4>
        <p>
          We are planning to develop a mobile app so users can access the platform on the go
          and manage their sessions conveniently.
        </p>

        <h2>Bottom Line</h2>
        <p>
          These future projections aim to enhance the user experience by providing more
          customization, variety, and opportunities for users to create and share their own
          content.
        </p>
        <p>
          <strong>If you want to join the development team to improve Soundara, please contact us
          with the interest form below.</strong>
        </p>

        <button
          className="btn btn-primary"
          style={{ marginTop: "24px" }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Close Survey" : "Join & Show Interest"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginTop: "32px", maxWidth: "640px", margin: "32px auto 0" }}>
          <h3 className="section-title" style={{ fontSize: "22px" }}>Join Our Team Survey</h3>
          <div className="input-group">
            <label className="input-label">Name</label>
            <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Area of Interest</label>
            <select className="input" value={interest} onChange={e => setInterest(e.target.value)}>
              <option value="">Select...</option>
              <option value="programming">Programming</option>
              <option value="design">Design</option>
              <option value="marketing">Marketing</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Notes (optional)</label>
            <textarea
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ minHeight: "100px", resize: "vertical" }}
            />
          </div>
          <button type="submit" className="btn btn-primary">Submit</button>
        </form>
      )}
    </div>
  );
}
