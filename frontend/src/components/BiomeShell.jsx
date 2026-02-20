/**
 * BiomeShell — Top-level wrapper that renders the biome background
 * behind app content and provides CSS custom properties for theming.
 *
 * Usage:
 *   <BiomeShell>
 *     <App />
 *   </BiomeShell>
 *
 * Components inside can use CSS vars:
 *   var(--biome-bg), var(--biome-accent), var(--biome-surface),
 *   var(--biome-text), var(--biome-glow)
 */

import { useMemo } from "react";
import { useGame } from "../context/GameContext";
import { getBiomePalette } from "../data/biomes";
import { BiomeBackground } from "./BiomeBackground";

export function BiomeShell({ children }) {
  const { state } = useGame();
  const { activeBiome, timeOfDay } = state;

  const palette = useMemo(
    () => getBiomePalette(activeBiome, timeOfDay),
    [activeBiome, timeOfDay]
  );

  const cssVars = {
    "--biome-bg": palette.bg,
    "--biome-accent": palette.accent,
    "--biome-surface": palette.surface,
    "--biome-text": palette.text,
    "--biome-glow": palette.glow,
  };

  return (
    <div style={{ ...cssVars, minHeight: "100vh", position: "relative" }}>
      <BiomeBackground biomeId={activeBiome} timeOfDay={timeOfDay} />
      {children}
    </div>
  );
}
