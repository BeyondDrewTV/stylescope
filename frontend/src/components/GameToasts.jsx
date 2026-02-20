/**
 * GameToasts — Animated notification stack for gamification events.
 *
 * Renders toast notifications for:
 *   - Points earned
 *   - Streak milestones
 *   - Achievement unlocks
 *   - Biome / character unlocks
 *
 * Uses Framer Motion for enter/exit animations.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useGame, useGameActions } from "../context/GameContext";
import { getAchievement, getBiome, getCharacter, RARITY_COLORS } from "../data/biomes";

// ---------------------------------------------------------------------------
// Toast icon by type
// ---------------------------------------------------------------------------

function ToastIcon({ type, data }) {
  const size = 28;
  const iconStyle = {
    width: size,
    height: size,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    flexShrink: 0,
  };

  switch (type) {
    case "streak":
      return (
        <div style={{ ...iconStyle, background: "rgba(251,191,36,0.15)" }}>
          <span role="img" aria-label="streak">&#x1F525;</span>
        </div>
      );
    case "achievement": {
      const ach = data?.achievementId ? getAchievement(data.achievementId) : null;
      const rarity = ach ? RARITY_COLORS[ach.rarity] : RARITY_COLORS.common;
      return (
        <div style={{ ...iconStyle, background: rarity.bg, border: `1px solid ${rarity.border}` }}>
          <span role="img" aria-label="achievement">&#x1F3C6;</span>
        </div>
      );
    }
    case "biome": {
      const biome = data?.biomeId ? getBiome(data.biomeId) : null;
      const accent = biome?.palette?.accent || "#C77DFF";
      return (
        <div style={{ ...iconStyle, background: `${accent}20`, border: `1px solid ${accent}40` }}>
          <span role="img" aria-label="biome">&#x1F30D;</span>
        </div>
      );
    }
    case "character": {
      const char = data?.characterId ? getCharacter(data.characterId) : null;
      const color = char?.palette?.primary || "#C77DFF";
      return (
        <div style={{ ...iconStyle, background: `${color}20`, border: `1px solid ${color}40` }}>
          <span role="img" aria-label="character">&#x2728;</span>
        </div>
      );
    }
    default:
      return (
        <div style={{ ...iconStyle, background: "rgba(199,125,255,0.12)" }}>
          <span role="img" aria-label="info">&#x2139;&#xFE0F;</span>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Toast subtitle
// ---------------------------------------------------------------------------

function toastSubtitle(type, data) {
  switch (type) {
    case "streak":
      return `${data?.streak || 0}-day streak`;
    case "achievement": {
      const ach = data?.achievementId ? getAchievement(data.achievementId) : null;
      return ach ? ach.name : "Achievement";
    }
    case "biome": {
      const biome = data?.biomeId ? getBiome(data.biomeId) : null;
      return biome ? biome.tagline : "";
    }
    case "character": {
      const char = data?.characterId ? getCharacter(data.characterId) : null;
      return char ? char.title : "";
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GameToasts() {
  const { state } = useGame();
  const { dismissToast } = useGameActions();

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 340,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="popLayout">
        {state.toasts.map((toast) => {
          const subtitle = toastSubtitle(toast.type, toast.data);
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={() => dismissToast(toast.id)}
              style={{
                pointerEvents: "auto",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 12,
                background: "rgba(20,10,35,0.92)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(199,125,255,0.2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <ToastIcon type={toast.type} data={toast.data} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    fontFamily: "'Sora',sans-serif",
                    lineHeight: 1.3,
                  }}
                >
                  {toast.message}
                </div>
                {subtitle && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.55)",
                      marginTop: 2,
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
