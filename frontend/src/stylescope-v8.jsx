import { useState, useEffect, useCallback, useRef } from "react";
import { UpgradeModal } from "./components/UpgradeModal";
import { HiddenGemsExplorer } from "./components/HiddenGemsExplorer";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  purple:     '#C77DFF',
  pink:       '#FF6B9D',
  bg:         '#0a0118',
  cardBg:     '#1a0a2e',
  cardBgEnd:  '#2a1a3a',
  danger:     '#ef4444',
  text:       '#ffffff',
  textMuted:  '#cccccc',
  textSubtle: '#888888',
  green:      '#4ade80',
  yellow:     '#fbbf24',
};
const GRAD = 'linear-gradient(135deg, #C77DFF 0%, #FF6B9D 100%)';

// ─── Spice Level Definitions ──────────────────────────────────────────────────
const SPICE_LEVELS = {
  0: { label: 'CLEAN',      subtitle: 'No sexual content', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  iconType: 'book',            description: 'Kissing only, fade-to-black, or no romance scenes' },
  1: { label: 'SWEET',      subtitle: 'Closed door',       color: '#f472b6', bg: 'rgba(244,114,182,0.12)', iconType: 'heart',           description: 'Sensuality implied, nothing explicit shown' },
  2: { label: 'WARM',       subtitle: 'Mild steam',        color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  iconType: 'thermometer-low', description: 'Some explicit scenes, not overly detailed' },
  3: { label: 'STEAMY',     subtitle: 'Moderate heat',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  iconType: 'thermometer-mid', description: 'Multiple explicit scenes with detail' },
  4: { label: 'HOT',        subtitle: 'High heat',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   iconType: 'thermometer-full',description: 'Frequent explicit scenes, graphic detail' },
  5: { label: 'VERY SPICY', subtitle: 'Explicit content',  color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   iconType: 'flame',           description: 'Extremely graphic, frequent scenes, kink elements' },
  6: { label: 'SCORCHING',  subtitle: 'Erotica',           color: '#991b1b', bg: 'rgba(153,27,27,0.14)',   iconType: 'triple-flame',    description: 'Plot-focused erotica, taboo themes, extreme kink' },
};

