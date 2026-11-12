import { hex, type FieldStyle, type HelixStyle, type Preset, type RGB, type Rig } from "./types";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

type Palette = {
  bg: Preset["bg"];
  strand: readonly RGB[];
  sparkle: RGB;
  plexus: RGB;
  facet: RGB;
  node: RGB;
  fieldLine: RGB;
  dust: readonly RGB[];
  blob: RGB;
};

/**
 * Reference 1 ("Rose plexus"): warm olive studio background, rose-gold
 * particle strands wrapped in a pale-blue plexus haze, peach bokeh rings.
 */
const ROSE: Palette = {
  bg: {
    dark: hex("#252920"),
    mid: hex("#5a6152"),
    light: hex("#8a9280"),
    center: [0.5, 0.86],
    radius: [0.66, 0.78],
    vignette: 0.32,
  },
  strand: [hex("#f2907c"), hex("#ffac96"), hex("#e27a6e"), hex("#f69c86")],
  sparkle: hex("#fff3ea"),
  plexus: hex("#5ea6ea"),
  facet: hex("#5aa4ec"),
  node: hex("#b5dcff"),
  fieldLine: hex("#8fb4cf"),
  dust: [hex("#f29a74"), hex("#e8875e"), hex("#ffb08a"), hex("#d9946c")],
  blob: hex("#f0a27c"),
};

/**
 * Version 2 palette ("Midnight gold"): the same scene re-lit as a deep
 * indigo night with molten-gold strands and a cyan plexus — complementary
 * contrast instead of the reference's warm-on-olive harmony.
 */
const MIDNIGHT: Palette = {
  bg: {
    dark: hex("#03040c"),
    mid: hex("#0f1430"),
    light: hex("#2e3a78"),
    center: [0.5, 0.86],
    radius: [0.62, 0.72],
    vignette: 0.42,
  },
  strand: [hex("#ffb02e"), hex("#ffc85a"), hex("#f08a1c"), hex("#ffbb40")],
  sparkle: hex("#fff7df"),
  plexus: hex("#1fb8e0"),
  facet: hex("#1a9ad0"),
  node: hex("#a8f4ff"),
  fieldLine: hex("#4a6fc0"),
  dust: [hex("#ffc45a"), hex("#4fd8f2"), hex("#ffb347"), hex("#9fa8ff")],
  blob: hex("#ffb347"),
};

const helixStyle = (p: Palette): HelixStyle => ({
  radius: 1,
  pitch: 5.0,
  yMin: -6.5,
  yMax: 6.5,
  rungsPerTurn: 10,
  strandOffset: Math.PI,
  strand: {
    density: 400,
    jitter: 0.032,
    colors: p.strand,
    size: [6.5, 10],
    alpha: [0.55, 0.9],
    sparkleChance: 0.015,
    sparkleColor: p.sparkle,
    sparkleSize: [5, 9],
  },
  rung: {
    count: 170,
    jitter: 0.022,
    colorA: p.strand[0],
    colorB: p.strand[1],
    size: [4.5, 7.5],
    alpha: [0.5, 0.85],
    inset: 0.04,
  },
  plexus: {
    nodesPerUnit: 230,
    jitter: 0.13,
    rungNodes: 60,
    rungJitter: 0.065,
    k: 3,
    maxDist: 0.28,
    color: p.plexus,
    alpha: 0.27,
    width: 1.5,
    facetChance: 0.55,
    facetAlpha: 0.11,
    facetColor: p.facet,
    nodeColor: p.node,
    nodeSize: [2.5, 4.5],
    nodeAlpha: 0.35,
    haze: { perUnit: 50, perRung: 12, jitter: 0.12, size: [40, 80], alpha: 0.11, color: p.facet },
  },
});

const fieldStyle = (p: Palette): FieldStyle => ({
  nodes: 900,
  box: { x: [-9, 11], y: [-7, 7], z: [-12, 2.4] },
  k: 3,
  maxDist: 1.8,
  lineColor: p.fieldLine,
  lineAlpha: 0.3,
  lineWidth: 1.3,
  nodeKind: 0,
  nodeColor: p.node,
  nodeSize: [2.5, 4],
  nodeAlpha: 0.5,
  facetChance: 0.12,
  facetAlpha: 0.025,
  dust: 1100,
  dustBox: { x: [-11, 13], y: [-8, 8], z: [-14, 3.4] },
  dustColors: p.dust,
  dustSize: [4, 8],
  dustAlpha: [0.6, 1],
});

/**
 * Locked-off camera with a gentle truck/push, helix spinning on its axis so
 * the strand crossing climbs from the bottom of frame to the top — the
 * motion of reference 1.
 */
const roseRig = (t: number, dur: number): Rig => {
  const u = t / dur;
  const camX = lerp(0.56, 0.5, smooth(u));
  const camZ = lerp(4.15, 4.05, u);
  const camY = lerp(0.1, -0.05, u);
  return {
    camPos: [camX, camY, camZ],
    target: [camX - 0.05, camY + 0.02, 0],
    fov: 35,
    roll: 0,
    helixPos: [0, 0, 0],
    helixSpin: -0.41 + 0.24 * t,
    helixTilt: [0.04, -0.06],
    focus: 3.3,
  };
};

const base = (name: string, p: Palette): Preset => ({
  name,
  seed: 1308,
  bg: p.bg,
  helix: helixStyle(p),
  field: fieldStyle(p),
  blobs: [
    { from: [-2.6, -0.9, 2.45], to: [-1.7, -0.45, 2.6], t0: 12.0, t1: 15.2, color: p.blob, size: 34, alpha: 0.55 },
  ],
  dof: { aperture: 30, fieldApertureScale: 1.7, maxCoc: 120, ringAmount: 1, refDepth: 3.8 },
  gain: { points: 0.92, lines: 1.1, facets: 1.2 },
  twinkle: 0.35,
  rig: roseRig,
});

export const PRESETS = {
  "rose-v1": base("Rose plexus (match)", ROSE),
  "rose-v2": base("Midnight gold (alt palette)", MIDNIGHT),
} satisfies Record<string, Preset>;

export type PresetId = keyof typeof PRESETS;
