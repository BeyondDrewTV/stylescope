// src/components/Pepper.jsx
// The Pepper mascot — a fixed bottom-right panel that shows contextual
// commentary fetched from /api/pepper/message.
//
// Props:
//   context      — "idle" | "loading" | "low_score" | "high_score" | "nuclear_spice"
//   qualityScore — optional int
//   spiceLevel   — optional int

import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

export default function Pepper({ context = "idle", qualityScore, spiceLevel }) {
  const [message, setMessage] = useState("");
  const [animation, setAnimation] = useState("neutral");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("context", context);
    if (typeof qualityScore === "number") params.set("quality_score", String(qualityScore));
    if (typeof spiceLevel === "number") params.set("spice_level", String(spiceLevel));

    async function loadMessage() {
      try {
        const res = await fetch(`${API_BASE}/api/pepper/message?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setMessage(data.message || "");
        setAnimation(data.animation || "neutral");
        setVisible(true); // re-show if context changed
      } catch {
        // Pepper is optional — silent failure is fine
      }
    }

    loadMessage();
  }, [context, qualityScore, spiceLevel]);

  if (!message || !visible) return null;

  return (
    <div
      style={styles.container}
      data-animation={animation}
      role="complementary"
      aria-label="Pepper mascot commentary"
    >
      {/* Dismiss */}
      <button
        style={styles.dismissBtn}
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Pepper illustration placeholder */}
      <div style={{ ...styles.pepperIcon, ...animationStyles[animation] }}>
        <PepperSVG />
      </div>

      {/* Message */}
      <p style={styles.messageText}>{message}</p>
    </div>
  );
}

// ── Simple inline Pepper SVG ──────────────────────────────────────────────────
// Replace with a real illustrated asset when design is ready.
function PepperSVG() {
  return (
    <svg
      width="40"
      height="52"
      viewBox="0 0 40 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Stem */}
      <path d="M20 4 C20 4 22 1 26 2" stroke="#4a7c59" strokeWidth="2" strokeLinecap="round" />
      {/* Body */}
      <path
        d="M14 8 C8 10 5 18 6 28 C7 38 12 48 20 49 C28 48 33 38 34 28 C35 18 32 10 26 8 Z"
        fill="url(#pepperGrad)"
      />
      {/* Highlight */}
      <ellipse cx="14" cy="18" rx="4" ry="7" fill="rgba(255,255,255,0.2)" transform="rotate(-15 14 18)" />
      <defs>
        <linearGradient id="pepperGrad" x1="6" y1="8" x2="34" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF8C42" />
          <stop offset="50%" stopColor="#FF6B9D" />
          <stop offset="100%" stopColor="#C62828" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles = {
  container: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 900,
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    background: "rgba(18, 12, 31, 0.78)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px",
    padding: "14px 16px 14px 14px",
    maxWidth: "300px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(199,125,255,0.12)",
  },
  dismissBtn: {
    position: "absolute",
    top: "8px",
    right: "10px",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: "12px",
    cursor: "pointer",
    lineHeight: 1,
    padding: "2px 4px",
  },
  pepperIcon: {
    flexShrink: 0,
    display: "flex",
    alignItems: "flex-end",
    transition: "transform 0.3s ease",
  },
  messageText: {
    margin: 0,
    fontFamily: "Nunito, sans-serif",
    fontSize: "13px",
    lineHeight: 1.55,
    color: "#e0ceff",
    paddingRight: "12px", // avoid overlap with dismiss button
  },
};

// Animation visual states — applied via inline style to the pepper icon.
// When a real animated asset is ready, swap these for CSS animation class names
// keyed off the data-animation attribute.
const animationStyles = {
  neutral:    { transform: "translateY(0)" },
  sweating:   { transform: "translateY(-2px) rotate(-3deg)" },
  eyeroll:    { transform: "translateY(0) rotate(5deg)" },
  heart_eyes: { transform: "translateY(-4px) scale(1.08)" },
  on_fire:    { transform: "translateY(-3px) rotate(-5deg) scale(1.1)" },
};