// ─── Global Styles ─────────────────────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Nunito:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root {
    height: 100%; background: ${C.bg}; color: ${C.text};
    font-family: 'Nunito', sans-serif; -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #3a2a5a; border-radius: 4px; }
  * { -webkit-tap-highlight-color: transparent; }

  @keyframes fadeIn   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
  @keyframes spin     { to { transform:rotate(360deg); } }
  @keyframes slideUp  { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
  @keyframes fadeSlide{ from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }

  .card-appear  { animation: fadeIn 0.3s ease both; }
  .fade-slide   { animation: fadeSlide 0.25s ease both; }
  .skeleton     { animation: pulse 1.6s ease-in-out infinite; background: #2a1a3e; border-radius: 8px; }
  .modal-enter  { animation: slideUp 0.32s cubic-bezier(0.34,1.4,0.64,1) both; }

  .books-grid {
    display: grid; gap: 16px; grid-template-columns: 1fr;
    padding: 16px 16px 100px;
  }
  @media(min-width:768px)  { .books-grid { grid-template-columns:repeat(2,1fr); padding:24px 24px 100px; } }
  @media(min-width:1200px) { .books-grid { grid-template-columns:repeat(3,1fr); padding:32px 32px 100px; } }

  .book-card {
    background: linear-gradient(135deg,${C.cardBg} 0%,${C.cardBgEnd} 100%);
    border-radius:16px; border:1px solid rgba(199,125,255,0.12);
    cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease;
    overflow:hidden; position:relative;
  }
  .book-card:active { transform:scale(0.97); box-shadow:0 2px 8px rgba(199,125,255,0.2); }
  .book-card:not(:active) { box-shadow:0 4px 16px rgba(0,0,0,0.4); }

  .h-card {
    background:linear-gradient(135deg,${C.cardBg} 0%,${C.cardBgEnd} 100%);
    border-radius:14px; border:1px solid rgba(199,125,255,0.1);
    min-width:148px; max-width:148px; flex-shrink:0;
    cursor:pointer; transition:transform 0.15s ease;
    overflow:hidden;
  }
  .h-card:active { transform:scale(0.96); }

  .bottom-nav {
    position:fixed; bottom:0; left:0; right:0; height:64px;
    background:rgba(10,1,24,0.96); backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    border-top:1px solid rgba(199,125,255,0.15);
    display:flex; align-items:center; justify-content:space-around; z-index:100;
  }
  .nav-btn {
    display:flex; flex-direction:column; align-items:center; gap:4px;
    padding:8px 20px; min-width:44px; min-height:44px;
    background:none; border:none; cursor:pointer; border-radius:12px;
    position:relative; transition:background 0.15s ease;
  }
  .nav-btn:active { background:rgba(199,125,255,0.1); }

  .search-input {
    width:100%; padding:14px 48px 14px 16px;
    background:${C.cardBg}; border:1px solid rgba(199,125,255,0.2);
    border-radius:12px; color:${C.text};
    font-family:'Nunito',sans-serif; font-size:15px;
    outline:none; transition:border-color 0.2s ease;
  }
  .search-input:focus { border-color:${C.purple}; }
  .search-input::placeholder { color:${C.textSubtle}; }

  .modal-overlay {
    position:fixed; inset:0; background:rgba(0,0,0,0.78);
    backdrop-filter:blur(4px); z-index:200;
    display:flex; align-items:flex-end; justify-content:center;
  }
  @media(min-width:768px) { .modal-overlay { align-items:center; } }

  .modal-sheet {
    width:100%; max-width:600px; max-height:88vh;
    background:${C.cardBg}; border-radius:20px 20px 0 0;
    overflow-y:auto; padding:24px; position:relative;
  }
  @media(min-width:768px) {
    .modal-sheet { border-radius:20px; max-height:80vh; margin:16px; }
  }
  .main-scroll {
    overflow-y:auto; height:calc(100vh - 64px);
    -webkit-overflow-scrolling:touch;
  }
  .horiz-scroll {
    display:flex; overflow-x:auto; gap:12px;
    padding-bottom:4px; scroll-snap-type:x mandatory;
  }
  .horiz-scroll::-webkit-scrollbar { height:3px; }
  .horiz-scroll > * { scroll-snap-align:start; }

  .btn-press { transition:transform 0.1s ease; }
  .btn-press:active { transform:scale(0.95); }

  .tag {
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 9px; border-radius:20px;
    font-size:11px; font-weight:600; font-family:'Nunito',sans-serif;
  }
`;

// ─── SVG Icon Library ──────────────────────────────────────────────────────────
const Icons = {
  Home:    (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>,
  Search:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Library: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Profile: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  X:       (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Chevron: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Camera:  (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Clock:   (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Star:    (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Shuffle: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>,
};

// ─── Spice Icons ──────────────────────────────────────────────────────────────
const SpiceIcon = ({ type, color, size = 18 }) => {
  const s = { width: size, height: size, flexShrink: 0 };
  const icons = {
    book: (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"
          stroke={color} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    heart: (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          stroke={color} strokeWidth="2"/>
      </svg>
    ),
    'thermometer-low': (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="2"/>
        <rect x="10.25" y="13" width="3.5" height="3" fill={color} opacity="0.4"/>
        <circle cx="11.5" cy="18.5" r="2" fill={color}/>
      </svg>
    ),
    'thermometer-mid': (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="2"/>
        <rect x="10.25" y="8" width="3.5" height="8" fill={color} opacity="0.4"/>
        <circle cx="11.5" cy="18.5" r="2" fill={color}/>
      </svg>
    ),
    'thermometer-full': (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke={color} strokeWidth="2"/>
        <rect x="10.25" y="3.5" width="3.5" height="12.5" fill={color} opacity="0.45"/>
        <circle cx="11.5" cy="18.5" r="2" fill={color}/>
      </svg>
    ),
    flame: (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.5 7 9 10.5 9 12a3 3 0 0 0 6 0c0-1.5-.5-3-3-10z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'triple-flame': (
      <svg style={s} viewBox="0 0 24 24" fill="none">
        <path d="M7 20a2.5 2.5 0 0 0 2.5-2.5c0-1.5-.8-3-2.5-6.5 1.7 3.5 2.5 5 2.5 6.5a2.5 2.5 0 0 0 5 0c0-2.5-1.5-5-5-11 3.5 6 5 8.5 5 11a2.5 2.5 0 0 0 5 0c0-1.5-.8-3-2.5-6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
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
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 6,
        background: sp.bg, border: `1px solid ${sp.color}30`,
        fontSize: 11, fontWeight: 700, color: sp.color,
        fontFamily: "'Nunito', sans-serif", letterSpacing: '0.03em',
      }}>
        <SpiceIcon type={sp.iconType} color={sp.color} size={12}/>
        {sp.label}
      </span>
    );
  }

  if (variant === 'detailed') {
    return (
      <div style={{
        padding: 14, borderRadius: 12,
        background: sp.bg, border: `1px solid ${sp.color}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: showDescription ? 8 : 0 }}>
          <SpiceIcon type={sp.iconType} color={sp.color} size={28}/>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: sp.color, fontFamily: "'Sora',sans-serif", letterSpacing: '0.04em' }}>
              {sp.label}
            </div>
            <div style={{ fontSize: 13, color: sp.color, opacity: 0.75, marginTop: 1 }}>
              {sp.subtitle}
            </div>
          </div>
        </div>
        {showDescription && (
          <p style={{ fontSize: 13, color: sp.color, opacity: 0.8, lineHeight: 1.5, marginTop: 4 }}>
            {sp.description}
          </p>
        )}
      </div>
    );
  }

  // default
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '5px 11px', borderRadius: 8,
      background: sp.bg, border: `1px solid ${sp.color}25`,
      fontSize: 13, fontWeight: 700, color: sp.color,
      fontFamily: "'Nunito', sans-serif", letterSpacing: '0.04em',
    }}>
      <SpiceIcon type={sp.iconType} color={sp.color} size={16}/>
      {sp.label}
    </span>
  );
}

