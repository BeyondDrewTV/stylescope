import { useState, useEffect, useCallback, useRef } from "react";
import { UpgradeModal } from "./components/UpgradeModal";
import { HiddenGemsExplorer } from "./components/HiddenGemsExplorer";
import { api } from "./api/client";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  // Backgrounds
  bgApp:      '#05070B',
  bgSurface:  '#10131A',
  bgElevated: '#171B24',
  bgHover:    '#1C2130',

  // Text
  textPrimary:   '#F5F5F7',
  textSecondary: '#A5A9B5',
  textMuted:     '#6D7280',

  // Accent (muted rose)
  accent:        '#E08BAA',
  accentSoft:    'rgba(224,139,170,0.15)',
  accentSofter:  'rgba(224,139,170,0.08)',

  // Semantic
  positive:      '#6AD2A0',
  positiveSoft:  'rgba(106,210,160,0.12)',
  warning:       '#F5C56A',
  warningSoft:   'rgba(245,197,106,0.12)',
  danger:        '#F28C8C',
  dangerSoft:    'rgba(242,140,140,0.12)',

  // Borders
  borderSubtle: '#1E2230',
  borderStrong: '#2A2F3E',
  borderAccent: 'rgba(224,139,170,0.2)',
};

// ─── Text Normalization ───────────────────────────────────────────────────────
// Normalize title to title case: "the wicked king" → "The Wicked King"
function normalizeTitle(title) {
  if (!title) return '';
  const trimmed = title.trim();

  // Words that should stay lowercase in title case (unless they're the first word)
  const lowercaseWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in']);

  return trimmed
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      // Always capitalize first word, otherwise check if it should stay lowercase
      if (index === 0 || !lowercaseWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(' ');
}

// Normalize author to proper name capitalization: "holly black" → "Holly Black"
function normalizeAuthor(author) {
  if (!author) return '';
  const trimmed = author.trim();

  return trimmed
    .split(' ')
    .map(word => {
      if (!word) return '';
      // Handle names with apostrophes (e.g., "O'Brien")
      if (word.includes("'")) {
        return word.split("'").map(part =>
          part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        ).join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Legacy alias kept for compatibility
const C = {
  purple:     T.accent,
  pink:       T.accent,
  bg:         T.bgApp,
  cardBg:     T.bgSurface,
  cardBgEnd:  T.bgElevated,
  danger:     T.danger,
  text:       T.textPrimary,
  textMuted:  T.textSecondary,
  textSubtle: T.textMuted,
  green:      T.positive,
  yellow:     T.warning,
  warning:    T.warning,
};

// ─── Spice Level Definitions ──────────────────────────────────────────────────
const SPICE_LEVELS = {
  0: { label: 'CLEAN',      subtitle: 'No sexual content', color: '#8BB8E8', bg: 'rgba(139,184,232,0.1)',  iconType: 'book',            description: 'Kissing only, fade-to-black, or no romance scenes' },
  1: { label: 'SWEET',      subtitle: 'Closed door',       color: T.accent,  bg: T.accentSoft,             iconType: 'heart',           description: 'Sensuality implied, nothing explicit shown' },
  2: { label: 'WARM',       subtitle: 'Mild steam',        color: '#F5A66D', bg: 'rgba(245,166,109,0.12)', iconType: 'thermometer-low', description: 'Some explicit scenes, not overly detailed' },
  3: { label: 'STEAMY',     subtitle: 'Moderate heat',     color: '#F0855A', bg: 'rgba(240,133,90,0.12)',  iconType: 'thermometer-mid', description: 'Multiple explicit scenes with detail' },
  4: { label: 'HOT',        subtitle: 'High heat',         color: '#E86060', bg: 'rgba(232,96,96,0.12)',   iconType: 'thermometer-full',description: 'Frequent explicit scenes, graphic detail' },
  5: { label: 'VERY SPICY', subtitle: 'Explicit content',  color: '#D44A4A', bg: 'rgba(212,74,74,0.12)',   iconType: 'flame',           description: 'Extremely graphic, frequent scenes, kink elements' },
  6: { label: 'SCORCHING',  subtitle: 'Erotica',           color: '#B83333', bg: 'rgba(184,51,51,0.14)',   iconType: 'triple-flame',    description: 'Plot-focused erotica, taboo themes, extreme kink' },
};

// ─── Global Styles ─────────────────────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

  :root {
    --bg-app: ${T.bgApp};
    --bg-surface: ${T.bgSurface};
    --bg-elevated: ${T.bgElevated};
    --text-primary: ${T.textPrimary};
    --text-secondary: ${T.textSecondary};
    --text-muted: ${T.textMuted};
    --accent: ${T.accent};
    --accent-soft: ${T.accentSoft};
    --positive: ${T.positive};
    --warning: ${T.warning};
    --danger: ${T.danger};
    --border-subtle: ${T.borderSubtle};
    --border-strong: ${T.borderStrong};
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    height: 100%;
    background: var(--bg-app);
    color: var(--text-primary);
    font-family: 'DM Sans', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }

  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${T.borderStrong}; border-radius: 3px; }
  * { -webkit-tap-highlight-color: transparent; }

  /* ── Keyframes ── */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  @keyframes spin     { to { transform:rotate(360deg); } }
  @keyframes slideUp  { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
  @keyframes shimmer  { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
  @keyframes scoreIn  { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }

  .card-appear  { animation: fadeUp 0.3s ease both; }
  .fade-in      { animation: fadeIn 0.2s ease both; }
  .modal-enter  { animation: slideUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }

  .skeleton {
    background: linear-gradient(90deg, ${T.bgSurface} 25%, ${T.bgElevated} 50%, ${T.bgSurface} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.6s infinite;
    border-radius: 6px;
  }

  /* ── Layout ── */
  .main-scroll {
    overflow-y: auto;
    height: calc(100dvh - 60px);
    -webkit-overflow-scrolling: touch;
  }

  .horiz-scroll {
    display: flex;
    overflow-x: auto;
    gap: 10px;
    padding-bottom: 2px;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .horiz-scroll::-webkit-scrollbar { display: none; }
  .horiz-scroll > * { scroll-snap-align: start; }

  /* ── Book Cards ── */
  .book-card {
    background: ${T.bgSurface};
    border-radius: 12px;
    border: 1px solid ${T.borderSubtle};
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
    overflow: hidden;
    position: relative;
  }
  .book-card:hover { background: ${T.bgHover}; border-color: ${T.borderStrong}; }
  .book-card:active { transform: scale(0.985); }

  .h-card {
    background: ${T.bgSurface};
    border-radius: 10px;
    border: 1px solid ${T.borderSubtle};
    min-width: 140px; max-width: 140px;
    flex-shrink: 0;
    cursor: pointer;
    transition: background 0.15s ease;
    overflow: hidden;
  }
  .h-card:hover { background: ${T.bgHover}; }
  .h-card:active { transform: scale(0.97); }

  /* ── Bottom Nav ── */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; height: 60px;
    background: rgba(5,7,11,0.95);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1px solid ${T.borderSubtle};
    display: flex; align-items: center; justify-content: space-around;
    z-index: 100;
    max-width: 540px; margin: 0 auto;
    left: 50%; transform: translateX(-50%);
    width: 100%;
  }
  @media(max-width:540px) {
    .bottom-nav { left:0; transform:none; }
  }
  .nav-btn {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 20px; min-width: 44px; min-height: 44px;
    background: none; border: none; cursor: pointer; border-radius: 8px;
    position: relative;
  }

  /* ── Search Input ── */
  .search-input {
    width: 100%;
    padding: 13px 44px 13px 44px;
    background: ${T.bgSurface};
    border: 1px solid ${T.borderSubtle};
    border-radius: 999px;
    color: ${T.textPrimary};
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 400;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .search-input:focus {
    border-color: ${T.accent};
    box-shadow: 0 0 0 3px ${T.accentSoft};
  }
  .search-input::placeholder { color: ${T.textMuted}; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(6px);
    z-index: 200;
    display: flex; align-items: flex-end; justify-content: center;
  }
  @media(min-width: 540px) { .modal-overlay { align-items: flex-end; } }

  .modal-sheet {
    width: 100%; max-width: 540px; max-height: 92dvh;
    background: ${T.bgElevated};
    border-radius: 20px 20px 0 0;
    border-top: 1px solid ${T.borderStrong};
    overflow-y: auto; padding: 0;
    position: relative;
  }

  /* ── Buttons ── */
  .btn-primary {
    width: 100%;
    padding: 14px;
    background: ${T.accent};
    color: ${T.bgApp};
    border: none; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600;
    cursor: pointer; letter-spacing: -0.01em;
    transition: opacity 0.15s ease, transform 0.1s ease;
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:active { transform: scale(0.98); }

  .btn-ghost {
    background: none; border: 1px solid ${T.borderStrong};
    color: ${T.textSecondary};
    padding: 10px 18px; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .btn-ghost:hover { border-color: ${T.borderAccent}; color: ${T.textPrimary}; }

  /* ── Pill / Tag ── */
  .pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 999px;
    font-size: 12px; font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0;
  }

  /* ── Section header ── */
  .section-header {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px; font-weight: 600;
    color: ${T.textMuted};
    text-transform: uppercase; letter-spacing: 0.1em;
    margin-bottom: 12px;
  }

  /* ── Score number animation ── */
  .score-display { animation: scoreIn 0.4s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.1s; opacity: 0; }

  /* ── App container ── */
  .app-container {
    max-width: 540px; margin: 0 auto;
    position: relative; min-height: 100dvh;
    background: ${T.bgApp};
  }
`;

// ─── SVG Icon Library ──────────────────────────────────────────────────────────
const Icons = {
  Home:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>,
  Search:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Library: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Profile: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  X:       (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Chevron: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronLeft: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Camera:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Clock:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Star:    (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Shuffle: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>,
  Warning: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Info:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Book:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Gem:     (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="2"/><polyline points="22 8.5 12 13 2 8.5"/></svg>,
};

// ─── Spice Icons ──────────────────────────────────────────────────────────────
const SpiceIcon = ({ type, color, size = 16 }) => {
  const s = { width: size, height: size, flexShrink: 0 };
  const icons = {
    book: <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></svg>,
    heart: <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={color} strokeWidth="1.8"/></svg>,
    'thermometer-low': <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="1.8"/><rect x="10.25" y="13" width="3.5" height="3" fill={color} opacity="0.5"/></svg>,
    'thermometer-mid': <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="1.8"/><rect x="10.25" y="8" width="3.5" height="8" fill={color} opacity="0.5"/></svg>,
    'thermometer-full': <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="1.8"/><rect x="10.25" y="3.5" width="3.5" height="12.5" fill={color} opacity="0.5"/></svg>,
    flame: <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M12 2C8.5 7 9 10.5 9 12a3 3 0 0 0 6 0c0-1.5-.5-3-3-10z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    'triple-flame': <svg style={s} viewBox="0 0 24 24" fill="none"><path d="M7 20a2.5 2.5 0 0 0 2.5-2.5c0-1.5-.8-3-2.5-6.5 1.7 3.5 2.5 5 2.5 6.5a2.5 2.5 0 0 0 5 0c0-2.5-1.5-5-5-11 3.5 6 5 8.5 5 11a2.5 2.5 0 0 0 5 0c0-1.5-.8-3-2.5-6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return icons[type] || null;
};

// ─── Spice Level Badge ────────────────────────────────────────────────────────
function SpiceLevelBadge({ level, variant = 'default', showDescription = false }) {
  if (level === null || level === undefined) return null;
  const sp = SPICE_LEVELS[level];
  if (!sp) return null;

  if (variant === 'compact') {
    return (
      <span className="pill" style={{ background: sp.bg, color: sp.color, border: `1px solid ${sp.color}22` }}>
        <SpiceIcon type={sp.iconType} color={sp.color} size={11}/>
        {sp.label}
      </span>
    );
  }

  if (variant === 'detailed') {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 10,
        background: sp.bg, border: `1px solid ${sp.color}22`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: showDescription ? 8 : 0 }}>
          <SpiceIcon type={sp.iconType} color={sp.color} size={22}/>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: sp.color, letterSpacing: '0.02em' }}>{sp.label}</div>
            <div style={{ fontSize: 12, color: sp.color, opacity: 0.7, marginTop: 1 }}>{sp.subtitle}</div>
          </div>
        </div>
        {showDescription && (
          <p style={{ fontSize: 13, color: sp.color, opacity: 0.75, lineHeight: 1.5, marginTop: 4 }}>{sp.description}</p>
        )}
      </div>
    );
  }

  // default
  return (
    <span className="pill" style={{ background: sp.bg, color: sp.color, border: `1px solid ${sp.color}22`, padding: '5px 11px', gap: 6 }}>
      <SpiceIcon type={sp.iconType} color={sp.color} size={14}/>
      {sp.label}
    </span>
  );
}

// ─── Score Helpers ────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? T.positive : s >= 60 ? T.warning : T.danger;
const scoreBg    = (s) => s >= 80 ? T.positiveSoft : s >= 60 ? T.warningSoft : T.dangerSoft;

// Large score display (used in BookModal hero)
function ScoreDisplay({ score }) {
  const col = scoreColor(score);
  return (
    <div className="score-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 52, fontWeight: 400, lineHeight: 1,
        color: col,
        letterSpacing: '-0.02em',
      }}>
        {score}
      </div>
      <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>out of 100</div>
    </div>
  );
}

// Compact score pill used in book cards
function ScorePill({ score }) {
  if (!score) return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: T.bgElevated, border: `1px solid ${T.borderStrong}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>?</span>
    </div>
  );
  const col = scoreColor(score);
  const bg  = scoreBg(score);
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: bg, border: `1px solid ${col}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, color: col, fontWeight: 700 }}>{score}</span>
    </div>
  );
}

// Confidence chip
function ConfidenceChip({ level }) {
  if (!level) return null;
  const map = {
    high:   { color: T.positive, bg: T.positiveSoft, label: 'High confidence' },
    medium: { color: T.warning,  bg: T.warningSoft,  label: 'Medium confidence' },
    low:    { color: T.danger,   bg: T.dangerSoft,   label: 'Low confidence' },
  };
  const m = map[level?.toLowerCase()] || map.medium;
  return (
    <span className="pill" style={{ background: m.bg, color: m.color, fontSize: 11, padding: '3px 8px', border: `1px solid ${m.color}25` }}>
      {m.label}
    </span>
  );
}

// Score summary line
function scoreSummaryLine(scores, dims) {
  if (!scores || !dims || dims.length === 0) return null;
  const sorted = [...dims].sort((a, b) => b.score - a.score);
  const best   = sorted[0];
  const worst  = sorted[sorted.length - 1];
  const overall = scores?.qualityScore || 0;
  if (overall >= 80) return `${best.name} is a standout.`;
  if (overall >= 65) return `Strong ${best.name.toLowerCase()}, weaker ${worst.name.toLowerCase()}.`;
  if (overall >= 50) return `Uneven — ${best.name.toLowerCase()} holds it together.`;
  return `Struggles with ${worst.name.toLowerCase()}.`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: T.bgSurface, borderRadius: 12, border: `1px solid ${T.borderSubtle}`,
      padding: 14, display: 'flex', gap: 14, alignItems: 'center',
    }}>
      <div className="skeleton" style={{ width: 48, height: 68, borderRadius: 6, flexShrink: 0 }}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="skeleton" style={{ height: 14, width: '75%' }}/>
        <div className="skeleton" style={{ height: 12, width: '45%' }}/>
      </div>
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}/>
    </div>
  );
}

function SkeletonHCard() {
  return (
    <div style={{
      minWidth: 140, maxWidth: 140, flexShrink: 0,
      background: T.bgSurface, borderRadius: 10,
      border: `1px solid ${T.borderSubtle}`, overflow: 'hidden',
    }}>
      <div className="skeleton" style={{ width: '100%', height: 100 }}/>
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 12, width: '90%' }}/>
        <div className="skeleton" style={{ height: 11, width: '60%' }}/>
      </div>
    </div>
  );
}

// ─── Book Cover ───────────────────────────────────────────────────────────────
function BookCover({ book, width = 48, height = 68, radius = 6 }) {
  const [imgErr, setImgErr] = useState(false);
  const hasImg = book.coverUrl && !imgErr;

  // Generate a deterministic pastel from title
  const hue = (book.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const bg  = `hsl(${hue},25%,18%)`;
  const fg  = `hsl(${hue},40%,55%)`;

  return (
    <div style={{
      width, height, borderRadius: radius, flexShrink: 0,
      background: bg, overflow: 'hidden', position: 'relative',
      border: `1px solid rgba(255,255,255,0.06)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {hasImg ? (
        <img src={book.coverUrl} alt={book.title}
          onError={() => setImgErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <svg width={width * 0.4} height={width * 0.4} viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke={fg} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
    </div>
  );
}

// ─── Horizontal Book Card ─────────────────────────────────────────────────────
function HorizontalBookCard({ book, onSelect }) {
  return (
    <div className="h-card" onClick={() => onSelect(book)}>
      {/* Cover */}
      <div style={{
        width: '100%', height: 100, position: 'relative', overflow: 'hidden',
        background: T.bgElevated,
      }}>
        <BookCover book={book} width={140} height={100} radius={0}/>
        {book.qualityScore > 0 && (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            background: 'rgba(5,7,11,0.85)',
            backdropFilter: 'blur(4px)',
            borderRadius: 6, padding: '3px 6px',
            fontSize: 12, fontWeight: 700,
            color: scoreColor(book.qualityScore),
            border: `1px solid ${scoreColor(book.qualityScore)}30`,
          }}>
            {book.qualityScore}
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '9px 10px 10px' }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: T.textPrimary,
          lineHeight: 1.35, marginBottom: 3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{book.title}</p>
        <p style={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.author}
        </p>
      </div>
    </div>
  );
}

// ─── Book Card (List) ─────────────────────────────────────────────────────────
function BookCard({ book, onSelect, onRequest, index }) {
  const scored = book.qualityScore > 0;
  const hasCW  = (book.officialContentWarnings?.warnings?.length > 0) || (book.contentWarnings?.length > 0);
  return (
    <div className="book-card card-appear"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      onClick={() => onSelect(book)}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(book)}
      aria-label={`${book.title} by ${book.author}`}
    >
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* Cover */}
        <BookCover book={book} width={48} height={68} radius={6}/>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: 14, fontWeight: 600, color: T.textPrimary,
            lineHeight: 1.35, marginBottom: 3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          }}>{normalizeTitle(book.title)}</h3>
          <p style={{ fontSize: 12, color: T.textSecondary, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {normalizeAuthor(book.author)}
          </p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {book.spiceLevel != null && (
              <SpiceLevelBadge level={book.spiceLevel} variant="compact"/>
            )}
            {hasCW && (
              <span className="pill" style={{ background: T.dangerSoft, color: T.danger, fontSize: 10, padding: '2px 7px', border: `1px solid ${T.danger}20` }}>
                CW
              </span>
            )}
            {book.confidenceLevel && (
              <span style={{ fontSize: 11, color: T.textMuted }}>
                {book.confidenceLevel === 'high' ? '●' : book.confidenceLevel === 'medium' ? '◐' : '○'}
              </span>
            )}
          </div>
        </div>

        {/* Right: score + chevron */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {scored ? (
            <ScorePill score={book.qualityScore}/>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRequest(book); }}
              style={{
                padding: '6px 10px', borderRadius: 7,
                background: T.accentSofter, border: `1px solid ${T.borderAccent}`,
                color: T.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
              }}
            >
              Score it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Row (Home Horizontal Scroll) ────────────────────────────────────
function SectionRow({ title, icon: SectionIcon, iconColor, books, loading, onSelect }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', marginBottom: 12 }}>
        <SectionIcon width={15} height={15} style={{ color: iconColor, opacity: 0.8 }}/>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: T.textSecondary, letterSpacing: '0.01em' }}>
          {title}
        </span>
      </div>
      <div className="horiz-scroll" style={{ padding: '0 16px 4px' }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonHCard key={i}/>)
          : books.map((b) => <HorizontalBookCard key={b.id} book={b} onSelect={onSelect}/>)
        }
      </div>
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab({ onSelect, onRequest, onGoSearch, onUpgradeNeeded, userPremium }) {
  const [sections, setSections] = useState({ recentlyScored: [], highestRated: [], randomPicks: [] });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/books/home-sections');
        const data = await res.json();
        setSections(data);
      } catch (err) {
        console.error('Home sections error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasContent = sections.recentlyScored.length > 0
    || sections.highestRated.length > 0
    || sections.randomPicks.length > 0;

  return (
    <div className="main-scroll">
      {/* Header */}
      <div style={{
        padding: '28px 16px 16px',
        borderBottom: `1px solid ${T.borderSubtle}`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icons.Book width={16} height={16} style={{ color: T.accent }}/>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              StyleScope
            </span>
          </div>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 28, fontWeight: 400, color: T.textPrimary,
            lineHeight: 1.1, letterSpacing: '-0.01em',
          }}>
            Romance, rated honestly.
          </h1>
        </div>
        <button onClick={onGoSearch} style={{
          width: 40, height: 40, borderRadius: 10,
          background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: T.textSecondary, flexShrink: 0, marginLeft: 12,
        }} aria-label="Search">
          <Icons.Search width={18} height={18}/>
        </button>
      </div>

      {!loading && !hasContent ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, padding: '60px 32px', textAlign: 'center',
        }}>
          <Icons.Library width={40} height={40} style={{ color: T.textMuted, opacity: 0.4 }}/>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: T.textPrimary }}>
            No scored books yet
          </h2>
          <p style={{ fontSize: 14, color: T.textMuted, maxWidth: 260, lineHeight: 1.6 }}>
            Head to Search to find books and request quality scores.
          </p>
          <button className="btn-ghost" onClick={onGoSearch} style={{ marginTop: 8 }}>
            Start searching
          </button>
        </div>
      ) : (
        <div style={{ paddingBottom: 80 }}>
          <SectionRow
            title="Recently scored"
            icon={(p) => <Icons.Clock {...p}/>}
            iconColor={T.accent}
            books={sections.recentlyScored}
            loading={loading}
            onSelect={onSelect}
          />
          <SectionRow
            title="Highest rated"
            icon={(p) => <Icons.Star {...p}/>}
            iconColor={T.warning}
            books={sections.highestRated}
            loading={loading}
            onSelect={onSelect}
          />
          <SectionRow
            title="Discover"
            icon={(p) => <Icons.Shuffle {...p}/>}
            iconColor={T.positive}
            books={sections.randomPicks}
            loading={loading}
            onSelect={onSelect}
          />

          {/* Hidden Gems */}
          <div style={{ padding: '0 16px', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Icons.Gem width={15} height={15} style={{ color: T.warning, opacity: 0.8 }}/>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary }}>
                Hidden gems
              </span>
              {!userPremium && (
                <span className="pill" style={{ background: T.accentSofter, color: T.accent, fontSize: 10, padding: '2px 7px' }}>
                  EARLY ACCESS
                </span>
              )}
            </div>
            <HiddenGemsExplorer
              userPremium={userPremium}
              onBookFound={(gem) => onSelect(gem)}
              onUpgradeNeeded={onUpgradeNeeded}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────────────────
function SearchTab({ onSelect, onRequest, onSearchExecuted }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [searched, setSearched]     = useState(false);
  const [showISBN, setShowISBN]     = useState(false);
  const [isbnValue, setIsbnValue]   = useState('');
  const [recentSearches, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ss_recent') || '[]'); } catch { return []; }
  });
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);

  const saveRecent = (q) => {
    const updated = [q, ...recentSearches.filter((x) => x !== q)].slice(0, 5);
    setRecent(updated);
    try { localStorage.setItem('ss_recent', JSON.stringify(updated)); } catch {}
  };

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    setSearched(true);
    saveRecent(q.trim());
    try {
      const res  = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : (data.books || []));
      onSearchExecuted?.();
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [recentSearches, onSearchExecuted]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 320);
  };

  const clearSearch = () => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); };

  const handleISBNSearch = async () => {
    if (!isbnValue.trim()) return;
    setQuery(isbnValue);
    setShowISBN(false);
    await doSearch(isbnValue);
    setIsbnValue('');
  };

  return (
    <div className="main-scroll">
      {/* Search header */}
      <div style={{ padding: '24px 16px 16px' }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, fontWeight: 400, color: T.textPrimary, marginBottom: 16, letterSpacing: '-0.01em' }}>
          Search
        </h2>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }}>
            <Icons.Search width={17} height={17}/>
          </div>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={handleChange}
            onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
            placeholder="Search title or author…"
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
            {query && (
              <button onClick={clearSearch} aria-label="Clear" style={{
                width: 28, height: 28, borderRadius: '50%', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.textMuted,
              }}>
                <Icons.X width={14} height={14}/>
              </button>
            )}
            <button onClick={() => alert('Camera ISBN scanning coming soon!')} aria-label="Scan ISBN" style={{
              width: 28, height: 28, borderRadius: '50%', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.textMuted,
            }}>
              <Icons.Camera width={16} height={16}/>
            </button>
          </div>
        </div>

        {/* ISBN toggle */}
        <button onClick={() => setShowISBN((v) => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.accent, fontSize: 12, fontWeight: 500,
          fontFamily: "'DM Sans', sans-serif", padding: '4px 0',
          marginBottom: showISBN ? 12 : 0, opacity: 0.85,
        }}>
          {showISBN ? 'Hide ISBN input' : 'Enter ISBN manually'}
        </button>

        {/* ISBN input */}
        {showISBN && (
          <div className="fade-in" style={{
            background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
            borderRadius: 10, padding: 14, marginBottom: 12,
          }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ISBN (10 or 13 digits)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="search-input"
                style={{ padding: '10px 14px', borderRadius: 8 }}
                type="text" inputMode="numeric"
                placeholder="9781234567890"
                value={isbnValue}
                onChange={(e) => setIsbnValue(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={13}
              />
              <button onClick={handleISBNSearch} className="btn-primary" style={{ width: 'auto', padding: '10px 16px', borderRadius: 8, flexShrink: 0, minHeight: 44 }}>
                Search
              </button>
            </div>
          </div>
        )}

        {/* Recent searches */}
        {!searched && !searching && recentSearches.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="section-header">Recent</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {recentSearches.map((q, i) => (
                <button key={i} onClick={() => { setQuery(q); doSearch(q); }} style={{
                  padding: '7px 14px', borderRadius: 999,
                  background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
                  color: T.textSecondary, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
                  minHeight: 36, transition: 'border-color 0.15s',
                }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!searched && !searching && recentSearches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '52px 0 32px' }}>
            <Icons.Book width={36} height={36} style={{ color: T.textMuted, opacity: 0.3, margin: '0 auto 14px', display: 'block' }}/>
            <p style={{ color: T.textMuted, fontSize: 14 }}>Search our library of scored romance books.</p>
            <p style={{ color: T.textMuted, fontSize: 13, marginTop: 6, opacity: 0.7 }}>
              Can't find a book? We'll score it for you.
            </p>
          </div>
        )}

        {/* Searching */}
        {searching && (
          <div style={{ textAlign: 'center', padding: '52px 0', color: T.textMuted }}>
            <div style={{
              width: 24, height: 24, border: `2px solid ${T.borderStrong}`,
              borderTopColor: T.accent, borderRadius: '50%',
              animation: 'spin 0.7s linear infinite', margin: '0 auto 14px',
            }}/>
            <span style={{ fontSize: 14 }}>Searching…</span>
          </div>
        )}

        {/* No results */}
        {!searching && searched && results.length === 0 && (
          <div style={{ padding: '40px 0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Icons.Search width={36} height={36} style={{ color: T.textMuted, opacity: 0.3, margin: '0 auto 12px', display: 'block' }}/>
              <p style={{ color: T.textSecondary, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                Not in our library yet.
              </p>
              <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                Pepper couldn't find this one. Want us to take a look?
              </p>
            </div>
            {/* On-demand prompt */}
            <div style={{
              background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
              borderRadius: 12, padding: '18px 16px',
            }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
                We haven't scored this one yet.
              </p>
              <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                Want us to take a look?
              </p>
              <button
                className="btn-primary"
                onClick={() => onRequest({ title: query, author: '' })}
                style={{ fontSize: 14 }}
              >
                Score this book (~30–60s)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {!searching && results.length > 0 && (
        <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((book, i) => (
            <BookCard key={book.id} book={book} onSelect={onSelect} onRequest={onRequest} index={i}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Book Detail Modal ─────────────────────────────────────────────────────────
function BookModal({ book, onClose, onRequest, onCwExpanded, onSectionViewed }) {
  const scored = book.qualityScore > 0;
  const dims   = book.dimensions || [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSectionClick = (section) => onSectionViewed?.(section);
  const handleCwExpand     = () => onCwExpanded?.(book);

  const cwList    = book.officialContentWarnings?.warnings || book.contentWarnings || [];
  const cwSource  = book.officialContentWarnings ? book.officialContentWarnings.source : 'community_inferred';
  const hasCW     = cwList.length > 0;
  const cwIsOfficialEnough = !!book.officialContentWarnings;

  const cwSourceLabel = {
    'llm_inferred':  'LLM inferred from description',
    'publisher':     'Publisher',
    'author':        'Author',
    'manual':        'Editorial review',
    'community_inferred': 'Community reported',
  }[cwSource] || cwSource;

  const summary = scored ? scoreSummaryLine(book, dims) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet modal-enter" onClick={(e) => e.stopPropagation()}>

        {/* Pull handle */}
        <div style={{ width: 36, height: 3, borderRadius: 2, background: T.borderStrong, margin: '14px auto 0', flexShrink: 0 }}/>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0' }}>

          {/* Top row: cover + title block + close */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
            <BookCover book={book} width={80} height={116} radius={8}/>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: 20, fontWeight: 400, lineHeight: 1.25,
                color: T.textPrimary, marginBottom: 5,
                letterSpacing: '-0.01em',
              }}>{normalizeTitle(book.title)}</h2>
              <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 6 }}>{normalizeAuthor(book.author)}</p>
              {book.series && (
                <p style={{ fontSize: 12, color: T.textMuted }}>
                  {book.series}{book.seriesNumber ? ` · Book ${book.seriesNumber}` : ''}
                </p>
              )}
            </div>

            <button onClick={onClose} aria-label="Close" style={{
              width: 32, height: 32, borderRadius: 8,
              background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: T.textMuted,
            }}>
              <Icons.X width={15} height={15}/>
            </button>
          </div>

          {/* Score block */}
          {scored ? (
            <div style={{
              background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
              borderRadius: 12, padding: '16px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 18,
            }}>
              <ScoreDisplay score={book.qualityScore}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                {summary && (
                  <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.45, marginBottom: 8 }}>
                    {summary}
                  </p>
                )}
                <ConfidenceChip level={book.confidenceLevel}/>
              </div>
            </div>
          ) : (
            /* Unscored CTA */
            <div style={{
              background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
              borderRadius: 12, padding: '18px', marginBottom: 20, textAlign: 'center',
            }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
                We haven't scored this one yet.
              </p>
              <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
                Want us to take a look?
              </p>
              <button className="btn-primary" onClick={(e) => { e.stopPropagation(); onRequest(book); }}>
                Score this book (~30–60s)
              </button>
            </div>
          )}

          {/* Spice */}
          {book.spiceLevel != null && (
            <div style={{ marginBottom: 20 }}>
              <SpiceLevelBadge level={book.spiceLevel} variant="detailed" showDescription/>
            </div>
          )}

          {/* Badges row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {book.genre && (
              <span className="pill" style={{ background: T.bgSurface, color: T.textSecondary, border: `1px solid ${T.borderSubtle}`, fontSize: 12 }}>
                {book.genre}
              </span>
            )}
            {book.publishedYear && (
              <span className="pill" style={{ background: T.bgSurface, color: T.textMuted, border: `1px solid ${T.borderSubtle}`, fontSize: 12 }}>
                {book.publishedYear}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.borderSubtle }}/>

        {/* ── BODY SECTIONS ─────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Synopsis */}
          {(book.synopsis || book.description) && (
            <div>
              <p className="section-header">About</p>
              <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.65 }}>
                {book.synopsis || book.description}
              </p>
            </div>
          )}

          {/* ── Writing Quality Breakdown ── */}
          {scored && dims.length > 0 && (
            <div>
              <p
                className="section-header"
                style={{ cursor: 'default' }}
                onClick={() => handleSectionClick('score_breakdown')}
              >
                Writing quality breakdown
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {dims.map((d) => {
                  const val = d.score * 10; // convert /10 to /100 for bar
                  const col = d.score >= 8 ? T.positive : d.score >= 6 ? T.warning : T.danger;
                  return (
                    <div key={d.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 400 }}>{d.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: col }}>{d.score}<span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>/10</span></span>
                      </div>
                      <div style={{ height: 4, background: T.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${val}%`,
                          background: col, borderRadius: 2,
                          transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)',
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Content Warnings ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, cursor: 'default' }}
              onClick={() => { handleSectionClick('content_warnings'); if (hasCW) handleCwExpand(); }}
            >
              <Icons.Warning width={13} height={13} style={{ color: T.textMuted, flexShrink: 0 }}/>
              <p className="section-header" style={{ marginBottom: 0 }}>Content warnings</p>
            </div>

            {hasCW ? (
              <div>
                {/* Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                  {cwList.map((w, i) => (
                    <span key={i} className="pill" style={{
                      background: cwIsOfficialEnough ? T.warningSoft : T.dangerSoft,
                      color: cwIsOfficialEnough ? T.warning : T.danger,
                      border: `1px solid ${cwIsOfficialEnough ? T.warning : T.danger}22`,
                      fontSize: 12, padding: '5px 11px',
                    }}>
                      {w}
                    </span>
                  ))}
                </div>

                {/* Raw text expander (publisher source) */}
                {book.officialContentWarnings?.rawText && (
                  <details style={{ marginTop: 4 }} onToggle={handleCwExpand}>
                    <summary style={{ fontSize: 12, color: T.textMuted, cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icons.ChevronLeft width={12} height={12} style={{ transform: 'rotate(-90deg)', transition: 'transform 0.2s' }}/>
                      Full warning text
                    </summary>
                    <p style={{ fontSize: 13, color: T.textMuted, marginTop: 8, lineHeight: 1.55, paddingLeft: 2 }}>
                      {book.officialContentWarnings.rawText}
                    </p>
                  </details>
                )}

                {/* Source line */}
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 8, opacity: 0.8 }}>
                  Source: {cwSourceLabel}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
                None detected based on available info.
              </p>
            )}
          </div>

          {/* ── Confidence / Context strip ── */}
          {scored && (
            <div style={{
              background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
              borderRadius: 10, padding: '13px 15px',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <Icons.Info width={15} height={15} style={{ color: T.textMuted, flexShrink: 0, marginTop: 1 }}/>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>
                    Confidence: {book.confidenceLevel ? book.confidenceLevel.charAt(0).toUpperCase() + book.confidenceLevel.slice(1) : 'Medium'}
                  </span>
                  <ConfidenceChip level={book.confidenceLevel}/>
                </div>
                <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                  {book.contextSource === 'description_only'
                    ? 'Based on description only — score may shift as more reader data arrives.'
                    : book.contextSource === 'description_and_reviews'
                    ? 'Based on description + community reviews.'
                    : 'Based on description, ratings, and community reviews.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder Tab ──────────────────────────────────────────────────────────
function PlaceholderTab({ label, IconComp, description }) {
  return (
    <div className="main-scroll">
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60dvh', gap: 12,
        padding: 32, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: T.bgSurface, border: `1px solid ${T.borderSubtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
        }}>
          <IconComp width={28} height={28} style={{ color: T.textMuted, opacity: 0.5 }}/>
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: T.textPrimary }}>
          {label}
        </h2>
        <p style={{ fontSize: 14, color: T.textMuted, maxWidth: 260, lineHeight: 1.65 }}>{description}</p>
        <span className="pill" style={{
          marginTop: 6, background: T.bgSurface, color: T.textMuted,
          border: `1px solid ${T.borderSubtle}`, fontSize: 12, padding: '5px 12px',
        }}>
          Coming soon
        </span>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'home',    label: 'Home',    IconComp: Icons.Home    },
  { key: 'search',  label: 'Search',  IconComp: Icons.Search  },
  { key: 'library', label: 'Library', IconComp: Icons.Library },
  { key: 'profile', label: 'Profile', IconComp: Icons.Profile },
];

function BottomNav({ active, onTab }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(({ key, label, IconComp }) => {
        const on = active === key;
        return (
          <button key={key} className="nav-btn" onClick={() => onTab(key)}
            aria-label={label} aria-current={on ? 'page' : undefined}
          >
            <IconComp width={20} height={20} style={{
              color: on ? T.accent : T.textMuted,
              transition: 'color 0.18s ease',
            }}/>
            <span style={{
              fontSize: 10, fontFamily: "'DM Sans', sans-serif",
              fontWeight: on ? 600 : 400,
              color: on ? T.accent : T.textMuted,
              transition: 'color 0.18s ease',
              letterSpacing: on ? 0 : '0.01em',
            }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Session ID ───────────────────────────────────────────────────────────────
function getSessionId() {
  try {
    let id = sessionStorage.getItem('ss_sid');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('ss_sid', id); }
    return id;
  } catch { return 'unknown'; }
}

// ─── Scoring Overlay ──────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 90000;

const LOADING_LINES = [
  'Reading between the blurbs…',
  'Consulting the review pile…',
  'Evaluating prose with extreme prejudice…',
  'Checking if the pacing actually lands…',
  'Running it through the snark filter…',
];

function ScoringOverlay({ book, onClose, onScored, sessionId }) {
  const [phase, setPhase]       = useState('requesting');
  const [result, setResult]     = useState(null);
  const [capInfo, setCapInfo]   = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed]   = useState(0);
  const pollRef  = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase !== 'polling') return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    async function start() {
      let jobId = null;
      try {
        // Normalize title and author before sending to API
        const normalizedTitle = normalizeTitle(book.title);
        const normalizedAuthor = normalizeAuthor(book.author);

        const res = await fetch('/api/score-on-demand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: normalizedTitle,
            author: normalizedAuthor,
            isbn: book.isbn || undefined,
            session_id: sessionId
          }),
        });
        const data = await res.json();

        if (res.status === 200 && data.status === 'already_scored') {
          if (!cancelled) { setResult({ already_scored: true, book_id: data.book_id }); setPhase('done'); }
          return;
        }
        if (res.status === 429) {
          if (!cancelled) { setCapInfo(data); setPhase('cap'); }
          api.logEvent('on_demand_cap_seen', { sessionId });
          return;
        }
        if (!res.ok || !data.job_id) throw new Error(data.error || 'Failed to start scoring');
        jobId = data.job_id;
        api.logEvent('on_demand_started', { sessionId, properties: { title: book.title } });
      } catch (err) {
        if (!cancelled) { setErrorMsg(err.message); setPhase('error'); }
        return;
      }

      if (!cancelled) setPhase('polling');
      pollRef.current = setInterval(async () => {
        if (cancelled) { clearInterval(pollRef.current); return; }
        if (Date.now() > deadline) {
          clearInterval(pollRef.current);
          setErrorMsg('Scoring is taking longer than expected. Try again in a moment.');
          setPhase('error');
          return;
        }
        try {
          const res  = await fetch(`/api/score-on-demand/${jobId}`);
          const data = await res.json();
          if (data.status === 'completed') {
            clearInterval(pollRef.current);
            setResult(data.result);
            setPhase('done');
            onScored && onScored(data.result);
            api.logEvent('on_demand_result_viewed', { sessionId, properties: { overall_score: data.result?.overall_score } });

            // Open BookModal after a brief delay to show the score
            setTimeout(() => {
              const bookId = data.result?.book_id;
              if (bookId) {
                onClose();
                // Trigger the parent to open BookModal with the newly scored book
                if (onScored) {
                  onScored({ ...data.result, book_id: bookId, shouldOpenModal: true });
                }
              }
            }, 1500); // 1.5s delay to let user see the score
          } else if (data.status === 'failed') {
            clearInterval(pollRef.current);
            const msg = data.error_message || 'Scoring failed.';
            const isRateLimit = msg.toLowerCase().includes('busy') || msg.toLowerCase().includes('limit');
            setErrorMsg(isRateLimit ? 'Our scoring engine is busy right now. Try again in a few minutes.' : msg);
            setPhase('error');
          }
        } catch { /* network blip */ }
      }, POLL_INTERVAL_MS);
    }

    start();
    return () => { cancelled = true; clearInterval(pollRef.current); clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = (content) => (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'flex-end',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-enter" style={{
        width: '100%', maxWidth: 540, margin: '0 auto',
        maxHeight: '88dvh', overflowY: 'auto',
        background: T.bgElevated,
        border: `1px solid ${T.borderStrong}`,
        borderRadius: '18px 18px 0 0',
        padding: '28px 24px 44px',
      }}>
        {content}
      </div>
    </div>
  );

  // Requesting / Polling
  if (phase === 'requesting' || phase === 'polling') {
    const lineIdx = Math.floor(elapsed / 7) % LOADING_LINES.length;
    return overlay(
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: T.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Scoring
        </p>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: T.textPrimary, marginBottom: 3 }}>
          {book.title}
        </p>
        <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 32 }}>by {book.author}</p>

        {/* Minimal spinner */}
        <div style={{
          width: 40, height: 40, margin: '0 auto 28px',
          borderRadius: '50%',
          border: `2px solid ${T.borderStrong}`,
          borderTopColor: T.accent,
          animation: 'spin 0.85s linear infinite',
        }}/>

        <p style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary, marginBottom: 10 }}>
          {phase === 'requesting' ? 'Starting…' : `${elapsed}s`}
        </p>
        <p style={{
          fontSize: 13, color: T.textMuted, minHeight: 36,
          transition: 'opacity 0.4s', padding: '0 16px', lineHeight: 1.5,
        }}>
          {LOADING_LINES[lineIdx]}
        </p>

        <div style={{
          marginTop: 28, padding: '12px 16px',
          background: T.bgSurface, borderRadius: 10, border: `1px solid ${T.borderSubtle}`,
        }}>
          <p style={{ fontSize: 12, color: T.textMuted }}>
            Usually 20–40 seconds. You can close this — the score will be saved.
          </p>
        </div>

        <button onClick={onClose} style={{
          marginTop: 18, background: 'none', border: 'none',
          color: T.textMuted, fontSize: 14, cursor: 'pointer', padding: 8,
        }}>
          Continue browsing
        </button>
      </div>
    );
  }

  // Cap reached
  if (phase === 'cap') {
    const { used = 0, cap = 10 } = capInfo || {};
    return overlay(
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
          background: T.warningSoft, border: `1px solid ${T.warning}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.Info width={22} height={22} style={{ color: T.warning }}/>
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: T.textPrimary, marginBottom: 12 }}>
          Score slots used for now.
        </p>
        <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.65, marginBottom: 20, maxWidth: 340, margin: '0 auto 20px' }}>
          You've used all {cap} score slots for this month. StyleScope is in early access and slots are limited while we keep costs sustainable. Your slots reset on the 1st — more options coming soon.
        </p>
        <div style={{
          padding: '12px 16px',
          background: T.bgSurface, borderRadius: 10, border: `1px solid ${T.borderSubtle}`,
          fontSize: 13, color: T.textMuted, marginBottom: 24, lineHeight: 1.5,
        }}>
          Already in the library? Search the exact title to see scores for free.
        </div>
        <button className="btn-primary" onClick={onClose}>Got it</button>
      </div>
    );
  }

  // Error
  if (phase === 'error') {
    return overlay(
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
          background: T.dangerSoft, border: `1px solid ${T.danger}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.Warning width={22} height={22} style={{ color: T.danger }}/>
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: T.textPrimary, marginBottom: 12 }}>
          Something went wrong.
        </p>
        <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 28, lineHeight: 1.55 }}>{errorMsg}</p>
        <button className="btn-primary" onClick={onClose}>Close</button>
      </div>
    );
  }

  // Done - This phase is now just for showing the score briefly before opening BookModal
  // The actual modal opening happens automatically via useEffect
  if (phase === 'done') {
    const alreadyScored = result?.already_scored;
    const score         = result?.overall_score;
    const col           = score ? scoreColor(score) : T.accent;
    return overlay(
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: T.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          {alreadyScored ? 'Already in library' : 'Score ready'}
        </p>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: T.textPrimary, marginBottom: 3 }}>
          {book.title}
        </p>
        <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 28 }}>by {book.author}</p>

        {!alreadyScored && score != null && (
          <div style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 72, fontWeight: 400, lineHeight: 1,
            color: col, marginBottom: 4,
            animation: 'scoreIn 0.5s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            {score}
          </div>
        )}

        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28, lineHeight: 1.55 }}>
          Opening full scorecard...
        </p>

        <div style={{
          width: 24, height: 24, margin: '0 auto',
          borderRadius: '50%',
          border: `2px solid ${T.borderStrong}`,
          borderTopColor: T.accent,
          animation: 'spin 0.85s linear infinite',
        }}/>
      </div>
    );
  }

  return null;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]                       = useState('home');
  const [selected, setSelected]             = useState(null);
  const [showUpgrade, setShowUpgrade]       = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Premium Features');
  const [scoringBook, setScoringBook]       = useState(null);
  const sessionId = useRef(getSessionId()).current;

  const [userPremium] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('ss_user') || '{}');
      return user.subscription_status === 'active';
    } catch { return false; }
  });

  useEffect(() => {
    api.logEvent('app_open', { sessionId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgradeNeeded = (feature) => {
    setUpgradeFeature(feature || 'Premium Features');
    setShowUpgrade(true);
  };

  const handleSelect = useCallback((book) => {
    setSelected(book);
    api.logEvent('book_viewed', { sessionId, properties: { book_id: book.id, title: book.title } });
  }, [sessionId]);

  const handleRequestScore = useCallback((book) => {
    setScoringBook(book);
    api.logEvent('score_requested', { sessionId, properties: { title: book.title, author: book.author } });
  }, [sessionId]);

  return (
    <>
      <style>{globalCSS}</style>
      <div className="app-container">

        {tab === 'home' && (
          <HomeTab
            onSelect={handleSelect}
            onRequest={handleRequestScore}
            onGoSearch={() => setTab('search')}
            userPremium={userPremium}
            onUpgradeNeeded={() => handleUpgradeNeeded('Hidden Gems')}
          />
        )}
        {tab === 'search' && (
          <SearchTab
            onSelect={handleSelect}
            onRequest={handleRequestScore}
            onSearchExecuted={() => api.logEvent('search', { sessionId })}
          />
        )}
        {tab === 'library' && (
          <PlaceholderTab
            label="Library"
            IconComp={Icons.Library}
            description="Save and organize your favorite reads. Your personal collection lives here."
          />
        )}
        {tab === 'profile' && (
          <PlaceholderTab
            label="Profile"
            IconComp={Icons.Profile}
            description="Your reading stats, preferences, and scoring history will appear here."
          />
        )}

        <BottomNav active={tab} onTab={setTab}/>

        {selected && (
          <BookModal
            book={selected}
            onClose={() => setSelected(null)}
            onRequest={handleRequestScore}
            onCwExpanded={(book) => api.logEvent('detail_cw_expanded', {
              sessionId,
              properties: {
                book_id: book.id,
                cw_count: (book.officialContentWarnings?.warnings ?? book.contentWarnings ?? []).length,
                source: book.officialContentWarnings ? 'official' : 'inferred',
              },
            })}
            onSectionViewed={(section) => api.logEvent('detail_section_viewed', {
              sessionId,
              properties: { book_id: selected.id, section },
            })}
          />
        )}

        {scoringBook && (
          <ScoringOverlay
            book={scoringBook}
            sessionId={sessionId}
            onClose={() => setScoringBook(null)}
            onScored={(result) => {
              setScoringBook(null);
              // If the scoring completed with a book_id and shouldOpenModal flag, open the BookModal
              if (result?.shouldOpenModal && result?.book_id) {
                // Fetch the full book data and open the modal
                fetch(`/api/books/${result.book_id}`)
                  .then(r => r.json())
                  .then(book => {
                    if (book && !book.error) {
                      setSelectedBook(book);
                    }
                  })
                  .catch(err => console.error('Failed to fetch book:', err));
              }
            }}
          />
        )}

        {showUpgrade && (
          <UpgradeModal
            feature={upgradeFeature}
            onClose={() => setShowUpgrade(false)}
          />
        )}
      </div>
    </>
  );
}
