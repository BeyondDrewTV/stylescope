/**
 * UpgradeModal — v1 stub.
 *
 * Full premium upsell (biomes, advanced filters, unlimited scoring) is deferred.
 * This placeholder accepts the same props as the original so call sites don't crash,
 * and shows a lightweight "coming soon" message instead.
 *
 * Restore the full modal here when paid tiers launch.
 */

const C = {
  purple:     '#C77DFF',
  bg:         '#0a0118',
  cardBg:     '#1a0a2e',
  text:       '#ffffff',
  textMuted:  '#cccccc',
  textSubtle: '#888888',
};
const GRAD = 'linear-gradient(135deg, #C77DFF 0%, #FF6B9D 100%)';

export function UpgradeModal({ onClose, feature = 'Pro Features', onUpgrade }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.3s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.cardBg,
          borderRadius: 24,
          border: '1px solid rgba(199,125,255,0.2)',
          padding: '36px 28px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.4s cubic-bezier(0.34,1.4,0.64,1)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative bar */}
        <div style={{
          width: 48, height: 4, borderRadius: 2,
          background: GRAD, margin: '0 auto 28px',
        }} />

        <div style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 20, fontWeight: 800,
          color: C.text, marginBottom: 12,
        }}>
          {feature} — Coming Soon
        </div>

        <p style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 14, color: C.textSubtle,
          lineHeight: 1.7, marginBottom: 28,
        }}>
          Pro features — advanced filters, unlimited on-demand scoring, and more —
          are on the roadmap. StyleScope is free while we're in early access.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '13px',
            borderRadius: 100, border: 'none',
            background: GRAD, color: '#fff',
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700, fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