// ─── Score Helpers ────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? C.green : s >= 60 ? C.yellow : C.danger;

function QualityRing({ score, size = 72 }) {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col  = scoreColor(score);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${fill} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size > 60 ? 17 : 12, fontWeight: 800, fontFamily: "'Sora',sans-serif", color: col, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: C.textSubtle }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Unscored Badge ───────────────────────────────────────────────────────────
function UnscoredBadge({ book, onRequest }) {
  const [pressed, setPressed] = useState(false);
  const pressProps = {
    onTouchStart: () => setPressed(true), onTouchEnd: () => setPressed(false),
    onMouseDown: () => setPressed(true), onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg,#3a2a5a 0%,#2a1a4a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px dashed #555', flexShrink: 0,
      }}>
        <span style={{ fontSize: 22, color: '#888', fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>?</span>
      </div>
      <span style={{ fontSize: 11, color: C.textSubtle }}>Score pending</span>
      <button className="btn-press" {...pressProps}
        onClick={(e) => { e.stopPropagation(); onRequest(book); }}
        style={{
          padding: '7px 14px', background: GRAD, color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          fontFamily: "'Nunito',sans-serif", fontWeight: 700,
          transform: pressed ? 'scale(0.95)' : 'scale(1)',
          transition: 'transform 0.1s ease',
          boxShadow: '0 4px 12px rgba(199,125,255,0.3)',
          minHeight: 36,
        }}
      >
        Request Score
      </button>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: `linear-gradient(135deg,${C.cardBg} 0%,${C.cardBgEnd} 100%)`,
      borderRadius: 16, border: '1px solid rgba(199,125,255,0.07)',
      padding: 16, display: 'flex', gap: 16,
    }}>
      <div className="skeleton" style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0 }}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 15, width: '80%' }}/>
        <div className="skeleton" style={{ height: 12, width: '50%' }}/>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="skeleton" style={{ height: 22, width: 72, borderRadius: 20 }}/>
          <div className="skeleton" style={{ height: 22, width: 52, borderRadius: 20 }}/>
        </div>
      </div>
    </div>
  );
}

