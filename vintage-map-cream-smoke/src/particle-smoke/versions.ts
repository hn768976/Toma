// One data row per Particle Smoke version (sRGB). To add a colour, add a row
// here and a <Composition> in Root.tsx.
export type SmokeVersion = { id: string; particle: string; dense: string; bgCenter: string; bgEdge: string };

export const SMOKE_VERSIONS: Record<string, SmokeVersion> = {
  Blue: { id: "Blue", particle: "#3A7BFF", dense: "#A8CCFF", bgCenter: "#062066", bgEdge: "#00030F" },
  Gold: { id: "Gold", particle: "#FFB547", dense: "#FFE6B0", bgCenter: "#2A1804", bgEdge: "#050200" },
};
