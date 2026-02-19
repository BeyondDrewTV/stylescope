import { useState, useEffect } from 'react';
import { api } from '../api/client';

const C = {
  purple: '#C77DFF',
  text: '#ffffff',
  textMuted: '#cccccc',
  textSubtle: '#888888',
  green: '#4ade80',
};

const GEM_POSITIONS = [
  { x: 15, y: 20 }, { x: 45, y: 15 }, { x: 75, y: 25 },
  { x: 20, y: 50 }, { x: 50, y: 45 }, { x: 80, y: 55 },
  { x: 25, y: 80 }, { x: 55, y: 75 }, { x: 85, y: 85 },
];

export function HiddenGemsExplorer({ onBookFound, userPremium, onUpgradeNeeded }) {
  const [gems, setGems] = useState([]);
  const [foundGems, setFoundGems] = useState(new Set());
  const [selectedGem, setSelectedGem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getHiddenGems()
      .then((data) => setGems(data.gems || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleGemClick = (gem, index) => {
    if (!userPremium) {
      if (onUpgradeNeeded) onUpgradeNeeded();
      return;
    }

    if (!foundGems.has(index)) {
      const next = new Set(foundGems);
      next.add(index);
      setFoundGems(next);
      setSelectedGem(gem);
      if (onBookFound) onBookFound(gem, next.size);
    } else {
      setSelectedGem(gem);
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: 360,
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(76,201,240,0.15) 0%, rgba(122,199,12,0.15) 50%, rgba(253,180,75,0.15) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Nunito',sans-serif",
        color: C.textSubtle,
        fontSize: 14,
      }}>
        Loading hidden gems...
      </div>
    );
  }

  if (error || gems.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: 280,
        borderRadius: 24,
        background: 'rgba(199,125,255,0.06)',
        border: '1px solid rgba(199,125,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: "'Nunito',sans-serif",
        color: C.textSubtle,
        fontSize: 14,
        textAlign: 'center',
        padding: 24,
      }}>
        <span style={{ fontSize: 40 }}>{'\uD83D\uDC8E'}</span>
        <p>Not enough hidden gems yet.</p>
        <p style={{ fontSize: 12 }}>Check back as more books get scored!</p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 400,
      background: 'linear-gradient(135deg, rgba(76,201,240,0.12) 0%, rgba(122,199,12,0.12) 50%, rgba(253,180,75,0.12) 100%)',
      border: '1px solid rgba(199,125,255,0.12)',
      borderRadius: 24,
      overflow: 'hidden',
    }}>
      {/* Decorative elements */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700,
        color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 20 }}>{'\uD83D\uDC8E'}</span>
        Hidden Gems
        <span style={{
          fontSize: 11, color: C.textSubtle,
          background: 'rgba(199,125,255,0.1)',
          padding: '2px 8px', borderRadius: 10,
        }}>
          {foundGems.size}/{gems.length} found
        </span>
      </div>

      {/* Gem nodes */}
      {gems.map((gem, i) => {
        const pos = GEM_POSITIONS[i] || { x: 50, y: 50 };
        const found = foundGems.has(i);
        const isSelected = selectedGem && selectedGem.id === gem.id;

        return (
          <button
            key={gem.id || i}
            onClick={() => handleGemClick(gem, i)}
            style={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: found ? 32 : 44,
              height: found ? 32 : 44,
              border: found
                ? `2px solid ${C.green}`
                : isSelected
                  ? `2px solid ${C.purple}`
                  : '2px solid rgba(255,255,255,0.2)',
              background: found
                ? 'rgba(74,222,128,0.15)'
                : 'rgba(199,125,255,0.12)',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: found ? 14 : 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: found
                ? 'none'
                : '0 0 16px rgba(199,125,255,0.25)',
            }}
          >
            {found ? '\u2713' : '\uD83D\uDC8E'}
          </button>
        );
      })}

      {/* Selected gem card */}
      {selectedGem && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(26,10,46,0.95)',
          border: '1px solid rgba(199,125,255,0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          maxWidth: 300,
          width: 'calc(100% - 32px)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontFamily: "'Sora',sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
                marginBottom: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedGem.title}
              </h3>
              <p style={{
                fontFamily: "'Nunito',sans-serif",
                fontSize: 12,
                color: C.textSubtle,
                marginBottom: 8,
              }}>
                by {selectedGem.author}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedGem(null); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.textSubtle, fontSize: 18, lineHeight: 1, padding: 4,
                flexShrink: 0,
              }}
            >
              {'\u2715'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              background: C.green,
              color: '#000',
              padding: '3px 10px',
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'Sora',sans-serif",
            }}>
              {selectedGem.qualityScore} Score
            </span>
            {selectedGem.readers != null && (
              <span style={{ fontSize: 11, color: C.textSubtle }}>
                {selectedGem.readers} readers
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
