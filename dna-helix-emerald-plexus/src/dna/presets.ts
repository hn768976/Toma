import { hex, type FieldStyle, type HelixStyle, type Preset, type Rig } from "./types";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
/** gentle ease that keeps some speed at the ends (no dead stop) */
const soft = (t: number) => lerp(t, smooth(t), 0.5);

/**
 * Reference 2 ("Emerald plexus"): black void, white wire-frame plexus
 * strands, neon-green base-pair bars with yellow-green hot spots, a green
 * volumetric glow inside the helix and ring-marker plexus nodes behind.
 */
const helix: HelixStyle = {
  radius: 1,
  pitch: 5.2,
  yMin: -8,
  yMax: 9,
  rungsPerTurn: 10,
  strandOffset: Math.PI,
  strand: {
    density: 420,
    jitter: 0.06,
    colors: [hex("#e6ece6"), hex("#cfd8cf"), hex("#ffffff"), hex("#9ee39a")],
    size: [3, 5.5],
    alpha: [0.45, 0.9],
    sparkleChance: 0.07,
    sparkleColor: hex("#ffffff"),
    sparkleSize: [6, 10],
  },
  rung: {
    count: 120,
    jitter: 0.03,
    colorA: hex("#46e04a"),
    colorB: hex("#7cf05a"),
    size: [3.5, 6],
    alpha: [0.5, 0.95],
    inset: 0.05,
    bar: { color: hex("#3fdc44"), alpha: 0.85, width: 6.5, glowWidth: 24, glowAlpha: 0.22, continuous: true },
    hot: {
      color: hex("#d6ff3c"),
      clusters: [2, 4],
      count: 60,
      spread: 0.16,
      size: [8, 13],
      alpha: [0.6, 1],
    },
  },
  plexus: {
    nodesPerUnit: 300,
    jitter: 0.095,
    rungNodes: 16,
    rungJitter: 0.06,
    k: 3,
    maxDist: 0.22,
    color: hex("#dfe6df"),
    alpha: 0.55,
    width: 1.3,
    facetChance: 0.35,
    facetAlpha: 0.06,
    facetColor: hex("#d8e8d8"),
    nodeColor: hex("#ffffff"),
    nodeSize: [2.6, 4.6],
    nodeAlpha: 0.7,
    stray: { count: 420, maxDist: 2.2, color: hex("#38d040"), alpha: 0.45, width: 1.2 },
    haze: { perUnit: 16, perRung: 4, jitter: 0.15, size: [40, 80], alpha: 0.035, color: hex("#2fa236") },
  },
};

const field = (box: FieldStyle["box"], clearRadius?: number, nodes = 850): FieldStyle => ({
  nodes,
  clearRadius,
  box,
  k: 3,
  maxDist: 1.5,
  lineColor: hex("#cfd6cf"),
  lineAlpha: 0.33,
  lineWidth: 1.3,
  nodeKind: 2,
  nodeColor: hex("#f2f6f2"),
  nodeSize: [26, 36],
  nodeAlpha: 1,
  facetChance: 0,
  facetAlpha: 0,
  dust: 2200,
  dustBox: box,
  dustColors: [hex("#8fd08a"), hex("#c8d8c8"), hex("#5fbf5a"), hex("#d8e85a"), hex("#c8d040")],
  dustSize: [3.5, 7],
  dustAlpha: [0.4, 0.9],
});

/**
 * V1 — tracking shot matching the reference: the camera trucks left along
 * the helix (helix travels from the left third to the right third of
 * frame), cranes up slightly, while the helix axis rolls from a left lean
 * to a right lean and the molecule slowly spins.
 */
