/**
 * Flower definitions for the spiral-bloom field.
 *
 * Positions are authored in the reference's 768x432 screen space (sx, sy, rPx)
 * for a camera at z = 20 looking at the origin, and converted to world space
 * in the scene so the V1 layout lines up with the reference framing.
 */
export type FlowerLook = {
  /** Surface base colour (dark) */
  base: string;
  /** Specular / sheen colour on the pleat ridges */
  sheen: string;
  /** Dot colour */
  dot: string;
  /** Optional warm glint colour mixed into a share of the dots */
  warm?: string;
  /** Share of dots that use the warm colour (0..1) */
  warmShare?: number;
  /** Overall brightness multiplier of the dots */
  dotGain: number;
};

export type FlowerDef = {
  id: string;
  sx: number;
  sy: number;
  rPx: number;
  z: number;
  look: FlowerLook;
  /** Pleat count */
  pleats: number;
  /** Pleats advanced over the full loop (integer => seamless loop) */
  loopPleats: number;
  /** Rotation direction (+1 / -1) */
  dir: number;
  /** Spiral twist in radians from centre to rim */
  twist: number;
  /** Lobe count and amplitude for the wavy rim silhouette */
  lobes: number;
  lobeAmp: number;
  lobePhase: number;
  /** Tilt in radians around X and Y */
  tiltX: number;
  tiltY: number;
  /** Dots per pleat ridge */
  dotsPerRidge: number;
  /** Dot size multiplier */
  dotScale: number;
  /** Probability that a dot slot stays empty (gives the sparse, irregular look) */
  dropout: number;
  seed: number;
};

const blueMain: FlowerLook = {
  base: "#12205c",
  sheen: "#7088f0",
  dot: "#93a3ff",
  warm: "#ffffff",
  warmShare: 0.06,
  dotGain: 1.15,
};
const blueSoft: FlowerLook = {
  base: "#0f2259",
  sheen: "#4f7fe0",
  dot: "#7f9cf0",
  warm: "#ffd7a8",
  warmShare: 0.025,
  dotGain: 1.05,
};
const blueWarm: FlowerLook = {
  base: "#13265c",
  sheen: "#4f78d8",
  dot: "#6f8fe0",
  warm: "#ffcf96",
  warmShare: 0.22,
  dotGain: 1.1,
};
const teal: FlowerLook = {
  base: "#042a36",
  sheen: "#2397a8",
  dot: "#2fb4c4",
  dotGain: 0.95,
};
const purple: FlowerLook = {
  base: "#150b38",
  sheen: "#4d36a8",
  dot: "#6a55cf",
  dotGain: 0.7,
};
const navy: FlowerLook = {
  base: "#081030",
  sheen: "#2f4aa0",
  dot: "#4d66c0",
  dotGain: 0.65,
};

const base = {
  pleats: 44,
  loopPleats: 22,
  dir: 1,
  twist: 1.15,
  lobes: 4,
  lobeAmp: 0.09,
  lobePhase: 0,
  tiltX: 0,
  tiltY: 0,
  dotsPerRidge: 16,
  dotScale: 0.6,
  dropout: 0.15,
};

export const FLOWERS: FlowerDef[] = [
  { ...base, id: "topLeft", sx: 70, sy: -40, rPx: 165, z: -6.5, look: navy, seed: 11, lobePhase: 1.2, dir: -1 },
  { ...base, id: "top", sx: 445, sy: -15, rPx: 175, z: -5.5, look: blueWarm, seed: 12, lobePhase: 2.1, pleats: 40, loopPleats: 20 },
  { ...base, id: "right", sx: 770, sy: 175, rPx: 165, z: -5.0, look: blueWarm, seed: 13, lobePhase: 0.4, dir: -1, tiltY: -0.35 },
  { ...base, id: "botRight", sx: 650, sy: 420, rPx: 150, z: -4.6, look: purple, seed: 14, lobePhase: 2.8, pleats: 38, loopPleats: 19 },
  { ...base, id: "botLeft", sx: 40, sy: 430, rPx: 150, z: -3.6, look: purple, seed: 15, lobePhase: 0.9, dir: -1 },
  { ...base, id: "left", sx: 200, sy: 228, rPx: 205, z: -2.8, look: blueSoft, seed: 16, lobePhase: 1.7, tiltY: 0.25, tiltX: -0.1, pleats: 46, loopPleats: 23 },
  { ...base, id: "main", sx: 508, sy: 182, rPx: 163, z: 0, look: blueMain, seed: 17, dotsPerRidge: 11, dotScale: 1, dropout: 0.32, lobePhase: 0.55, tiltX: 0.18, tiltY: -0.22, lobes: 4, lobeAmp: 0.11 },
  { ...base, id: "leftTeal", sx: -40, sy: 190, rPx: 125, z: 0.6, look: teal, seed: 18, dotsPerRidge: 12, dotScale: 0.95, lobePhase: 2.4, tiltY: 0.6 },
  { ...base, id: "botTeal", sx: 395, sy: 455, rPx: 175, z: 2.6, look: teal, seed: 19, lobePhase: 0.2, dir: -1, tiltX: -0.45 },
];
