/**
 * BiomeBackground — Procedural SVG backgrounds for each biome.
 *
 * Renders a full-viewport background layer that shifts colors based on
 * the active biome and time of day. Each biome has unique decorative
 * SVG elements (particles, shapes, patterns).
 *
 * Props:
 *   biomeId   — string key from BIOMES
 *   timeOfDay — "morning" | "afternoon" | "evening" | "night"
 *   className — optional extra class
 */

import { useMemo } from "react";
import { BIOMES } from "../data/biomes";

// ---------------------------------------------------------------------------
// Deterministic pseudo-random for consistent particle placement
// ---------------------------------------------------------------------------
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Biome-specific decorative elements (SVG fragments)
// ---------------------------------------------------------------------------

function PeppersHomeDecor({ palette, rand }) {
  // Floating herb leaves and spice dots
  const leaves = Array.from({ length: 12 }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 4 + rand() * 8,
    rotation: rand() * 360,
    opacity: 0.06 + rand() * 0.08,
  }));
  return (
    <g>
      {leaves.map((l, i) => (
        <ellipse
          key={i}
          cx={`${l.x}%`}
          cy={`${l.y}%`}
          rx={l.size}
          ry={l.size * 0.6}
          fill={palette.accent}
          opacity={l.opacity}
          transform={`rotate(${l.rotation} ${l.x * 3.6} ${l.y * 8})`}
        />
      ))}
    </g>
  );
}

function SweetGardenDecor({ palette, rand }) {
  // Floating petals and circles
  const petals = Array.from({ length: 16 }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 3 + rand() * 6,
    opacity: 0.05 + rand() * 0.1,
  }));
  return (
    <g>
      {petals.map((p, i) => (
        <circle
          key={i}
          cx={`${p.x}%`}
          cy={`${p.y}%`}
          r={p.size}
          fill={i % 3 === 0 ? palette.accent : palette.glow}
          opacity={p.opacity}
        />
      ))}
    </g>
  );
}

function SpiceMarketDecor({ palette, rand }) {
  // Diamond shapes like spice crystals
  const crystals = Array.from({ length: 10 }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 5 + rand() * 8,
    rotation: rand() * 45,
    opacity: 0.06 + rand() * 0.08,
  }));
  return (
    <g>
      {crystals.map((c, i) => (
        <rect
          key={i}
          x={`${c.x}%`}
          y={`${c.y}%`}
          width={c.size}
          height={c.size}
          fill={palette.accent}
          opacity={c.opacity}
          transform={`rotate(${45 + c.rotation} ${c.x * 3.6} ${c.y * 8})`}
          rx={1}
        />
      ))}
    </g>
  );
}

function FirePlainsDecor({ palette, rand }) {
  // Ember particles — small upward-drifting dots
  const embers = Array.from({ length: 18 }, (_, i) => ({
    x: rand() * 100,
    y: 40 + rand() * 60,
    size: 1.5 + rand() * 3,
    opacity: 0.08 + rand() * 0.12,
  }));
  return (
    <g>
      {embers.map((e, i) => (
        <circle
          key={i}
          cx={`${e.x}%`}
          cy={`${e.y}%`}
          r={e.size}
          fill={i % 2 === 0 ? palette.accent : palette.glow}
          opacity={e.opacity}
        />
      ))}
    </g>
  );
}

function InfernoPeakDecor({ palette, rand }) {
  // Obsidian spires — angular shapes
  const spires = Array.from({ length: 8 }, (_, i) => ({
    x: rand() * 100,
    y: 60 + rand() * 40,
    width: 2 + rand() * 4,
    height: 15 + rand() * 30,
    opacity: 0.06 + rand() * 0.1,
  }));
  return (
    <g>
      {spires.map((s, i) => (
        <rect
          key={i}
          x={`${s.x}%`}
          y={`${s.y}%`}
          width={s.width}
          height={s.height}
          fill={palette.glow}
          opacity={s.opacity}
          rx={1}
        />
      ))}
    </g>
  );
}

function MysteryLibraryDecor({ palette, rand }) {
  // Floating book shapes and tiny stars
  const particles = Array.from({ length: 14 }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 3 + rand() * 5,
    isBook: i % 3 === 0,
    opacity: 0.05 + rand() * 0.08,
  }));
  return (
    <g>
      {particles.map((p, i) =>
        p.isBook ? (
          <rect
            key={i}
            x={`${p.x}%`}
            y={`${p.y}%`}
            width={p.size * 0.7}
            height={p.size}
            fill={palette.accent}
            opacity={p.opacity}
            rx={1}
          />
        ) : (
          <circle
            key={i}
            cx={`${p.x}%`}
            cy={`${p.y}%`}
            r={p.size * 0.4}
            fill={palette.glow}
            opacity={p.opacity}
          />
        )
      )}
    </g>
  );
}

function MidnightArchiveDecor({ palette, rand }) {
  // Glowing rune dots and subtle lines
  const runes = Array.from({ length: 20 }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 1.5 + rand() * 3,
    opacity: 0.06 + rand() * 0.15,
  }));
  return (
    <g>
      {runes.map((r, i) => (
        <circle
          key={i}
          cx={`${r.x}%`}
          cy={`${r.y}%`}
          r={r.size}
          fill={palette.glow}
          opacity={r.opacity}
        />
      ))}
    </g>
  );
}

function CrystalCoveDecor({ palette, rand }) {
  // Bioluminescent orbs and crystal facets
  const orbs = Array.from({ length: 15 }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 3 + rand() * 8,
    opacity: 0.04 + rand() * 0.1,
  }));
  return (
    <g>
      {orbs.map((o, i) => (
        <circle
          key={i}
          cx={`${o.x}%`}
          cy={`${o.y}%`}
          r={o.size}
          fill={i % 2 === 0 ? palette.accent : palette.glow}
          opacity={o.opacity}
        />
      ))}
    </g>
  );
}

const DECOR_MAP = {
  peppers_home: PeppersHomeDecor,
  sweet_garden: SweetGardenDecor,
  spice_market: SpiceMarketDecor,
  fire_plains: FirePlainsDecor,
  inferno_peak: InfernoPeakDecor,
  mystery_library: MysteryLibraryDecor,
  midnight_archive: MidnightArchiveDecor,
  crystal_cove: CrystalCoveDecor,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BiomeBackground({ biomeId = "peppers_home", timeOfDay = "afternoon" }) {
  const biome = BIOMES[biomeId] || BIOMES.peppers_home;
  const tod = biome.timeOfDay?.[timeOfDay] || {};
  const bg = tod.bg || biome.palette.bg;
  const glow = tod.glow || biome.palette.glow;

  const DecorComponent = DECOR_MAP[biomeId] || PeppersHomeDecor;
  const rand = useMemo(() => seededRandom(biomeId.length * 7919 + 42), [biomeId]);

  const palette = { ...biome.palette, bg, glow };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        transition: "background 0.8s ease",
        background: bg,
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "140%",
          height: "60%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${glow}18 0%, transparent 70%)`,
          transition: "background 0.8s ease",
          pointerEvents: "none",
        }}
      />

      {/* Bottom glow */}
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: "40%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${glow}10 0%, transparent 70%)`,
          transition: "background 0.8s ease",
          pointerEvents: "none",
        }}
      />

      {/* Decorative SVG layer */}
      <svg
        viewBox="0 0 360 800"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <DecorComponent palette={palette} rand={rand} />
      </svg>
    </div>
  );
}
