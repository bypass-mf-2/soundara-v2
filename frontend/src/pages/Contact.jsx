import React, { useState } from "react";
import contactImage from "../assets/TrevorGoodwill.JPEG";

export default function Contact() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !interest) return alert("Please fill all required fields");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/submit_survey/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, interest, notes }),
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("Thank you for joining! We'll reach out soon.");
        setName(""); setEmail(""); setInterest(""); setNotes("");
        setShowForm(false);
      } else {
        alert("Failed to submit survey. Try again later.");
      }
    } catch (err) {
      alert("Error submitting survey: " + err.message);
    }
  };

  return (
    <div className="container">
      <div className="prose">
        <h1>Contact</h1>
        <p>This project was created by Trevor Goodwill.</p>
        <img
          src={contactImage}
          alt="Trevor Goodwill"
          style={{ maxWidth: "100%", height: "auto", marginTop: "20px", borderRadius: "0" }}
        />
        <p>Trevor Goodwill is in his first year as a cadet at the United States Air Force Academy in Colorado Springs, Colorado.</p>
        <p>
          I am very excited to be publishing this and it has been a lot of work. If you are interested as well and want to help,
          my contact is 518-801-4833 / trevorm.goodwill@gmail.com.
        </p>
        <p>However, feedback is always welcomed.</p>

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
            <input
              type="text"
              className="input"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Area of Interest</label>
            <select
              className="input"
              value={interest}
              onChange={e => setInterest(e.target.value)}
            >
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
              placeholder="Tell us more..."
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
