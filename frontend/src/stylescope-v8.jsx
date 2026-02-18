// ─────────────────────────────────────────────────────────────────────────────
// StyleScope v8 — Production UI
// React + Vite · No emojis · Dark atmospheric · Spotify meets Goodreads
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

// ─── Color & Label Constants ──────────────────────────────────────────────────
const C = {
  bgFrom:   "#120c1f",
  bgTo:     "#2D1B4E",
  pink:     "#FF6B9D",
  orange:   "#FF8C42",
  purple:   "#C77DFF",
  q90: "#22c55e",
  q80: "#60a5fa",
  q70: "#f59e0b",
  q60: "#f97316",
  qLow:"#ef4444",
  cardBg:     "linear-gradient(145deg, #ffffff 0%, #f8f2ff 100%)",
  cardBorder: "rgba(199,125,255,0.15)",
  shadow:     "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.05)",
  shadowHover:"0 12px 48px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.07)",
  text:      "#1a0a2e",
  textMid:   "#4a3568",
  textMuted: "#8870a8",
  spice: ["#94a3b8","#84cc16","#f59e0b","#f97316","#ef4444","#FF6B9D","#C77DFF"],
  spiceLbl: ["Sweet","Warm","Mild Heat","Hot","Steamy","Scorching","Nuclear"],
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:'Nunito',sans-serif;
  background:linear-gradient(135deg,#120c1f 0%,#2D1B4E 100%);
  background-attachment:fixed;
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  color:#fff;
}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:rgba(255,255,255,0.04)}
::-webkit-scrollbar-thumb{background:rgba(199,125,255,0.35);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:rgba(199,125,255,0.55)}
.no-sb::-webkit-scrollbar{display:none}
.no-sb{scrollbar-width:none;-ms-overflow-style:none}
button{cursor:pointer;border:none;background:none;font-family:inherit}
input,select,textarea{font-family:inherit;outline:none}
::selection{background:rgba(199,125,255,0.3);color:#fff}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
.fade-up{animation:fadeUp 0.35s ease both}
.pulse{animation:pulse 1.5s ease-in-out infinite}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const qColor = s => s >= 90 ? C.q90 : s >= 80 ? C.q80 : s >= 70 ? C.q70 : s >= 60 ? C.q60 : C.qLow;
const qLabel = s => s >= 90 ? "Exceptional" : s >= 80 ? "Strong" : s >= 70 ? "Solid" : s >= 60 ? "Uneven" : "Rough";
const arr    = v => Array.isArray(v) ? v : [];
const fmt    = n => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n ?? "");

// ─── GlossyBookIcon ───────────────────────────────────────────────────────────
function GlossyBookIcon({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bookGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C77DFF" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#FF6B9D" stopOpacity="0.7"/>
        </linearGradient>
        <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#120c1f" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#120c1f" stopOpacity="0.05"/>
        </linearGradient>
        <filter id="bookShadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.25"/>
        </filter>
      </defs>
      <rect x="16" y="12" width="52" height="66" rx="5" fill="url(#bookGrad)" filter="url(#bookShadow)"/>
      <rect x="16" y="12" width="10" height="66" rx="4" fill="url(#spineGrad)"/>
      <rect x="28" y="28" width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.55)"/>
      <rect x="28" y="35" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.35)"/>
      <rect x="28" y="42" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.25)"/>
      <ellipse cx="32" cy="22" rx="8" ry="4" fill="rgba(255,255,255,0.18)" transform="rotate(-20 32 22)"/>
    </svg>
  );
}

// ─── QRing ────────────────────────────────────────────────────────────────────
function QRing({ score, size = 56, strokeWidth = 5 }) {
  const r    = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (circ * Math.min(score ?? 0, 100)) / 100;
  const col  = qColor(score ?? 0);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0, display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={strokeWidth}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}/>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontSize={size < 50 ? "11" : "14"} fontWeight="800"
        fontFamily="'Sora',sans-serif" fill={col}>
        {score ?? "—"}
      </text>
    </svg>
  );
}

// ─── SpiceBadge ───────────────────────────────────────────────────────────────
function SpiceBadge({ level }) {
  if (level == null) return null;
  const indicators = { 0:"○", 1:"◐", 2:"●", 3:"●●", 4:"●●●", 5:"▲", 6:"✦" };
  const lv  = Math.min(level, 6);
  const col = C.spice[lv];
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:"5px",
      background:`${col}30`, border:`1.5px solid ${col}60`,
      padding:"5px 11px", borderRadius:"8px",
      fontSize:"11px", fontFamily:"'Sora',sans-serif", fontWeight:700,
      letterSpacing:"0.3px", color: lv === 0 ? "#666" : col,
    }}>
      <span style={{ fontSize:"13px", lineHeight:1 }}>{indicators[lv]}</span>
      {C.spiceLbl[lv].toUpperCase()}
    </span>
  );
}

// ─── WarningBadge ─────────────────────────────────────────────────────────────
function WarningBadge() {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:"4px",
      padding:"3px 9px", borderRadius:"6px",
      fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", letterSpacing:"0.04em",
      background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444",
    }}>⚠ WARNING</span>
  );
}