const trackingRig = (t: number, dur: number): Rig => {
  const u = t / dur;
  const s = soft(u);
  const camX = lerp(1.18, -0.66, s);
  const camY = lerp(-0.3, 0.6, s);
  return {
    camPos: [camX, camY, lerp(3.35, 3.95, smooth(u / 0.55))],
    target: [camX + 0.05, camY + 0.15, 0],
    fov: 40,
    roll: 0,
    helixPos: [0, 0, 0],
    helixSpin: 2.2 + 0.2 * t,
    helixTilt: [lerp(0.12, -0.42, smooth(u * 1.15 - 0.1)), lerp(0.14, -0.3, s)],
    focus: lerp(4.0, 4.35, smooth(u / 0.55)),
    glow: lerp(1, 0.62, smooth((u - 0.4) / 0.6)),
  };
};

/**
 * V2 — alternative camera: a rising orbital crane. It starts low, close and
 * looking up the molecule (worm's-eye), then circles ~150 degrees around
 * the helix while climbing and pulling back to a level side view.
 */
const orbitRig = (t: number, dur: number): Rig => {
  const u = t / dur;
  // reaches the level side view at ~85% of the clip, then holds and drifts
  const e = lerp(Math.min(1, u / 0.85), smooth(u / 0.85), 0.6);
  const ang = lerp(-1.65, 1.55, e) + 0.12 * Math.max(0, u - 0.85);
  const rad = lerp(2.25, 4.0, e);
  const y = lerp(-4.9, 1.0, e);
  const look = lerp(4.3, 0.2, smooth(u / 0.8));
  return {
    camPos: [Math.sin(ang) * rad, y, Math.cos(ang) * rad],
    target: [Math.sin(ang) * 0.3, y + look, Math.cos(ang) * 0.3],
    fov: lerp(54, 38, e),
    roll: lerp(-0.28, 0.03, e),
    helixPos: [0, 0, 0],
    helixSpin: 1.0 + 0.12 * t,
    helixTilt: [0, 0],
    focus: rad - 0.45,
    glow: lerp(1, 0.75, u),
  };
};

const glow = {
  color: hex("#1c8f22"),
  intensity: 0.21,
  size: 3.2,
  spacing: 0.45,
  offset: [-0.45, 0.1] as const,
  yRange: [0.0, 2.0] as const,
};
const glowOrbit = { ...glow, offset: [0, 0] as const, yRange: [-3.5, 3.5] as const, intensity: 0.13 };

const helixOrbit: HelixStyle = { ...helix, yMax: 15 };

export const PRESETS = {
  "emerald-v1": {
    name: "Emerald plexus (match)",
    seed: 619,
    bg: {
      dark: hex("#000000"),
      mid: hex("#020302"),
      light: hex("#061006"),
      center: [0.3, 0.6],
      radius: [0.5, 0.6],
      vignette: 0.3,
    },
    helix,
    field: field({ x: [1.3, 12], y: [-6, 7], z: [-10, 0.4] }),
    glow,
    dof: { aperture: 70, fieldApertureScale: 0.7, maxCoc: 90, ringAmount: 0.1, refDepth: 4.0 },
    gain: { points: 1.12, lines: 1.1, facets: 1 },
    twinkle: 0.4,
    rig: trackingRig,
  },
  "emerald-v2": {
    name: "Emerald plexus (orbital crane)",
    seed: 619,
    bg: {
      dark: hex("#000000"),
      mid: hex("#020302"),
      light: hex("#061006"),
      center: [0.5, 0.6],
      radius: [0.5, 0.6],
      vignette: 0.3,
    },
    helix: helixOrbit,
    field: field({ x: [-12, 12], y: [-10, 10], z: [-12, 12] }, 3.0, 1700),
    glow: glowOrbit,
    dof: { aperture: 34, fieldApertureScale: 1.3, maxCoc: 90, ringAmount: 0.15, refDepth: 3.5 },
    gain: { points: 1, lines: 1, facets: 1 },
    twinkle: 0.4,
    fog: { start: 4.2, density: 0.13 },
    rig: orbitRig,
  },
} satisfies Record<string, Preset>;

export type PresetId = keyof typeof PRESETS;
