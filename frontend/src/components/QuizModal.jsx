// src/components/QuizModal.jsx
// Props:
//   type       — "trivia" | "personality"
//   userId     — int or null
//   onClose()  — called when the user dismisses
//   onComplete(result) — called with the API response on successful submit

import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

export default function QuizModal({ type = "trivia", userId, onClose, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});   // { questionId: optionIndex }
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch questions on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function loadQuestions() {
      try {
        const res = await fetch(`${API_BASE}/api/quiz/${type}`);
        if (!res.ok) throw new Error("Failed to load quiz questions.");
        const data = await res.json();
        setQuestions(data.questions || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [type]);

  // ── Handle option selection ───────────────────────────────────────────────
  function selectAnswer(questionId, optionIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting) return;

    // Build payload depending on quiz type
    let body;
    if (type === "trivia") {
      body = {
        user_id: userId,
        answers: questions.map((q) => ({
          id: q.id,
          option_index: answers[q.id] ?? 0,
        })),
      };
    } else {
      body = {
        user_id: userId,
        answers: questions.map((q) => answers[q.id] ?? 0),
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/quiz/${type}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Submission failed.");
      const data = await res.json();
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {type === "trivia" ? "Romance Trivia" : "Reader Profile Quiz"}
          </h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close quiz">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading && <p style={styles.statusText}>Loading questions…</p>}
          {error && <p style={styles.errorText}>{error}</p>}

          {/* Result screen */}
          {result && (
            <div style={styles.resultContainer}>
              {type === "trivia" ? (
                <>
                  <p style={styles.resultHeading}>
                    {result.correct} / {result.total} correct
                  </p>
                  <p style={styles.resultSub}>
                    +{result.points_awarded} points awarded
                  </p>
                </>
              ) : (
                <>
                  <p style={styles.resultHeading}>{result.profile?.label}</p>
                  <p style={styles.resultDesc}>{result.profile?.description}</p>
                  <p style={styles.resultSub}>
                    +{result.points_awarded} points awarded
                  </p>
                </>
              )}
              <button style={styles.primaryBtn} onClick={onClose}>
                Done
              </button>
            </div>
          )}

          {/* Question list */}
          {!loading && !result && questions.map((q, qi) => (
            <div key={q.id} style={styles.questionBlock}>
              <p style={styles.questionText}>
                {qi + 1}. {q.question}
              </p>
              <div style={styles.optionsList}>
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  return (
                    <button
                      key={oi}
                      style={{
                        ...styles.optionBtn,
                        ...(selected ? styles.optionBtnSelected : {}),
                      }}
                      onClick={() => selectAnswer(q.id, oi)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && !result && (
          <div style={styles.footer}>
            <button
              style={{
                ...styles.primaryBtn,
                opacity: allAnswered && !submitting ? 1 : 0.4,
                cursor: allAnswered && !submitting ? "pointer" : "not-allowed",
              }}
              disabled={!allAnswered || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Submit Answers"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
// Replace with Tailwind or your CSS file if preferred.
const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(18, 12, 31, 0.85)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modal: {
    background: "linear-gradient(145deg, #1e1040, #2d1b4e)",
    border: "1px solid rgba(199,125,255,0.25)",
    borderRadius: "20px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
    width: "100%",
    maxWidth: "560px",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px 16px",
    borderBottom: "1px solid rgba(199,125,255,0.15)",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontFamily: "Sora, sans-serif",
    fontWeight: 700,
    color: "#f0e6ff",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#c77dff",
    fontSize: "18px",
    cursor: "pointer",
    padding: "4px 8px",
    lineHeight: 1,
  },
  body: {
    overflowY: "auto",
    padding: "20px 24px",
    flex: 1,
  },
  footer: {
    padding: "16px 24px 20px",
    borderTop: "1px solid rgba(199,125,255,0.15)",
    display: "flex",
    justifyContent: "flex-end",
  },
  statusText: {
    color: "#a78bca",
    fontFamily: "Nunito, sans-serif",
    textAlign: "center",
  },
  errorText: {
    color: "#ff6b9d",
    fontFamily: "Nunito, sans-serif",
    textAlign: "center",
  },
  questionBlock: {
    marginBottom: "28px",
  },
  questionText: {
    color: "#e8d8ff",
    fontFamily: "Nunito, sans-serif",
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "12px",
    lineHeight: 1.5,
  },
  optionsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  optionBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(199,125,255,0.2)",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "#c8aaee",
    fontFamily: "Nunito, sans-serif",
    fontSize: "14px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  optionBtnSelected: {
    background: "rgba(199,125,255,0.2)",
    border: "1px solid #c77dff",
    color: "#f0e6ff",
    fontWeight: 600,
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #ff6b9d, #c77dff)",
    border: "none",
    borderRadius: "50px",
    padding: "12px 28px",
    color: "#fff",
    fontFamily: "Sora, sans-serif",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(199,125,255,0.4)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  resultContainer: {
    textAlign: "center",
    padding: "16px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  resultHeading: {
    fontFamily: "Sora, sans-serif",
    fontWeight: 800,
    fontSize: "22px",
    color: "#f0e6ff",
    margin: 0,
  },
  resultDesc: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "15px",
    color: "#c8aaee",
    lineHeight: 1.6,
    maxWidth: "420px",
    margin: 0,
  },
  resultSub: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "14px",
    color: "#ff8c42",
    fontWeight: 700,
    margin: 0,
  },
};