// ─── GenreChip ────────────────────────────────────────────────────────────────
function GenreChip({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:"inline-block", padding:"4px 10px", borderRadius:"6px",
      fontSize:"11px", fontWeight:600, background:"rgba(199,125,255,0.1)",
      border:"1px solid rgba(199,125,255,0.2)", color:C.textMid,
      cursor: onClick ? "pointer" : "default", whiteSpace:"nowrap", flexShrink:0,
    }}>{children}</button>
  );
}

// ─── DimBar ───────────────────────────────────────────────────────────────────
function DimBar({ label, score, note }) {
  const col = qColor(score ?? 0);
  return (
    <div style={{ marginBottom:"16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
        <span style={{ fontSize:"13px", fontWeight:600, color:C.textMid }}>{label}</span>
        <span style={{ fontSize:"13px", fontWeight:800, fontFamily:"'Sora',sans-serif", color:col }}>{score ?? "—"}</span>
      </div>
      <div style={{ height:"5px", background:"rgba(0,0,0,0.08)", borderRadius:"3px", overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:"3px", width:`${score ?? 0}%`, background:`linear-gradient(90deg,${col}88,${col})`, transition:"width 0.7s ease" }}/>
      </div>
      {note && <p style={{ marginTop:"5px", fontSize:"12px", color:C.textMuted, lineHeight:1.5 }}>{note}</p>}
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ children, active, color, onClick, style = {} }) {
  const c = color || C.purple;
  return (
    <button onClick={onClick} style={{
      display:"inline-flex", alignItems:"center",
      padding:"6px 14px", borderRadius:"50px",
      fontSize:"12px", fontWeight:700, fontFamily:"'Sora',sans-serif",
      letterSpacing:"0.03em", whiteSpace:"nowrap",
      border: active ? `1.5px solid ${c}` : "1.5px solid rgba(255,255,255,0.18)",
      background: active ? `${c}22` : "rgba(255,255,255,0.07)",
      color: active ? c : "rgba(255,255,255,0.7)",
      boxShadow: active ? `0 2px 12px ${c}30` : "none",
      transition:"all 0.18s ease",
      ...style,
    }}>{children}</button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ background:C.cardBg, borderRadius:"18px", padding:"20px", border:`1px solid ${C.cardBorder}`, boxShadow:C.shadow }}>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
        <div className="pulse" style={{ width:42, height:42, borderRadius:"50%", background:"rgba(0,0,0,0.08)" }}/>
      </div>
      <div className="pulse" style={{ width:64, height:64, borderRadius:"10px", background:"rgba(0,0,0,0.08)", margin:"0 auto 14px" }}/>
      {[85,60,40,70].map((w,i) => (
        <div key={i} className="pulse" style={{ height: i===0?"16px":"11px", width:`${w}%`, background:"rgba(0,0,0,0.07)", borderRadius:"4px", marginBottom:"8px" }}/>
      ))}
    </div>
  );
}

