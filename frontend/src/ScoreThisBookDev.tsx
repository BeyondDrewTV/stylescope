import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:5000/api";

export function ScoreThisBookDev() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Poll when we have a jobId
  useEffect(() => {
    if (!jobId) return;

    setStatus("queued");
    setResult(null);
    setError(null);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/score-on-demand/${jobId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Request failed");
          clearInterval(interval);
          return;
        }

        setStatus(data.status);

        if (data.status === "completed") {
          setResult(data.result);
          clearInterval(interval);
        } else if (data.status === "failed") {
          setError(data.error_message || "Job failed");
          clearInterval(interval);
        }
      } catch (e: any) {
        setError(e.message || "Network error");
        clearInterval(interval);
      }
    }, 3000); // poll every 3s

    return () => clearInterval(interval);
  }, [jobId]);

  async function startScoring(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setStatus(null);
    setJobId(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/score-on-demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          isbn: isbn || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start scoring");
        setIsLoading(false);
        return;
      }

      setJobId(data.job_id);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #444", marginTop: "1rem" }}>
      <h2>Score This Book (Dev)</h2>
      <form onSubmit={startScoring} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 400 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          placeholder="Author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          required
        />
        <input
          placeholder="ISBN (optional)"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Starting..." : "Score This Book"}
        </button>
      </form>

      {jobId && (
        <div style={{ marginTop: "1rem" }}>
          <div>Job ID: {jobId}</div>
          <div>Status: {status}</div>
        </div>
      )}

      {error && (
        <pre style={{ marginTop: "1rem", color: "red", whiteSpace: "pre-wrap" }}>
          Error: {error}
        </pre>
      )}

      {result && (
        <pre style={{ marginTop: "1rem", background: "#111", padding: "0.5rem", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
