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
  /** Specular strength multiplier on the pleat crests */
  specGain?: number;
  /** Share of dots that sparkle (white glints) */
  glintShare?: number;
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
  /** Amplitude (in pleats) of the in-place 90-frame twist of the pleats */
  swayPleats: number;
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
  /** Funnel depth as a fraction of the radius */
  depth: number;
  /** Pleat (rib) height as a fraction of the radius */
  pleatAmp: number;
  /** Dots per pleat ridge */
  dotsPerRidge: number;
  /** Dot size multiplier */
  dotScale: number;
  /** Probability that a dot slot stays empty (gives the sparse, irregular look) */
  dropout: number;
  seed: number;
};

const blueMain: FlowerLook = {
  base: "#14235f",
  sheen: "#7a92f4",
  dot: "#97a7ff",
  warm: "#ffffff",
  warmShare: 0.05,
  dotGain: 1.15,
  specGain: 4,
  glintShare: 0.16,
};
/** Large defocused left bloom: lighter steel blue with small, dense dots. */
const steelBlue: FlowerLook = {
  base: "#1c3470",
  sheen: "#5d88d8",
  dot: "#8ea6ec",
  warm: "#fff0dc",
  warmShare: 0.03,
  dotGain: 0.95,
};
const blueWarm: FlowerLook = {
  base: "#1b3272",
  sheen: "#5a84dc",
  dot: "#86a4ee",
  warm: "#ffd9a8",
  warmShare: 0.07,
  dotGain: 1.75,
};
/** Muted cyan-blue (not green) teal, as in the reference. */
const teal: FlowerLook = {
  base: "#06263a",
  sheen: "#2a8db0",
  dot: "#3aa4c6",
  dotGain: 0.9,
};
const tealBlue: FlowerLook = {
  base: "#072a44",
  sheen: "#2f8fc4",
  dot: "#46a6d8",
  dotGain: 1.0,
};
const purple: FlowerLook = {
  base: "#130b30",
  sheen: "#3b308c",
  dot: "#5a4eae",
  dotGain: 0.6,
};
const navy: FlowerLook = {
  base: "#060d28",
  sheen: "#25408a",
  dot: "#3f58a8",
  dotGain: 0.5,
};

const base = {
  pleats: 44,
  // in-place twist, repeating every 90 frames like the reference
  swayPleats: 0.3,
  dir: 1,
  twist: 1.15,
  lobes: 4,
  lobeAmp: 0.09,
  lobePhase: 0,
  tiltX: 0,
  tiltY: 0,
  depth: 0.55,
  pleatAmp: 0.07,
  dotsPerRidge: 16,
  dotScale: 0.55,
  dropout: 0.15,
};

export const FLOWERS: FlowerDef[] = [
  {
    ...base,
    id: "topLeft",
    sx: 70,
    sy: -40,
    rPx: 165,
    z: -6.5,
    look: navy,
    seed: 11,
    lobePhase: 1.2,
    dir: -1,
  },
  {
    ...base,
    id: "top",
    sx: 445,
    sy: -15,
    rPx: 175,
    z: -5.5,
    look: blueWarm,
    seed: 12,
    lobePhase: 2.1,
    pleats: 44,
  },
  {
    ...base,
    id: "right",
    sx: 770,
    sy: 175,
    rPx: 165,
    z: -5.0,
    look: navy,
    seed: 13,
    lobePhase: 0.4,
    dir: -1,
    tiltY: -0.35,
  },
  {
    ...base,
    id: "botRight",
    sx: 650,
    sy: 425,
    rPx: 150,
    z: -4.6,
    look: purple,
    seed: 14,
    lobePhase: 2.8,
    pleats: 44,
  },
  {
    ...base,
    id: "botLeft",
    sx: 40,
    sy: 430,
    rPx: 150,
    z: -3.6,
    look: purple,
    seed: 15,
    lobePhase: 0.9,
    dir: -1,
  },
  {
    ...base,
    id: "left",
    sx: 205,
    sy: 226,
    rPx: 205,
    z: -3.5,
    look: steelBlue,
    seed: 16,
    lobePhase: 1.7,
    tiltY: 0.25,
    tiltX: -0.1,
    pleats: 46,
    dotsPerRidge: 24,
    dotScale: 0.34,
    dropout: 0.2,
  },
  {
    ...base,
    id: "main",
    swayPleats: 0.15,
    sx: 486,
    sy: 198,
    rPx: 172,
    z: 0,
    look: blueMain,
    seed: 17,
    pleats: 48,
    twist: 1.1,
    depth: 0.9,
    pleatAmp: 0.085,
    dotsPerRidge: 10,
    dotScale: 1,
    dropout: 0.3,
    lobePhase: 0.55,
    tiltX: 0.22,
    tiltY: -0.28,
    lobes: 5,
    lobeAmp: 0.06,
  },
  {
    ...base,
    id: "leftTeal",
    sx: -40,
    sy: 190,
    rPx: 125,
    z: 0.6,
    look: tealBlue,
    seed: 18,
    dotsPerRidge: 12,
    dotScale: 0.95,
    lobePhase: 2.4,
    tiltY: 0.6,
  },
  {
    ...base,
    id: "botTeal",
    sx: 400,
    sy: 505,
    rPx: 158,
    z: 2.6,
    look: teal,
    seed: 19,
    lobePhase: 0.2,
    dir: -1,
    tiltX: -0.45,
  },
];

/** Reference camera distance and vertical FOV used to place the blooms. */
export const LAYOUT_CAMERA_Z = 20;
export const LAYOUT_FOV_DEG = 26;
const LAYOUT_ASPECT = 16 / 9;

/** World-space centre and radius of a bloom from its screen-space authoring values. */
export const flowerWorld = (def: FlowerDef) => {
  const tanHalf = Math.tan(((LAYOUT_FOV_DEG / 2) * Math.PI) / 180);
  const halfH = (LAYOUT_CAMERA_Z - def.z) * tanHalf;
  const halfW = halfH * LAYOUT_ASPECT;
  return {
    x: (def.sx / 768 - 0.5) * 2 * halfW,
    y: (0.5 - def.sy / 432) * 2 * halfH,
    z: def.z,
    radius: (def.rPx / 432) * 2 * halfH,
  };
};

export const flowerById = (id: string) => {
  const f = FLOWERS.find((d) => d.id === id);
  if (!f) throw new Error(`Unknown bloom ${id}`);
  return flowerWorld(f);
};
