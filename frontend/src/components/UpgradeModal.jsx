import { useState } from 'react';

const C = {
  purple: '#C77DFF',
  pink: '#FF6B9D',
  bg: '#0a0118',
  cardBg: '#1a0a2e',
  text: '#ffffff',
  textMuted: '#cccccc',
  textSubtle: '#888888',
};
const GRAD = 'linear-gradient(135deg, #C77DFF 0%, #FF6B9D 100%)';

const FEATURES = [
  { icon: '\uD83D\uDD0D', text: 'Advanced filtering (Want/Avoid system)' },
  { icon: '\u26A0\uFE0F', text: 'Detailed content warnings' },
  { icon: '\uD83D\uDCDA', text: 'Full book pages with synopsis' },
  { icon: '\uD83D\uDC8E', text: 'Daily hidden gems discovery' },
  { icon: '\uD83C\uDF0D', text: 'Unlock biomes & themes' },
];

export function UpgradeModal({ onClose, feature = 'Premium Features', onUpgrade }) {
  const [hovering, setHovering] = useState(false);

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
          border: `1px solid rgba(199,125,255,0.2)`,
          padding: '32px 24px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.4s cubic-bezier(0.34,1.4,0.64,1)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }}>{'\uD83D\uDC51'}</div>

        <h2 style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: C.text,
          marginBottom: 8,
        }}>
          Unlock {feature}
        </h2>

        <p style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 14,
          color: C.textSubtle,
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          Upgrade to Premium for advanced filters, full book details, hidden gems, and more.
        </p>

        <div style={{
          background: 'rgba(199,125,255,0.06)',
          border: '1px solid rgba(199,125,255,0.12)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          textAlign: 'left',
        }}>
          {FEATURES.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: i < FEATURES.length - 1 ? 14 : 0,
              fontFamily: "'Nunito', sans-serif",
              fontSize: 14,
              color: C.textMuted,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            if (onUpgrade) onUpgrade();
            else window.location.href = '/pricing';
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 100,
            border: 'none',
            background: GRAD,
            color: 'white',
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(199,125,255,0.35)',
            marginBottom: 12,
            transform: hovering ? 'scale(1.02)' : 'scale(1)',
            transition: 'transform 0.2s',
          }}
        >
          Upgrade for $4.99/month
        </button>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 100,
            border: 'none',
            background: 'transparent',
            color: C.textSubtle,
            fontFamily: "'Sora', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
