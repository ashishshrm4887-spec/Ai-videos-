"use client";

import { useState } from "react";

const modes = ["Text to Video", "Image to Video", "Text to Image"];

export default function Home() {
  const [mode, setMode] = useState("Text to Video");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Ready");

  function generate() {
    if (!prompt.trim()) {
      setStatus("Enter a prompt first");
      return;
    }
    setStatus("Generation backend not connected yet");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">AI Videos</div>
          <div className="sub">Personal AI media creator</div>
        </div>
        <span className="badge">FREE MODE</span>
      </header>

      <section className="hero">
        <p className="eyebrow">CREATE</p>
        <h1>Turn your ideas into<br />images & videos.</h1>
        <p className="intro">
          A mobile-first creator built for your personal use. The AI provider
          can be connected later without changing this interface.
        </p>
      </section>

      <section className="card">
        <div className="mode-row">
          {modes.map((item) => (
            <button
              key={item}
              className={mode === item ? "mode active" : "mode"}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="label">PROMPT</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to create..."
          rows={6}
        />

        <div className="controls">
          <label>
            Aspect ratio
            <select defaultValue="9:16">
              <option>9:16</option>
              <option>16:9</option>
              <option>1:1</option>
            </select>
          </label>

          <label>
            Duration
            <select defaultValue="5s">
              <option>5s</option>
              <option>10s</option>
              <option>15s</option>
            </select>
          </label>

          <label>
            Quality
            <select defaultValue="Standard">
              <option>Standard</option>
              <option>High</option>
            </select>
          </label>
        </div>

        <button className="generate" onClick={generate}>
          Generate {mode}
        </button>

        <div className="status">
          <span className="dot" /> {status}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Your generations</h2>
          <span>0 items</span>
        </div>
        <div className="empty">
          <div className="empty-icon">✦</div>
          <h3>Nothing generated yet</h3>
          <p>Your future images and videos will appear here.</p>
        </div>
      </section>
    </main>
  );
}