function SkeletonHCard() {
  return (
    <div style={{
      minWidth: 148, maxWidth: 148, flexShrink: 0,
      background: `linear-gradient(135deg,${C.cardBg} 0%,${C.cardBgEnd} 100%)`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div className="skeleton" style={{ width: '100%', height: 112 }}/>
      <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 12, width: '90%' }}/>
        <div className="skeleton" style={{ height: 11, width: '65%' }}/>
        <div className="skeleton" style={{ height: 20, width: 70, borderRadius: 20 }}/>
      </div>
    </div>
  );
}

// ─── Horizontal Book Card ─────────────────────────────────────────────────────
function HorizontalBookCard({ book, onSelect }) {
  return (
    <div className="h-card" onClick={() => onSelect(book)}>
      {/* Cover area */}
      <div style={{
        width: '100%', height: 112,
        background: 'linear-gradient(135deg,#2a1a4a 0%,#3a1a5a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {book.qualityScore > 0 ? (
          <QualityRing score={book.qualityScore} size={60}/>
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(0,0,0,0.3)',
            border: '2px dashed #555',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 18, color: '#666', fontWeight: 700 }}>?</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '10px 10px 12px' }}>
        <p style={{
          fontSize: 12, fontWeight: 700, color: C.text,
          lineHeight: 1.3, marginBottom: 3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          fontFamily: "'Sora',sans-serif",
        }}>{book.title}</p>
        <p style={{
          fontSize: 11, color: C.textSubtle, marginBottom: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{book.author}</p>
        {book.spiceLevel !== null && book.spiceLevel !== undefined && (
          <SpiceLevelBadge level={book.spiceLevel} variant="compact"/>
        )}
      </div>
    </div>
  );
}

// ─── Book Card (Grid) ─────────────────────────────────────────────────────────
function BookCard({ book, onSelect, onRequest, index }) {
  const scored = book.qualityScore > 0;
  return (
    <div className="book-card card-appear"
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
      onClick={() => onSelect(book)}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(book)}
      aria-label={`${book.title} by ${book.author}`}
    >
      <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
          {scored
            ? <QualityRing score={book.qualityScore} size={72}/>
            : <UnscoredBadge book={book} onRequest={onRequest}/>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700,
            color: C.text, lineHeight: 1.3, marginBottom: 4,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{book.title}</h3>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{book.author}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {book.spiceLevel !== null && book.spiceLevel !== undefined && (
              <SpiceLevelBadge level={book.spiceLevel} variant="compact"/>
            )}
            {book.series && (
              <span className="tag" style={{ background: 'rgba(199,125,255,0.1)', color: C.purple }}>
                Series
              </span>
            )}
            {book.genre && (
              <span className="tag" style={{ background: 'rgba(255,255,255,0.06)', color: C.textSubtle }}>
                {book.genre}
              </span>
            )}
          </div>
        </div>
        <div style={{ alignSelf: 'center', color: C.textSubtle, flexShrink: 0 }}>
          <Icons.Chevron width={16} height={16}/>
        </div>
      </div>
    </div>
  );
}