// ─── BookCard ─────────────────────────────────────────────────────────────────
function BookCard({ book, onClick, onAuthorClick, onGenreClick }) {
  const [hovered, setHovered] = useState(false);
  const genres   = arr(book.genres);
  const warnings = arr(book.contentWarnings);

  return (
    <div
      onClick={() => onClick?.(book)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:C.cardBg, borderRadius:"18px", padding:"20px",
        border:`1px solid ${hovered ? "rgba(199,125,255,0.3)" : C.cardBorder}`,
        boxShadow: hovered ? C.shadowHover : C.shadow,
        cursor:"pointer", position:"relative",
        display:"flex", flexDirection:"column", gap:"10px",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Top row: warning left, score right */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", minHeight:"56px" }}>
        <div style={{ paddingTop:"2px" }}>
          {warnings.length > 0 && <WarningBadge/>}
        </div>
        <QRing score={book.qualityScore} size={56} strokeWidth={5}/>
      </div>

      {/* Book icon centered */}
      <div style={{ display:"flex", justifyContent:"center" }}>
        <GlossyBookIcon size={72}/>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"15px",
        lineHeight:1.3, color:C.text,
        overflow:"hidden", textOverflow:"ellipsis",
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
      }}>{book.title}</h3>

      {/* Author */}
      <button
        onClick={e => { e.stopPropagation(); onAuthorClick?.(book.author); }}
        style={{ fontSize:"12px", fontWeight:600, color:C.purple, background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"'Nunito',sans-serif", textAlign:"left", alignSelf:"flex-start" }}
      >{book.author}</button>

      {/* Spice + Indie */}
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
        {book.spiceLevel != null && <SpiceBadge level={book.spiceLevel}/>}
        {book.isIndie === 1 && (
          <span style={{ display:"inline-flex", padding:"5px 11px", borderRadius:"8px", fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", background:`${C.purple}18`, border:`1.5px solid ${C.purple}40`, color:C.purple, letterSpacing:"0.3px" }}>INDIE</span>
        )}
      </div>

      {/* Genre chips */}
      {genres.length > 0 && (
        <div className="no-sb" style={{ display:"flex", gap:"6px", overflowX:"auto" }}>
          {genres.slice(0,5).map((g,i) => (
            <GenreChip key={i} onClick={e => { e.stopPropagation(); onGenreClick?.(g); }}>{g}</GenreChip>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop:"1px solid rgba(0,0,0,0.07)", paddingTop:"10px", display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"auto" }}>
        <span style={{ fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", color:qColor(book.qualityScore??0), letterSpacing:"0.05em" }}>
          {qLabel(book.qualityScore??0).toUpperCase()}
        </span>
        {book.readers != null && (
          <span style={{ fontSize:"11px", color:C.textMuted, fontWeight:600 }}>{fmt(book.readers)} readers</span>
        )}
      </div>
    </div>
  );
}

// ─── Quality Legend Modal ─────────────────────────────────────────────────────
function QualityLegend({ onClose }) {
  const ranges = [
    { r:"90–100", l:"Exceptional", c:C.q90, d:"Polished prose, confident pacing, strong craft throughout. Technically rare." },
    { r:"80–89",  l:"Strong",      c:C.q80, d:"Well-crafted with minor inconsistencies. Reads professionally and delivers on its premise." },
    { r:"70–79",  l:"Solid",       c:C.q70, d:"Competent work with noticeable rough patches. Still enjoyable for most readers." },
    { r:"60–69",  l:"Uneven",      c:C.q60, d:"Clear weaknesses in execution. Moments of quality alongside significant problems." },
    { r:"Below 60",l:"Rough",      c:C.qLow,d:"Technical issues impact the reading experience. Proceed with full awareness." },
  ];
  const dims = [
    { n:"Technical Quality", d:"Grammar, spelling, and mechanical consistency." },
    { n:"Prose Style",       d:"Voice, sentence variety, and word choice." },
    { n:"Pacing",            d:"Scene structure, tension management, and narrative momentum." },
    { n:"Readability",       d:"Flow, clarity, and how smoothly the book reads." },
    { n:"Craft Execution",   d:"Plot coherence, character consistency, and overall construction." },
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(18,12,31,0.82)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"linear-gradient(145deg,#1e1040,#2d1b4e)", border:"1px solid rgba(199,125,255,0.2)", borderRadius:"24px", padding:"32px", maxWidth:"540px", width:"100%", maxHeight:"85vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"19px", color:"#f0e6ff" }}>How Scores Work</h2>
          <button onClick={onClose} style={{ color:"rgba(255,255,255,0.4)", fontSize:"20px", lineHeight:1, padding:"4px 8px" }}>✕</button>
        </div>
        <p style={{ fontSize:"14px", color:"rgba(255,255,255,0.55)", lineHeight:1.65, marginBottom:"22px" }}>
          Scores are generated by analyzing reader reviews with a calibrated AI model. The overall score is a weighted average of five craft dimensions. Scores reflect writing quality only — not personal enjoyment or content type.
        </p>
        <h3 style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.08em", color:"rgba(255,255,255,0.32)", marginBottom:"12px", fontFamily:"'Sora',sans-serif" }}>SCORE RANGES</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"26px" }}>
          {ranges.map(({r,l,c,d}) => (
            <div key={r} style={{ display:"flex", gap:"14px", alignItems:"flex-start" }}>
              <div style={{ minWidth:"64px", flexShrink:0 }}>
                <div style={{ fontSize:"13px", fontWeight:800, fontFamily:"'Sora',sans-serif", color:c }}>{r}</div>
                <div style={{ fontSize:"10px", fontWeight:700, color:c, opacity:0.75, letterSpacing:"0.05em" }}>{l.toUpperCase()}</div>
              </div>
              <p style={{ fontSize:"13px", color:"rgba(255,255,255,0.55)", lineHeight:1.55, margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
        <h3 style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.08em", color:"rgba(255,255,255,0.32)", marginBottom:"12px", fontFamily:"'Sora',sans-serif" }}>THE FIVE DIMENSIONS</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:"9px" }}>
          {dims.map(({n,d}) => (
            <div key={n}><span style={{ fontSize:"13px", fontWeight:700, color:"#c8aaee" }}>{n}: </span><span style={{ fontSize:"13px", color:"rgba(255,255,255,0.5)" }}>{d}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Advanced Filters ─────────────────────────────────────────────────────────
function AdvancedFilters({ filters, onChange, onClose }) {
  const spiceOpts = C.spiceLbl.map((l,i) => ({ v:i, label:`${l} (${i})`, col:C.spice[i] }));
  const endings   = ["HEA","HFN","Bittersweet","Open","Cliffhanger"];
  const moods     = ["Funny","Dark","Emotional","Cozy","Suspenseful","Steamy","Wholesome"];
  const toggle = k => onChange({ ...filters, [k]: !filters[k] });
  const pick   = (k,v) => onChange({ ...filters, [k]: filters[k]===v ? null : v });

  return (
    <div style={{ background:"rgba(24,14,52,0.98)", backdropFilter:"blur(20px)", border:"1px solid rgba(199,125,255,0.2)", borderRadius:"20px", padding:"24px", marginBottom:"20px", boxShadow:"0 16px 48px rgba(0,0,0,0.4)" }} className="fade-up">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:"15px", color:"#f0e6ff" }}>Advanced Filters</h3>
        <button onClick={onClose} style={{ color:"rgba(255,255,255,0.4)", fontSize:"18px", lineHeight:1 }}>✕</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"20px" }}>
        {/* Max Spice */}
        <div>
          <label style={{ display:"block", fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:"rgba(255,255,255,0.38)", marginBottom:"10px", fontFamily:"'Sora',sans-serif" }}>MAX SPICE</label>
          <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
            {spiceOpts.map(({v,label,col}) => (
              <button key={v} onClick={() => pick("maxSpice",v)} style={{ padding:"5px 10px", borderRadius:"8px", fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:`1.5px solid ${filters.maxSpice===v ? col : "rgba(255,255,255,0.1)"}`, background: filters.maxSpice===v ? `${col}22` : "transparent", color: filters.maxSpice===v ? col : "rgba(255,255,255,0.5)", cursor:"pointer", whiteSpace:"nowrap" }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Ending */}
        <div>
          <label style={{ display:"block", fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:"rgba(255,255,255,0.38)", marginBottom:"10px", fontFamily:"'Sora',sans-serif" }}>ENDING TYPE</label>
          <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
            {endings.map(e => (
              <button key={e} onClick={() => pick("ending",e)} style={{ padding:"5px 11px", borderRadius:"8px", fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:`1.5px solid ${filters.ending===e ? C.purple : "rgba(255,255,255,0.1)"}`, background: filters.ending===e ? `${C.purple}22` : "transparent", color: filters.ending===e ? C.purple : "rgba(255,255,255,0.5)", cursor:"pointer" }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div>
          <label style={{ display:"block", fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:"rgba(255,255,255,0.38)", marginBottom:"10px", fontFamily:"'Sora',sans-serif" }}>MOOD</label>
          <div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>
            {moods.map(m => (
              <button key={m} onClick={() => pick("mood",m)} style={{ padding:"5px 11px", borderRadius:"8px", fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:`1.5px solid ${filters.mood===m ? C.pink : "rgba(255,255,255,0.1)"}`, background: filters.mood===m ? `${C.pink}22` : "transparent", color: filters.mood===m ? C.pink : "rgba(255,255,255,0.5)", cursor:"pointer" }}>{m}</button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <label style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:"rgba(255,255,255,0.38)", fontFamily:"'Sora',sans-serif" }}>OPTIONS</label>
          {[{k:"indieOnly",l:"Indie Only"},{k:"seriesComplete",l:"Completed Series"},{k:"noWarnings",l:"No Content Warnings"}].map(({k,l}) => (
            <label key={k} style={{ display:"flex", alignItems:"center", gap:"10px", cursor:"pointer" }}>
              <div onClick={() => toggle(k)} style={{ width:"36px", height:"20px", borderRadius:"10px", background: filters[k] ? `linear-gradient(135deg,${C.pink},${C.purple})` : "rgba(255,255,255,0.12)", position:"relative", flexShrink:0, transition:"background 0.2s ease", cursor:"pointer" }}>
                <div style={{ position:"absolute", top:"3px", left: filters[k] ? "18px" : "3px", width:"14px", height:"14px", borderRadius:"50%", background:"#fff", transition:"left 0.2s ease", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}/>
              </div>
              <span style={{ fontSize:"13px", fontWeight:600, color:"rgba(255,255,255,0.7)" }}>{l}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop:"18px", paddingTop:"16px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"flex-end" }}>
        <button onClick={() => onChange({maxSpice:null,ending:null,mood:null,indieOnly:false,seriesComplete:false,noWarnings:false})} style={{ padding:"7px 18px", borderRadius:"50px", fontSize:"12px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:"1.5px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.45)", background:"transparent" }}>Reset Filters</button>
      </div>
    </div>
  );
}

// ─── Recently Viewed ──────────────────────────────────────────────────────────
function RecentlyViewed({ books, bookIds, onClick }) {
  const viewed = bookIds.map(id => books.find(b => b.id===id || b.title===id)).filter(Boolean);
  if (!viewed.length) return null;
  return (
    <div style={{ marginBottom:"32px" }}>
      <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:"13px", color:"rgba(255,255,255,0.38)", letterSpacing:"0.07em", marginBottom:"12px" }}>RECENTLY VIEWED</h3>
      <div className="no-sb" style={{ display:"flex", gap:"10px", overflowX:"auto", paddingBottom:"4px" }}>
        {viewed.slice(0,8).map(b => (
          <button key={b.id||b.title} onClick={() => onClick(b)} style={{ flexShrink:0, width:"120px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"12px", padding:"12px 10px", cursor:"pointer", textAlign:"left", transition:"all 0.18s ease" }}>
            <div style={{ marginBottom:"6px" }}><QRing score={b.qualityScore} size={36} strokeWidth={3}/></div>
            <div style={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"'Sora',sans-serif" }}>{b.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Book Detail Page ─────────────────────────────────────────────────────────
function BookDetailPage({ book, onBack, onGenreClick, onAuthorClick }) {
  const genres   = arr(book.genres);
  const warnings = arr(book.contentWarnings);
  const themes   = arr(book.themes);
  const moods    = arr(book.moods);
  const col      = qColor(book.qualityScore ?? 0);

  return (
    <div style={{ maxWidth:"780px", margin:"0 auto", padding:"0 16px 80px" }} className="fade-up">
      <button onClick={onBack} style={{ display:"inline-flex", alignItems:"center", gap:"6px", marginBottom:"24px", padding:"8px 16px", borderRadius:"50px", fontSize:"13px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:"1.5px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.06)" }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ background:C.cardBg, borderRadius:"22px", padding:"28px", border:`1px solid ${C.cardBorder}`, boxShadow:C.shadow, marginBottom:"16px" }}>
        <div style={{ display:"flex", gap:"20px", alignItems:"flex-start" }}>
          <QRing score={book.qualityScore} size={80} strokeWidth={6}/>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"22px", color:C.text, lineHeight:1.2, marginBottom:"6px" }}>{book.title}</h1>
            <button onClick={() => onAuthorClick?.(book.author)} style={{ fontSize:"14px", fontWeight:700, color:C.purple, background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>{book.author}</button>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"12px" }}>
              {book.spiceLevel != null && <SpiceBadge level={book.spiceLevel}/>}
              {book.isIndie === 1 && <span style={{ padding:"5px 11px", borderRadius:"8px", fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", background:`${C.purple}18`, border:`1.5px solid ${C.purple}40`, color:C.purple }}>INDIE</span>}
              {book.endingType && <span style={{ padding:"5px 11px", borderRadius:"8px", fontSize:"11px", fontWeight:700, fontFamily:"'Sora',sans-serif", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", color:"#22c55e" }}>{book.endingType}</span>}
              {warnings.length > 0 && <WarningBadge/>}
            </div>
          </div>
        </div>

        {book.seriesName && (
          <div style={{ marginTop:"14px", padding:"10px 14px", background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.2)", borderRadius:"10px" }}>
            <span style={{ fontSize:"13px", fontWeight:600, color:"#60a5fa" }}>
              {book.seriesName}{book.seriesNumber ? ` — Book ${book.seriesNumber}` : ""}{book.seriesTotal ? ` of ${book.seriesTotal}` : ""} · {book.seriesIsComplete ? "Complete" : "Ongoing"}
            </span>
          </div>
        )}

        {book.synopsis && <p style={{ marginTop:"14px", fontSize:"14px", color:C.textMid, lineHeight:1.65 }}>{book.synopsis}</p>}

        {genres.length > 0 && (
          <div className="no-sb" style={{ display:"flex", gap:"6px", overflowX:"auto", marginTop:"14px" }}>
            {genres.map((g,i) => <GenreChip key={i} onClick={() => onGenreClick?.(g)}>{g}</GenreChip>)}
          </div>
        )}
      </div>

      {/* Quality */}
      <div style={{ background:C.cardBg, borderRadius:"22px", padding:"28px", border:`1px solid ${C.cardBorder}`, boxShadow:C.shadow, marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"17px", color:C.text }}>Writing Quality</h2>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"30px", color:col, lineHeight:1 }}>{book.qualityScore ?? "—"}</div>
            <div style={{ fontSize:"11px", fontWeight:700, color:col, letterSpacing:"0.05em" }}>{qLabel(book.qualityScore??0).toUpperCase()}</div>
          </div>
        </div>
        <DimBar label="Technical Quality" score={book.technicalQuality} note={book.technicalQualityNote}/>
        <DimBar label="Prose Style"       score={book.proseStyle}       note={book.proseStyleNote}/>
        <DimBar label="Pacing"            score={book.pacing}           note={book.pacingNote}/>
        <DimBar label="Readability"       score={book.readability}      note={book.readabilityNote}/>
        <DimBar label="Craft Execution"   score={book.craftExecution}   note={book.craftExecutionNote}/>
        {book.confidenceLevel && (
          <div style={{ marginTop:"14px", paddingTop:"12px", borderTop:"1px solid rgba(0,0,0,0.06)", fontSize:"12px", color:C.textMuted }}>
            <span style={{ fontWeight:700, textTransform:"uppercase", marginRight:"6px", color: book.confidenceLevel==="high" ? C.q90 : book.confidenceLevel==="medium" ? C.q70 : C.qLow }}>{book.confidenceLevel}</span>
            confidence{book.voteCount > 0 ? ` · based on ${book.voteCount} reviews` : ""}
          </div>
        )}
      </div>

      {/* Content Details */}
      {(warnings.length > 0 || themes.length > 0 || moods.length > 0) && (
        <div style={{ background:C.cardBg, borderRadius:"22px", padding:"28px", border:`1px solid ${C.cardBorder}`, boxShadow:C.shadow }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"17px", color:C.text, marginBottom:"18px" }}>Content Details</h2>
          {warnings.length > 0 && (
            <div style={{ marginBottom:"16px" }}>
              <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:C.textMuted, marginBottom:"8px", fontFamily:"'Sora',sans-serif" }}>CONTENT WARNINGS</div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {warnings.map((w,i) => <span key={i} style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"12px", fontWeight:600, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" }}>{w}</span>)}
              </div>
            </div>
          )}
          {themes.length > 0 && (
            <div style={{ marginBottom:"16px" }}>
              <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:C.textMuted, marginBottom:"8px", fontFamily:"'Sora',sans-serif" }}>THEMES</div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {themes.map((t,i) => <GenreChip key={i}>{t}</GenreChip>)}
              </div>
            </div>
          )}
          {moods.length > 0 && (
            <div>
              <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", color:C.textMuted, marginBottom:"8px", fontFamily:"'Sora',sans-serif" }}>MOODS</div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {moods.map((m,i) => <span key={i} style={{ padding:"4px 10px", borderRadius:"6px", fontSize:"12px", fontWeight:600, background:`${C.purple}12`, border:`1px solid ${C.purple}20`, color:C.textMid }}>{m}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Author Page ──────────────────────────────────────────────────────────────
function AuthorPage({ authorName, books, onBack, onBookClick, onGenreClick }) {
  const authorBooks = books.filter(b => b.author === authorName);
  const avgScore = authorBooks.length
    ? Math.round(authorBooks.reduce((s,b) => s+(b.qualityScore||0),0) / authorBooks.length)
    : null;
  return (
    <div style={{ maxWidth:"960px", margin:"0 auto", padding:"0 16px 80px" }} className="fade-up">
      <button onClick={onBack} style={{ display:"inline-flex", alignItems:"center", gap:"6px", marginBottom:"24px", padding:"8px 16px", borderRadius:"50px", fontSize:"13px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:"1.5px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.7)", background:"rgba(255,255,255,0.06)" }}>
        ← Back
      </button>
      <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"28px", color:"#f0e6ff", marginBottom:"8px" }}>{authorName}</h1>
      <div style={{ display:"flex", gap:"16px", marginBottom:"28px" }}>
        <span style={{ fontSize:"14px", color:"rgba(255,255,255,0.45)" }}>{authorBooks.length} scored book{authorBooks.length!==1?"s":""}</span>
        {avgScore != null && <span style={{ fontSize:"14px", fontWeight:700, color:qColor(avgScore) }}>Avg {avgScore} — {qLabel(avgScore)}</span>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"20px" }}>
        {authorBooks.map(b => (
          <BookCard key={b.id||b.title} book={b} onClick={onBookClick} onAuthorClick={()=>{}} onGenreClick={onGenreClick}/>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function StyleScope() {
  // Inject CSS
  useEffect(() => {
    const id = "ss-global";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
  }, []);

  // Data
  const [books,    setBooks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState(null);

  // Routing
  const [view,           setView]           = useState("browse");
  const [selectedBook,   setSelectedBook]   = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState(null);

  // Search + filters
  const [searchQuery,  setSearchQuery]  = useState("");
  const [minQuality,   setMinQuality]   = useState(null);
  const [genreFilter,  setGenreFilter]  = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advFilters,   setAdvFilters]   = useState({
    maxSpice:null, ending:null, mood:null,
    indieOnly:false, seriesComplete:false, noWarnings:false,
  });

  // Modals + misc
  const [showLegend,       setShowLegend]       = useState(false);
  const [recentIds,        setRecentIds]        = useState([]);
  const [onDemandTitle,    setOnDemandTitle]    = useState("");
  const [onDemandAuthor,   setOnDemandAuthor]   = useState("");
  const [onDemandProgress, setOnDemandProgress] = useState(null);
  const [onDemandError,    setOnDemandError]    = useState(null);

  // Fetch
  useEffect(() => {
    fetch(`${API_BASE}/api/books`)
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json(); })
      .then(d => { setBooks(d); setLoading(false); })
      .catch(e => { setApiError(e.message); setLoading(false); });
  }, []);

  // Navigation
  const openBook = useCallback((book) => {
    setSelectedBook(book); setView("book");
    setRecentIds(p => [book.id||book.title, ...p.filter(id=>id!==(book.id||book.title))].slice(0,10));
    window.scrollTo(0,0);
  }, []);
  const openAuthor = useCallback((name) => {
    setSelectedAuthor(name); setView("author"); window.scrollTo(0,0);
  }, []);
  const goBack = useCallback(() => {
    setView("browse"); setSelectedBook(null); setSelectedAuthor(null);
  }, []);
  const handleGenreClick = useCallback((g) => {
    setGenreFilter(g); setView("browse"); window.scrollTo(0,0);
  }, []);

  // Filter
  const filtered = books.filter(b => {
    const q = searchQuery.toLowerCase().trim();
    if (q && !b.title?.toLowerCase().includes(q) && !b.author?.toLowerCase().includes(q)) return false;
    if (minQuality != null && (b.qualityScore??0) < minQuality) return false;
    if (genreFilter && !arr(b.genres).some(g=>g.toLowerCase().includes(genreFilter.toLowerCase()))) return false;
    if (advFilters.maxSpice != null && (b.spiceLevel??0) > advFilters.maxSpice) return false;
    if (advFilters.ending && b.endingType !== advFilters.ending) return false;
    if (advFilters.mood && !arr(b.moods).includes(advFilters.mood)) return false;
    if (advFilters.indieOnly && b.isIndie !== 1) return false;
    if (advFilters.seriesComplete && !b.seriesIsComplete) return false;
    if (advFilters.noWarnings && arr(b.contentWarnings).length > 0) return false;
    return true;
  });

  const activeAdvCount = [
    advFilters.maxSpice != null, advFilters.ending, advFilters.mood,
    advFilters.indieOnly, advFilters.seriesComplete, advFilters.noWarnings,
  ].filter(Boolean).length;

  // On-demand
  async function handleOnDemand(e) {
    e.preventDefault();
    if (!onDemandTitle.trim() || !onDemandAuthor.trim()) return;
    setOnDemandProgress("Starting…"); setOnDemandError(null);
    try {
      const res = await fetch(`${API_BASE}/api/score-on-demand`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ title:onDemandTitle, author:onDemandAuthor }),
      });
      if (!res.ok) { const e2 = await res.json(); throw new Error(e2.error||"Failed"); }
      const data = await res.json();
      if (data.status === "exists") {
        setBooks(p => p.find(b=>b.id===data.book.id)?p:[...p,data.book]);
        setOnDemandProgress(null); openBook(data.book); return;
      }
      const jid = data.job_id;
      const poll = async () => {
        try {
          const sr = await fetch(`${API_BASE}/api/job-status/${jid}`);
          const s = await sr.json();
          setOnDemandProgress(s.progress||"Processing…");
          if (s.status==="complete") {
            setBooks(p=>p.find(b=>b.id===s.book.id)?p:[...p,s.book]);
            setOnDemandProgress(null); openBook(s.book);
          } else if (s.status==="failed") throw new Error(s.error||"Scoring failed");
          else setTimeout(poll,2000);
        } catch(err){ setOnDemandError(err.message); setOnDemandProgress(null); }
      };
      setTimeout(poll,2000);
    } catch(err){ setOnDemandError(err.message); setOnDemandProgress(null); }
  }

  // Subpages
  if (view==="book" && selectedBook) return (
    <div style={{ padding:"24px 0 0" }}>
      <BookDetailPage book={selectedBook} onBack={goBack} onGenreClick={handleGenreClick} onAuthorClick={openAuthor}/>
      {showLegend && <QualityLegend onClose={()=>setShowLegend(false)}/>}
    </div>
  );

  if (view==="author" && selectedAuthor) return (
    <div style={{ padding:"24px 0 0" }}>
      <AuthorPage authorName={selectedAuthor} books={books} onBack={goBack} onBookClick={openBook} onGenreClick={handleGenreClick}/>
    </div>
  );

  // ── Browse ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh" }}>

      {/* Hero */}
      <div style={{ padding:"56px 20px 36px", textAlign:"center", background:"linear-gradient(180deg,rgba(199,125,255,0.08) 0%,transparent 100%)", borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:"32px" }}>
        <div style={{ maxWidth:"660px", margin:"0 auto" }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"12px", marginBottom:"12px" }}>
            <GlossyBookIcon size={44}/>
            <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"clamp(26px,5vw,38px)", color:"#f0e6ff", letterSpacing:"-0.02em", lineHeight:1 }}>StyleScope</h1>
          </div>

          <p style={{ fontSize:"clamp(13px,2vw,15px)", color:"rgba(255,255,255,0.5)", lineHeight:1.5, marginBottom:"26px", fontFamily:"'Nunito',sans-serif" }}>
            Know the writing quality before you read. Search by title or author to see quality scores, spice levels, and content warnings.
          </p>

          {/* Search */}
          <div style={{ position:"relative", marginBottom:"14px" }}>
            <span style={{ position:"absolute", left:"18px", top:"50%", transform:"translateY(-50%)", fontSize:"18px", color:"rgba(255,255,255,0.28)", pointerEvents:"none", userSelect:"none" }}>⌕</span>
            <input
              value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              placeholder="Search by title or author..."
              style={{ width:"100%", padding:"14px 44px 14px 46px", borderRadius:"50px", border:"1.5px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.09)", color:"#fff", fontSize:"16px", fontWeight:500, backdropFilter:"blur(12px)", transition:"border-color 0.2s,box-shadow 0.2s" }}
              onFocus={e=>{ e.target.style.borderColor="rgba(255,107,157,0.45)"; e.target.style.boxShadow="0 0 0 3px rgba(255,107,157,0.13)"; }}
              onBlur={e=>{ e.target.style.borderColor="rgba(255,255,255,0.12)"; e.target.style.boxShadow="none"; }}
            />
            {searchQuery && (
              <button onClick={()=>setSearchQuery("")} style={{ position:"absolute", right:"16px", top:"50%", transform:"translateY(-50%)", fontSize:"16px", color:"rgba(255,255,255,0.38)", lineHeight:1 }}>✕</button>
            )}
          </div>

          {/* Quality pills */}
          <div style={{ display:"flex", gap:"7px", justifyContent:"center", flexWrap:"wrap", marginBottom:"10px" }}>
            <span style={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.32)", fontFamily:"'Sora',sans-serif", alignSelf:"center", letterSpacing:"0.06em" }}>MIN QUALITY:</span>
            {[null,60,70,80,90].map(v => (
              <Pill key={v??0} active={minQuality===v} color={v?qColor(v):C.purple} onClick={()=>setMinQuality(v)}>
                {v==null?"All":`${v}+`}
              </Pill>
            ))}
          </div>

          {/* Controls row */}
          <div style={{ display:"flex", gap:"7px", justifyContent:"center", flexWrap:"wrap" }}>
            {genreFilter && (
              <Pill active color={C.pink} onClick={()=>setGenreFilter(null)}>{genreFilter} ✕</Pill>
            )}
            <button
              onClick={()=>setShowAdvanced(v=>!v)}
              style={{ display:"inline-flex", alignItems:"center", gap:"6px", padding:"6px 14px", borderRadius:"50px", fontSize:"12px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:`1.5px solid ${showAdvanced||activeAdvCount>0 ? C.purple : "rgba(255,255,255,0.18)"}`, background: showAdvanced||activeAdvCount>0 ? `${C.purple}20` : "rgba(255,255,255,0.07)", color: showAdvanced||activeAdvCount>0 ? C.purple : "rgba(255,255,255,0.65)", transition:"all 0.18s ease" }}
            >
              Advanced Filters
              {activeAdvCount > 0 && (
                <span style={{ background:C.purple, color:"#fff", borderRadius:"50px", padding:"1px 7px", fontSize:"10px", fontWeight:800 }}>{activeAdvCount}</span>
              )}
            </button>
            <button
              onClick={()=>setShowLegend(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:"5px", padding:"6px 14px", borderRadius:"50px", fontSize:"12px", fontWeight:700, fontFamily:"'Sora',sans-serif", border:"1.5px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.5)" }}
            >
              <span style={{ width:"16px", height:"16px", borderRadius:"50%", border:"1.5px solid rgba(255,255,255,0.28)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:800 }}>i</span>
              How scores work
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"0 20px" }}>

        {showAdvanced && (
          <AdvancedFilters filters={advFilters} onChange={setAdvFilters} onClose={()=>setShowAdvanced(false)}/>
        )}

        {!loading && recentIds.length > 0 && (
          <RecentlyViewed books={books} bookIds={recentIds} onClick={openBook}/>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:"13px", color:"rgba(255,255,255,0.38)", letterSpacing:"0.07em" }}>
            {loading ? "LOADING…" : `${filtered.length} BOOK${filtered.length!==1?"S":""}`}
            {searchQuery && !loading && <span style={{ fontWeight:400, color:"rgba(255,255,255,0.25)" }}> for "{searchQuery}"</span>}
          </h2>
        </div>

        {apiError && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", borderRadius:"12px", padding:"16px 20px", marginBottom:"20px", color:"#fca5a5", fontSize:"14px" }}>
            Could not connect to the API: {apiError}. Make sure <code>python api.py</code> is running on port 5000.
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"20px" }}>
            {Array.from({length:8}).map((_,i)=><SkeletonCard key={i}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 20px", color:"rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize:"36px", marginBottom:"14px", opacity:0.3, fontFamily:"'Sora',sans-serif" }}>○</div>
            <p style={{ fontSize:"16px", fontWeight:600, marginBottom:"8px" }}>No books found</p>
            <p style={{ fontSize:"14px" }}>Try adjusting your search or clearing filters.</p>
          </div>
        ) : (
          <div className="fade-up" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"20px" }}>
            {filtered.map(b => (
              <BookCard key={b.id||b.title} book={b} onClick={openBook} onAuthorClick={openAuthor} onGenreClick={handleGenreClick}/>
            ))}
          </div>
        )}

        {/* On-demand */}
        {!loading && (
          <div style={{ marginTop:"52px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(199,125,255,0.12)", borderRadius:"20px", padding:"28px" }}>
            <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"16px", color:"#f0e6ff", marginBottom:"5px" }}>Book not listed?</h3>
            <p style={{ fontSize:"13px", color:"rgba(255,255,255,0.4)", marginBottom:"18px" }}>Request an on-demand score. Analysis takes around 30 seconds.</p>
            <form onSubmit={handleOnDemand} style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <input value={onDemandTitle} onChange={e=>setOnDemandTitle(e.target.value)} placeholder="Book title"
                style={{ flex:"1", minWidth:"150px", padding:"11px 16px", borderRadius:"12px", border:"1.5px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.07)", color:"#fff", fontSize:"14px" }}/>
              <input value={onDemandAuthor} onChange={e=>setOnDemandAuthor(e.target.value)} placeholder="Author name"
                style={{ flex:"1", minWidth:"150px", padding:"11px 16px", borderRadius:"12px", border:"1.5px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.07)", color:"#fff", fontSize:"14px" }}/>
              <button type="submit" disabled={!!onDemandProgress} style={{ padding:"11px 22px", borderRadius:"12px", background: onDemandProgress?"rgba(255,255,255,0.07)":`linear-gradient(135deg,${C.pink},${C.purple})`, color: onDemandProgress?"rgba(255,255,255,0.35)":"#fff", fontSize:"13px", fontWeight:700, fontFamily:"'Sora',sans-serif", boxShadow: onDemandProgress?"none":"0 4px 16px rgba(199,125,255,0.35)", border:"none", cursor:onDemandProgress?"wait":"pointer", transition:"all 0.2s ease" }}>
                {onDemandProgress || "Score It"}
              </button>
            </form>
            {onDemandError && <p style={{ marginTop:"10px", fontSize:"12px", color:"#fca5a5" }}>{onDemandError}</p>}
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop:"48px", paddingTop:"24px", paddingBottom:"32px", borderTop:"1px solid rgba(255,255,255,0.06)", textAlign:"center", display:"flex", gap:"20px", justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={()=>setShowLegend(true)} style={{ fontSize:"13px", color:"rgba(255,255,255,0.28)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Glossary of terms</button>
          <span style={{ fontSize:"13px", color:"rgba(255,255,255,0.15)" }}>·</span>
          <span style={{ fontSize:"13px", color:"rgba(255,255,255,0.28)", fontFamily:"'Nunito',sans-serif" }}>Scores reflect writing craft only</span>
        </footer>
      </div>

      {showLegend && <QualityLegend onClose={()=>setShowLegend(false)}/>}
    </div>
  );
}
