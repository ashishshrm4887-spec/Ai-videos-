"use client";

import { useState, useRef, useEffect } from "react";

const modes = ["Text to Video", "Image to Video", "Text to Image"];

export default function Home() {
  const [mode, setMode] = useState("Text to Video");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState("5s");
  const [quality, setQuality] = useState("Standard");
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function pollJob(id) {
    try {
      const res = await fetch(`/api/generate/status?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Status check failed");
        setBusy(false);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      if (data.status === "queued") {
        setStatus("Queued…");
      } else if (data.status === "processing") {
        setStatus(data.message || "Processing…");
      } else if (data.status === "completed") {
        setStatus(data.message || "Done (mock — no real media yet)");
        setBusy(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (data.status === "failed") {
        setStatus(data.error || data.message || "Generation failed");
        setBusy(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch {
      setStatus("Network error while checking status");
      setBusy(false);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }

  async function generate() {
    if (!prompt.trim()) {
      setStatus("Enter a prompt first");
      return;
    }
    if (busy) return;

    setBusy(true);
    setStatus("Creating job…");
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          aspectRatio,
          duration,
          quality,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to start generation");
        setBusy(false);
        return;
      }

      setStatus(data.message || "Job created");
      // Poll mock job until completed
      pollRef.current = setInterval(() => pollJob(data.id), 600);
      pollJob(data.id);
    } catch {
      setStatus("Network error");
      setBusy(false);
    }
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
        <h1>
          Turn your ideas into
          <br />
          images & videos.
        </h1>
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
              type="button"
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
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <option>9:16</option>
              <option>16:9</option>
              <option>1:1</option>
            </select>
          </label>

          <label>
            Duration
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option>5s</option>
              <option>10s</option>
              <option>15s</option>
            </select>
          </label>

          <label>
            Quality
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option>Standard</option>
              <option>High</option>
            </select>
          </label>
        </div>

        <button
          className="generate"
          onClick={generate}
          type="button"
          disabled={busy}
        >
          {busy ? "Working…" : `Generate ${mode}`}
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