// ─── Section Row (Home Horizontal Scroll) ────────────────────────────────────
function SectionRow({ title, icon: SectionIcon, iconColor, books, loading, onSelect }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', marginBottom: 12 }}>
        <SectionIcon width={18} height={18} style={{ color: iconColor }}/>
        <h2 style={{
          fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: C.text,
        }}>{title}</h2>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/books/home-sections');
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
      {/* Sticky header */}
      <div style={{
        padding: '24px 16px 12px',
        position: 'sticky', top: 0, zIndex: 10,
        background: `linear-gradient(180deg,${C.bg} 60%,transparent 100%)`,
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Sora',sans-serif", fontSize: 26, fontWeight: 800,
            background: GRAD, WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            lineHeight: 1.1,
          }}>StyleScope</h1>
          <p style={{ fontSize: 12, color: C.textSubtle, marginTop: 2 }}>
            AI-scored romance book discovery
          </p>
        </div>
        <button
          onClick={onGoSearch}
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(199,125,255,0.1)',
            border: '1px solid rgba(199,125,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.purple, flexShrink: 0,
          }}
          aria-label="Go to search"
        >
          <Icons.Search width={20} height={20}/>
        </button>
      </div>

      {!loading && !hasContent ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, padding: '60px 32px', textAlign: 'center',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(199,125,255,0.08)',
            border: '2px solid rgba(199,125,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icons.Library width={36} height={36} style={{ color: 'rgba(199,125,255,0.4)' }}/>
          </div>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 700 }}>
            No scored books yet
          </h2>
          <p style={{ fontSize: 14, color: C.textSubtle, maxWidth: 260 }}>
            Head to Search to find books and request AI quality scores.
          </p>
          <button
            className="btn-press"
            onClick={onGoSearch}
            style={{
              marginTop: 8, padding: '12px 28px', background: GRAD,
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Nunito',sans-serif",
              boxShadow: '0 4px 16px rgba(199,125,255,0.35)',
            }}
          >
            Start Searching
          </button>
        </div>
      ) : (
        <div style={{ paddingBottom: 80 }}>
          <SectionRow
            title="Recently Scored"
            icon={(p) => <Icons.Clock {...p}/>}
            iconColor={C.purple}
            books={sections.recentlyScored}
            loading={loading}
            onSelect={onSelect}
          />
          <SectionRow
            title="Highest Rated"
            icon={(p) => <Icons.Star {...p}/>}
            iconColor={C.yellow}
            books={sections.highestRated}
            loading={loading}
            onSelect={onSelect}
          />
          <SectionRow
            title="Random Picks"
            icon={(p) => <Icons.Shuffle {...p}/>}
            iconColor={C.pink}
            books={sections.randomPicks}
            loading={loading}
            onSelect={onSelect}
          />

          {/* Hidden Gems Discovery */}
          <div style={{ padding: '0 16px', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{'\uD83D\uDC8E'}</span>
              <h2 style={{
                fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: C.text,
              }}>Hidden Gems</h2>
              {!userPremium && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: 'rgba(199,125,255,0.15)',
                  color: C.purple, padding: '2px 8px',
                  borderRadius: 10, fontFamily: "'Nunito',sans-serif",
                }}>PREMIUM</span>
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
function SearchTab({ onSelect, onRequest }) {
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
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : (data.books || []));
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [recentSearches]);

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
      <div style={{ padding: '24px 16px 16px' }}>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
          Search
        </h2>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={handleChange}
            onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
            placeholder="Title, author, series, or ISBN..."
            autoComplete="off" autoCorrect="off" spellCheck={false}
          />
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
            {query && (
              <button onClick={clearSearch} aria-label="Clear"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.textSubtle,
                }}
              >
                <Icons.X width={16} height={16}/>
              </button>
            )}
            <button
              onClick={() => alert('Camera ISBN scanning coming soon!')}
              aria-label="Scan ISBN"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.textSubtle,
              }}
            >
              <Icons.Camera width={18} height={18}/>
            </button>
          </div>
        </div>

        {/* ISBN toggle */}
        <button
          onClick={() => setShowISBN((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.purple, fontSize: 13, fontWeight: 700,
            fontFamily: "'Nunito',sans-serif", padding: '4px 0',
            marginBottom: showISBN ? 12 : 0,
          }}
        >
          {showISBN ? 'Hide ISBN input' : 'Enter ISBN manually'}
        </button>

        {/* ISBN input */}
        {showISBN && (
          <div className="fade-slide" style={{
            background: 'rgba(199,125,255,0.06)',
            border: '1px solid rgba(199,125,255,0.15)',
            borderRadius: 12, padding: 14, marginBottom: 12,
          }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 8 }}>
              ISBN (10 or 13 digits)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="search-input"
                style={{ padding: '10px 14px' }}
                type="text"
                inputMode="numeric"
                placeholder="9781234567890"
                value={isbnValue}
                onChange={(e) => setIsbnValue(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={13}
              />
              <button
                className="btn-press"
                onClick={handleISBNSearch}
                style={{
                  padding: '10px 16px', background: GRAD,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Nunito',sans-serif", flexShrink: 0,
                  minHeight: 44,
                }}
              >
                Search
              </button>
            </div>
          </div>
        )}

        {/* Recent searches */}
        {!searched && !searching && recentSearches.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, color: C.textSubtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Recent
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {recentSearches.map((q, i) => (
                <button
                  key={i}
                  className="btn-press"
                  onClick={() => { setQuery(q); doSearch(q); }}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    background: 'rgba(199,125,255,0.08)',
                    border: '1px solid rgba(199,125,255,0.15)',
                    color: C.textMuted, fontSize: 13, cursor: 'pointer',
                    fontFamily: "'Nunito',sans-serif",
                    minHeight: 36,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* States */}
        {searching && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.textSubtle }}>
            <div style={{
              width: 28, height: 28, border: '3px solid rgba(199,125,255,0.15)',
              borderTopColor: C.purple, borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
              margin: '0 auto 14px',
            }}/>
            Searching...
          </div>
        )}

        {!searching && searched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Icons.Search width={44} height={44} style={{ color: C.textSubtle }}/>
            <p style={{ color: C.textMuted, marginTop: 14, fontSize: 15, fontWeight: 600 }}>
              No results found
            </p>
            <p style={{ color: C.textSubtle, marginTop: 6, fontSize: 13 }}>
              Try different keywords or check spelling
            </p>
          </div>
        )}

        {!searching && !searched && recentSearches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Icons.Search width={48} height={48} style={{ color: 'rgba(199,125,255,0.25)' }}/>
            <p style={{ color: C.textSubtle, marginTop: 14, fontSize: 14 }}>
              Search 1,000 romance books
            </p>
          </div>
        )}
      </div>

      {!searching && results.length > 0 && (
        <div className="books-grid" style={{ paddingTop: 0 }}>
          {results.map((book, i) => (
            <BookCard key={book.id} book={book} onSelect={onSelect} onRequest={onRequest} index={i}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Book Detail Modal ─────────────────────────────────────────────────────────
function BookModal({ book, onClose, onRequest }) {
  const scored = book.qualityScore > 0;
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const dims = book.dimensions || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet modal-enter" onClick={(e) => e.stopPropagation()}>
        {/* Pull handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }}/>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div>
            {scored
              ? <QualityRing score={book.qualityScore} size={80}/>
              : <UnscoredBadge book={book} onRequest={onRequest}/>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800,
              color: C.text, lineHeight: 1.3, marginBottom: 4,
            }}>{book.title}</h2>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 10 }}>{book.author}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {book.spiceLevel !== null && book.spiceLevel !== undefined && (
                <SpiceLevelBadge level={book.spiceLevel} variant="default"/>
              )}
              {book.genre && (
                <span className="tag" style={{ background: 'rgba(255,255,255,0.06)', color: C.textSubtle, padding: '4px 10px' }}>
                  {book.genre}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icons.X width={18} height={18} style={{ color: C.textMuted }}/>
          </button>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }}/>

        {/* Spice description (detailed) */}
        {book.spiceLevel !== null && book.spiceLevel !== undefined && (
          <div style={{ marginBottom: 20 }}>
            <SpiceLevelBadge level={book.spiceLevel} variant="detailed" showDescription/>
          </div>
        )}

        {/* Series */}
        {book.series && (
          <div style={{
            background: 'rgba(199,125,255,0.08)',
            border: '1px solid rgba(199,125,255,0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 13, color: C.purple, fontWeight: 600 }}>
              Series: {book.series}{book.seriesNumber ? ` #${book.seriesNumber}` : ''}
            </span>
          </div>
        )}

        {/* Description */}
        {book.description && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8, fontFamily: "'Sora',sans-serif" }}>
              About
            </p>
            <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>{book.description}</p>
          </div>
        )}

        {/* Score breakdown */}
        {scored && dims.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12, fontFamily: "'Sora',sans-serif" }}>
              Score Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dims.map((d) => {
                const pct = (d.score / 10) * 100;
                const col = d.score >= 8 ? C.green : d.score >= 6 ? C.yellow : C.danger;
                return (
                  <div key={d.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.textMuted }}>{d.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{d.score}/10</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 3, transition: 'width 0.6s ease' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content warnings */}
        {book.contentWarnings && book.contentWarnings.length > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: 10, padding: '10px 14px',
          }}>
            <p style={{ fontSize: 11, color: C.danger, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Content Warnings
            </p>
            <p style={{ fontSize: 13, color: C.textMuted }}>{book.contentWarnings.join(' · ')}</p>
          </div>
        )}
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
        justifyContent: 'center', minHeight: '60vh', gap: 12,
        padding: 32, textAlign: 'center',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(199,125,255,0.08)',
          border: '2px solid rgba(199,125,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
        }}>
          <IconComp width={32} height={32} style={{ color: 'rgba(199,125,255,0.45)' }}/>
        </div>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 700 }}>{label}</h2>
        <p style={{ fontSize: 14, color: C.textSubtle, maxWidth: 260, lineHeight: 1.6 }}>{description}</p>
        <div style={{
          marginTop: 8, padding: '8px 20px', borderRadius: 20,
          background: 'rgba(199,125,255,0.09)',
          border: '1px solid rgba(199,125,255,0.2)',
          fontSize: 13, color: C.purple, fontWeight: 700,
        }}>
          Coming soon
        </div>
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
            <IconComp width={22} height={22} style={{ color: on ? C.purple : C.textSubtle, transition: 'color 0.2s' }}/>
            <span style={{
              fontSize: 10, fontFamily: "'Nunito',sans-serif",
              fontWeight: on ? 700 : 500, color: on ? C.purple : C.textSubtle,
              transition: 'color 0.2s',
            }}>{label}</span>
            {on && (
              <span style={{
                position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                width: 4, height: 4, borderRadius: '50%', background: C.purple,
              }}/>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState('home');
  const [selected, setSelected]     = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Premium Features');

  // Simple premium check — in production this would come from auth state
  const [userPremium] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('ss_user') || '{}');
      return user.subscription_status === 'active';
    } catch { return false; }
  });

  const handleUpgradeNeeded = (feature) => {
    setUpgradeFeature(feature || 'Premium Features');
    setShowUpgrade(true);
  };

  const handleRequestScore = async (book) => {
    try {
      const res = await fetch('/api/score-on-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: book.title, author: book.author }),
      });
      const data = await res.json();
      if (data.job_id) {
        alert('Scoring request submitted! Check back in ~30 seconds.');
      }
    } catch (err) {
      console.error('Score request failed:', err);
      alert('Failed to request score. Please try again.');
    }
  };

  return (
    <>
      <style>{globalCSS}</style>

      {tab === 'home' && (
        <HomeTab
          onSelect={setSelected}
          onRequest={handleRequestScore}
          onGoSearch={() => setTab('search')}
          userPremium={userPremium}
          onUpgradeNeeded={() => handleUpgradeNeeded('Hidden Gems')}
        />
      )}
      {tab === 'search' && (
        <SearchTab
          onSelect={setSelected}
          onRequest={handleRequestScore}
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
        />
      )}

      {showUpgrade && (
        <UpgradeModal
          feature={upgradeFeature}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  );
}
