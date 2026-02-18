// src/components/PointsDisplay.jsx
// Props:
//   userId         — int or null (don't render if null)
//   refreshTrigger — any value; change it to force a re-fetch (e.g. after quiz)

import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

export default function PointsDisplay({ userId, refreshTrigger }) {
  const [points, setPoints] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    async function loadPoints() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/user/${userId}/points`);
        if (!res.ok) return;
        const data = await res.json();
        setPoints(data.points ?? 0);
        setLifetime(data.lifetime_points ?? 0);
      } catch {
        // Silently ignore — points are non-critical UI
      } finally {
        setLoading(false);
      }
    }

    loadPoints();
  }, [userId, refreshTrigger]);

  if (!userId) return null;

  return (
    <div style={styles.badge} title={`${lifetime} lifetime points`}>
      <span style={styles.icon}>P</span>
      <div style={styles.textGroup}>
        <span style={styles.value}>
          {loading ? "—" : points.toLocaleString()}
        </span>
        <span style={styles.label}>pts</span>
      </div>
    </div>
  );
}

const styles = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(135deg, rgba(199,125,255,0.18), rgba(255,107,157,0.14))",
    border: "1px solid rgba(199,125,255,0.3)",
    borderRadius: "50px",
    padding: "6px 14px 6px 8px",
    boxShadow: "0 2px 10px rgba(199,125,255,0.2)",
    cursor: "default",
    userSelect: "none",
  },
  icon: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #ff6b9d, #c77dff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontFamily: "Sora, sans-serif",
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },
  textGroup: {
    display: "flex",
    alignItems: "baseline",
    gap: "3px",
  },
  value: {
    fontFamily: "Sora, sans-serif",
    fontWeight: 700,
    fontSize: "15px",
    color: "#f0e6ff",
    lineHeight: 1,
  },
  label: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "11px",
    color: "#a78bca",
    lineHeight: 1,
  },
};
