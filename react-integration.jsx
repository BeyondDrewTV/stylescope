// ─────────────────────────────────────────────────────────────────────────────
// REACT INTEGRATION GUIDE
// Paste the relevant sections into src/stylescope-v8.jsx
// ─────────────────────────────────────────────────────────────────────────────

// ── 0. Imports (add at top of stylescope-v8.jsx) ─────────────────────────────
import { useState, useEffect } from "react";
import QuizModal from "./components/QuizModal";
import PointsDisplay from "./components/PointsDisplay";
import Pepper from "./components/Pepper";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";


// ── 1. Replace hardcoded BOOKS state ────────────────────────────────────────
// REMOVE:  const [books, setBooks] = useState(BOOKS);
// ADD:

const [books, setBooks] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// Auth / user (stub — wire up magic-link flow when ready)
const [currentUser, setCurrentUser] = useState(null); // { id, email, subscription_status }

// Quiz modal
const [quizOpen, setQuizOpen] = useState(false);
const [quizType, setQuizType] = useState("trivia"); // "trivia" | "personality"

// Points refresh trigger (increment to re-fetch PointsDisplay)
const [pointsRefresh, setPointsRefresh] = useState(0);

// Pepper context
const [pepperContext, setPepperContext] = useState("idle");
const [pepperScore, setPepperScore] = useState(undefined);
const [pepperSpice, setPepperSpice] = useState(undefined);

// On-demand progress banner
const [onDemandProgress, setOnDemandProgress] = useState(null);


// ── 2. Load books from API on mount ─────────────────────────────────────────
useEffect(() => {
  async function loadBooks() {
    try {
      const res = await fetch(`${API_BASE}/api/books`);
      if (!res.ok) throw new Error("Failed to load books.");
      const data = await res.json();
      setBooks(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  loadBooks();
}, []);


// ── 3. On-demand scoring function ───────────────────────────────────────────
async function requestBookScore({ title, author }) {
  setOnDemandProgress("Starting…");
  setPepperContext("loading");

  try {
    const res = await fetch(`${API_BASE}/api/score-on-demand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to start scoring.");
    }

    const data = await res.json();

    if (data.status === "exists" && data.book) {
      setBooks((prev) =>
        prev.some((b) => b.id === data.book.id) ? prev : [...prev, data.book]
      );
      setOnDemandProgress(null);
      setPepperContext("idle");
      return data.book;
    }

    // Poll until complete
    const jobId = data.job_id;
    return await new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/job-status/${jobId}`);
          if (!statusRes.ok) throw new Error("Failed to get job status.");
          const status = await statusRes.json();

          setOnDemandProgress(status.progress || "Processing…");

          if (status.status === "complete" && status.book) {
            setBooks((prev) =>
              prev.some((b) => b.id === status.book.id) ? prev : [...prev, status.book]
            );
            setOnDemandProgress(null);
            setPepperContext(
              status.book.qualityScore >= 80 ? "high_score"
              : status.book.qualityScore < 60 ? "low_score"
              : "idle"
            );
            setPepperScore(status.book.qualityScore);
            setPepperSpice(status.book.spiceLevel);
            resolve(status.book);
          } else if (status.status === "failed") {
            throw new Error(status.error || "Scoring failed.");
          } else {
            setTimeout(poll, 2000);
          }
        } catch (err) {
          setOnDemandProgress(null);
          setPepperContext("idle");
          reject(err);
        }
      };
      setTimeout(poll, 2000);
    });

  } catch (err) {
    setOnDemandProgress(null);
    setPepperContext("idle");
    setError(err.message);
    throw err;
  }
}


// ── 4. Quiz helpers ──────────────────────────────────────────────────────────
function openQuiz(type = "trivia") {
  setQuizType(type);
  setQuizOpen(true);
}

function handleQuizComplete(result) {
  // Bump the refresh trigger so PointsDisplay re-fetches
  setPointsRefresh((n) => n + 1);
  setQuizOpen(false);
}


// ── 5. In your JSX return block ──────────────────────────────────────────────
// Replace the area where you map over BOOKS with this pattern:

/*

  // Loading state
  {loading && (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#a78bca", fontFamily: "Nunito, sans-serif" }}>
      Loading books…
    </div>
  )}

  // Error state
  {error && (
    <div style={{ background: "rgba(255,107,157,0.1)", border: "1px solid rgba(255,107,157,0.3)", borderRadius: "12px", padding: "16px", color: "#ff6b9d", fontFamily: "Nunito, sans-serif", margin: "16px" }}>
      {error}
    </div>
  )}

  // Book grid (replace BOOKS with books)
  {!loading && books.map((book) => (
    <YourBookCard key={book.id} book={book} />
  ))}

  // Points badge in your header (requires logged-in user)
  {currentUser && (
    <PointsDisplay userId={currentUser.id} refreshTrigger={pointsRefresh} />
  )}

  // Quiz launch buttons (place anywhere — e.g., in a sidebar or waiting modal)
  <button onClick={() => openQuiz("trivia")}>Trivia Challenge</button>
  <button onClick={() => openQuiz("personality")}>Reader Profile</button>

  // Quiz modal (rendered at root level of your JSX)
  {quizOpen && (
    <QuizModal
      type={quizType}
      userId={currentUser?.id}
      onClose={() => setQuizOpen(false)}
      onComplete={handleQuizComplete}
    />
  )}

  // On-demand progress banner
  {onDemandProgress && (
    <div style={{ position: "fixed", bottom: "100px", right: "24px", background: "rgba(18,12,31,0.9)", border: "1px solid rgba(199,125,255,0.25)", borderRadius: "12px", padding: "12px 18px", color: "#e0ceff", fontFamily: "Nunito, sans-serif", fontSize: "13px", zIndex: 800 }}>
      {onDemandProgress}
    </div>
  )}

  // Pepper mascot — place at root level of JSX (renders fixed bottom-right)
  <Pepper
    context={pepperContext}
    qualityScore={pepperScore}
    spiceLevel={pepperSpice}
  />

*/
