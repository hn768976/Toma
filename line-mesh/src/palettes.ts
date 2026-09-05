export type Palette = {
  background: string;
  horizon: string;
  shadow: string;
  mid: string;
  hot: string;
  spec: string;
  specAmount: number;
  specPow: number;
  rimAmount: number;
  glowStrength: number;
  glowThreshold: number;
};

/** V1 — deep blue, the reference match. */
export const BLUE: Palette = {
  background: "#02060f",
  horizon: "#0a1430",
  shadow: "#0d2a6b",
  mid: "#2a6fe8",
  hot: "#8ac0ff",
  spec: "#eaf4ff",
  specAmount: 0.85,
  specPow: 46,
  rimAmount: 0.3,
  glowStrength: 0.5,
  glowThreshold: 0.62,
};

/** V2 — copper / bronze. Warmer key, tighter and hotter specular so it reads
 *  as metal rather than tinted cloth. */
export const COPPER: Palette = {
  background: "#0f0805",
  horizon: "#241206",
  shadow: "#4a2a10",
  mid: "#c47a2a",
  hot: "#ffd8a0",
  spec: "#fff2dd",
  specAmount: 1.05,
  specPow: 62,
  rimAmount: 0.36,
  glowStrength: 0.6,
  glowThreshold: 0.6,
};
