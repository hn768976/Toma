import type { BladeArrayConfig, GradientStop } from "./types";

/**
 * The ten data rows.
 *
 * Three looks, one rig. Look 1 is look 2 with the wave amplitude at zero and a
 * shallower blade profile; look 3 is either of them with a different value
 * curve on the environment gradient, plus a static horizontal bow on 3A and 3B.
 *
 * To add a colourway, copy the nearest row, change `id`/`outName` and the
 * gradient stops, and register it in Root.tsx. See README.md.
 */

const s = (p: number, c: [number, number, number], i: number): GradientStop => ({ p, c, i });

/** Repeat one lit zone at `count` evenly spaced positions around the gradient. */
const repeatZone = (
  count: number,
  zone: { at: number; c: [number, number, number]; i: number }[],
): GradientStop[] => {
  const out: GradientStop[] = [];
  for (let k = 0; k < count; k++) {
    const centre = k / count;
    for (const z of zone) out.push(s((centre + z.at + 1) % 1, z.c, z.i));
  }
  return out.sort((a, b) => a.p - b.p);
};

/** Shared defaults. A row only states what makes it different. */
const base = {
  stillFrame: 0,
  bladesPerFrame: 40,
  fill: 1.0,
  arcDeg: 18,
  thickness: 0.12,
  segY: 6,
  twistAmpDeg: 0,
  twistC: 0,
  twistK: 0,
  twistF: 1,
  twistW: 0,
  bowAmp: 0,
  bowCenters: [] as number[],
  bowWidth: 0.18,
  scrollN: 1,
  wallRadius: 2.6,
  azimZoom: 2.0,
  parallax: 0.85,
  specBlur: 0.011,
  diffBlur: 0.12,
  specGain: 1.0,
  diffGain: 0.03,
  keyIntensity: 1.1,
  ambient: 0.005,
  elevLo: 1.0,
  elevHi: 1.0,
  elevTilt: 0,
  elevFreq: 1,
  elevSym: 0,
  shadeMix: 0.45,
  shadePow: 2.0,
  band: null,
  backdrop: 0,
  exposure: 0.45,
  bloomIntensity: 0.35,
  bloomThreshold: 0.8,
  grain: 0.02,
} satisfies Omit<BladeArrayConfig, "id" | "outName" | "stops">;

// ---------------------------------------------------------------------------
// Look 1 - Ribbed Panel. Static blades; only the colour moves.
// ---------------------------------------------------------------------------

export const ribbedBlueGreen: BladeArrayConfig = {
  ...base,
  id: "RibbedPanel-BlueGreen",
  outName: "RibbedPanel_BlueGreen",
  stillFrame: 210,
  azimZoom: 3.0,
  exposure: 0.34,
  // Bright through the vertical middle, falling off top and bottom.
  elevSym: 1,
  elevLo: 1.2,
  elevHi: 0.42,
  elevTilt: 0.2,
  elevFreq: 1,
  stops: [
    s(0.0, [0.02, 0.07, 0.45], 0.2),
    s(0.13, [0.02, 0.1, 0.5], 0.24),
    s(0.27, [0.05, 0.3, 0.96], 0.85),
    s(0.39, [0.05, 0.72, 1.0], 1.55),
    s(0.5, [0.12, 1.0, 0.86], 2.05),
    s(0.61, [0.2, 1.0, 0.5], 1.7),
    s(0.71, [0.04, 0.55, 0.72], 0.8),
    s(0.83, [0.02, 0.14, 0.62], 0.3),
    s(0.92, [0.02, 0.09, 0.5], 0.22),
  ],
};

export const ribbedRainbow: BladeArrayConfig = {
  ...base,
  id: "RibbedPanel-Rainbow",
  outName: "RibbedPanel_Rainbow",
  stillFrame: 120,
  bladesPerFrame: 48,
  azimZoom: 2.6,
  parallax: 0.8,
  elevLo: 1.65,
  elevHi: 0.12,
  elevTilt: 0.3,
  elevFreq: 1,
  exposure: 0.3,
  stops: [
    s(0.0, [1.0, 0.18, 0.8], 1.75),
    s(0.08, [0.25, 0.05, 0.5], 0.22),
    s(0.15, [0.55, 0.22, 1.0], 1.3),
    s(0.25, [0.15, 0.4, 1.0], 1.55),
    s(0.32, [0.05, 0.1, 0.35], 0.2),
    s(0.4, [0.12, 0.95, 1.0], 1.7),
    s(0.48, [0.35, 1.0, 0.35], 1.35),
    s(0.545, [0.06, 0.22, 0.1], 0.18),
    s(0.625, [1.0, 0.92, 0.22], 1.8),
    s(0.7, [1.0, 0.45, 0.08], 1.5),
    s(0.77, [0.3, 0.06, 0.06], 0.2),
    s(0.85, [1.0, 0.28, 0.55], 1.6),
    s(0.93, [0.35, 0.05, 0.28], 0.25),
  ],
};

export const ribbedTealBanded: BladeArrayConfig = {
  ...base,
  id: "RibbedPanel-TealBanded",
  outName: "RibbedPanel_TealBanded",
  stillFrame: 330,
  parallax: 0.6,
  exposure: 0.38,
  azimZoom: 2.2,
  elevLo: 1.35,
  elevHi: 0.12,
  elevTilt: 0.3,
  elevFreq: 1,
  stops: [
    s(0.0, [0.04, 0.55, 0.62], 0.9),
    s(0.08, [0.02, 0.2, 0.28], 0.1),
    s(0.17, [0.05, 0.7, 0.72], 1.1),
    s(0.3, [0.14, 1.0, 0.55], 1.5),
    s(0.37, [0.04, 0.3, 0.24], 0.12),
    s(0.45, [0.2, 1.0, 0.45], 1.6),
    s(0.56, [0.1, 0.95, 0.78], 1.3),
    s(0.63, [0.02, 0.22, 0.3], 0.09),
    s(0.72, [0.05, 0.62, 0.78], 1.0),
    s(0.86, [0.03, 0.35, 0.55], 0.5),
    s(0.94, [0.02, 0.12, 0.22], 0.09),
  ],
};

export const ribbedNavyGlow: BladeArrayConfig = {
  ...base,
  id: "RibbedPanel-NavyGlow",
  outName: "RibbedPanel_NavyGlow",
  stillFrame: 420,
  parallax: 0.55,
  azimZoom: 2.5,
  exposure: 0.38,
  keyIntensity: 1.4,
  elevLo: 0.85,
  elevHi: 1.1,
  elevTilt: 0.3,
  elevFreq: 1,
  bloomIntensity: 0.6,
  bloomThreshold: 0.7,
  ambient: 0.008,
  diffGain: 0.018,
  stops: [
    s(0.0, [0.01, 0.02, 0.09], 0.03),
    s(0.12, [0.02, 0.04, 0.2], 0.09),
    s(0.26, [0.02, 0.1, 0.45], 0.26),
    s(0.34, [0.03, 0.38, 0.88], 0.8),
    s(0.4, [0.03, 0.8, 1.0], 1.9),
    s(0.46, [0.1, 1.0, 0.8], 2.4),
    s(0.52, [0.2, 1.0, 0.42], 1.8),
    s(0.6, [0.03, 0.5, 0.6], 0.6),
    s(0.7, [0.02, 0.1, 0.4], 0.18),
    s(0.82, [0.01, 0.02, 0.12], 0.05),
    s(0.92, [0.01, 0.02, 0.07], 0.025),
  ],
};

// ---------------------------------------------------------------------------
// Look 2 - Wave Blades. Twisted ribbons, a wave travelling through the row.
// ---------------------------------------------------------------------------

const waveBase = {
  ...base,
  bladesPerFrame: 38,
  // Just wider than the pitch: face-on blades close the row without
  // interpenetrating, and gaps only open where the wave turns blades edge-on.
  fill: 1.05,
  arcDeg: 22,
  thickness: 0.18,
  // High enough that the twisted silhouette has no visible facets.
  segY: 168,
  twistAmpDeg: 66,
  twistC: 4.5,
  twistK: 1.6,
  twistF: 1,
  twistW: 0.6,
  parallax: 0.3,
  shadeMix: 0.5,
  keyIntensity: 1.1,
  // The references never go black behind the row; the gaps show more wall.
  backdrop: 0.1,
  bloomIntensity: 0.45,
};

export const waveBlueViolet: BladeArrayConfig = {
  ...waveBase,
  id: "WaveBlades-BlueViolet",
  outName: "WaveBlades_BlueViolet",
  stillFrame: 90,
  azimZoom: 2.2,
  exposure: 0.36,
  elevLo: 0.85,
  elevHi: 1.2,
  elevTilt: 0.25,
  stops: [
    s(0.0, [0.04, 0.06, 0.3], 0.16),
    s(0.12, [0.1, 0.12, 0.7], 0.55),
    s(0.24, [0.2, 0.25, 1.0], 1.2),
    s(0.36, [0.35, 0.4, 1.0], 1.5),
    s(0.46, [0.2, 0.75, 1.0], 1.8),
    s(0.56, [0.35, 1.0, 1.0], 2.0),
    s(0.66, [0.25, 0.5, 1.0], 1.35),
    s(0.76, [0.45, 0.3, 1.0], 1.15),
    s(0.86, [0.25, 0.1, 0.75], 0.5),
    s(0.94, [0.05, 0.04, 0.28], 0.14),
  ],
};

export const waveMagenta: BladeArrayConfig = {
  ...waveBase,
  id: "WaveBlades-Magenta",
  outName: "WaveBlades_Magenta",
  stillFrame: 240,
  azimZoom: 2.3,
  elevLo: 1.1,
  elevHi: 0.75,
  elevTilt: 0.28,
  exposure: 0.36,
  stops: [
    s(0.0, [0.12, 0.05, 0.45], 0.28),
    s(0.1, [0.45, 0.1, 0.9], 0.9),
    s(0.2, [1.0, 0.15, 0.8], 1.7),
    s(0.29, [1.0, 0.25, 0.5], 2.0),
    s(0.38, [1.0, 0.45, 0.35], 1.7),
    s(0.48, [0.5, 0.85, 1.0], 1.6),
    s(0.58, [0.15, 0.95, 1.0], 2.0),
    s(0.68, [0.25, 0.45, 1.0], 1.4),
    s(0.79, [0.6, 0.2, 1.0], 1.2),
    s(0.9, [0.25, 0.06, 0.6], 0.4),
  ],
};

export const waveCrimson: BladeArrayConfig = {
  ...waveBase,
  id: "WaveBlades-Crimson",
  outName: "WaveBlades_Crimson",
  stillFrame: 390,
  azimZoom: 2.4,
  elevLo: 1.15,
  elevHi: 0.55,
  elevTilt: 0.3,
  exposure: 0.4,
  bloomIntensity: 0.5,
  stops: [
    s(0.0, [0.03, 0.02, 0.14], 0.06),
    s(0.09, [0.25, 0.05, 0.55], 0.5),
    s(0.18, [0.6, 0.1, 1.0], 1.4),
    s(0.27, [1.0, 0.1, 0.65], 2.0),
    s(0.35, [1.0, 0.12, 0.2], 1.9),
    s(0.43, [0.7, 0.06, 0.25], 0.9),
    s(0.52, [0.2, 0.1, 0.95], 1.5),
    s(0.61, [0.15, 0.55, 1.0], 1.8),
    s(0.7, [0.45, 0.2, 1.0], 1.5),
    s(0.8, [0.7, 0.1, 0.9], 1.0),
    s(0.9, [0.1, 0.03, 0.3], 0.14),
  ],
};

// ---------------------------------------------------------------------------
// Look 3 - Neon Dark. Same rig; the value channel is near zero for most of the
// gradient's width, with narrow bright zones.
// ---------------------------------------------------------------------------

const neonBase = {
  ...base,
  bladesPerFrame: 40,
  fill: 1.0,
  arcDeg: 24,
  ambient: 0.010,
  keyIntensity: 1.3,
  // Strong bright-core-to-dark-edge ramp: each blade has to read as a
  // separately lit object with a dark seam, not as one even corrugation.
  shadeMix: 0.78,
  shadePow: 2.6,
  diffGain: 0.012,
  bloomIntensity: 0.5,
  bloomThreshold: 0.72,
  grain: 0.018,
};

export const neonColumns: BladeArrayConfig = {
  ...neonBase,
  id: "NeonDark-Columns",
  outName: "NeonDark_Columns",
  stillFrame: 150,
  segY: 40,
  // Low: the gradient must not swing through the whole palette inside every
  // blade. Hue moves across the column, brightness moves across the blade.
  parallax: 0.16,
  bowAmp: 0.05,
  bowCenters: [0.26, 0.74],
  bowWidth: 0.17,
  azimZoom: 2.08,
  exposure: 0.3,
  // Hourglass: glowing top and bottom, dark waist.
  elevSym: 1,
  elevLo: 0.45,
  elevHi: 1.2,
  elevTilt: 0.2,
  // Four lit zones around the gradient, so the half-turn that is visible at
  // any moment always holds two of them with a genuinely black band between.
  // Each zone runs cool to warm on its own - the columns are not one hue.
  stops: repeatZone(4, [
    { at: -0.0588, c: [0, 0, 0], i: 0 },
    { at: -0.045, c: [0.04, 0.12, 1.0], i: 0.7 },
    { at: -0.03, c: [0.12, 0.9, 1.0], i: 2.2 },
    { at: -0.015, c: [0.8, 1.0, 1.0], i: 2.9 },
    { at: 0.0, c: [1.0, 0.08, 0.14], i: 2.7 },
    { at: 0.0156, c: [1.0, 0.45, 0.04], i: 2.5 },
    { at: 0.0312, c: [1.0, 0.1, 0.7], i: 1.9 },
    { at: 0.0468, c: [0.32, 0.04, 0.9], i: 0.6 },
    { at: 0.06, c: [0, 0, 0], i: 0 },
  ]),
};

export const neonBarrel: BladeArrayConfig = {
  ...neonBase,
  id: "NeonDark-Barrel",
  outName: "NeonDark_Barrel",
  stillFrame: 300,
  segY: 40,
  parallax: 0.25,
  bowAmp: 0.055,
  bowCenters: [],
  azimZoom: 2.2,
  ambient: 0.012,
  diffGain: 0.03,
  elevSym: 1,
  elevLo: 0.6,
  elevHi: 1.25,
  elevTilt: 0.22,
  exposure: 0.38,
  stops: [
    s(0.0, [0.16, 0.04, 0.3], 0.3),
    s(0.07, [0.45, 0.05, 0.9], 0.9),
    s(0.14, [1.0, 0.1, 0.9], 2.3),
    s(0.22, [1.0, 0.2, 0.35], 1.9),
    s(0.29, [1.0, 0.45, 0.1], 2.2),
    s(0.36, [0.6, 0.12, 0.18], 0.7),
    s(0.44, [0.2, 0.05, 0.35], 0.34),
    s(0.53, [0.05, 0.25, 0.9], 0.9),
    s(0.6, [0.1, 0.95, 1.0], 2.3),
    s(0.67, [0.2, 1.0, 0.75], 1.7),
    s(0.75, [0.08, 0.35, 0.7], 0.55),
    s(0.83, [0.14, 0.07, 0.45], 0.34),
    s(0.92, [0.25, 0.03, 0.4], 0.25),
  ],
};

export const neonWaveBand: BladeArrayConfig = {
  ...neonBase,
  id: "NeonDark-WaveBand",
  outName: "NeonDark_WaveBand",
  stillFrame: 60,
  parallax: 0.35,
  bladesPerFrame: 38,
  fill: 0.86,
  arcDeg: 18,
  thickness: 0.18,
  segY: 80,
  twistAmpDeg: 55,
  twistC: 5.0,
  twistK: 1.6,
  twistF: 1,
  twistW: 1.1,
  azimZoom: 2.2,
  elevLo: 1.0,
  elevHi: 1.0,
  elevTilt: 0,
  band: { half: 0.26, soft: 0.5, amp: 0.6, freq: 1, zoom: 1.7, elev: 2.6 },
  stops: [
    s(0.0, [0.05, 0.1, 0.9], 1.2),
    s(0.12, [0.15, 0.5, 1.0], 1.8),
    s(0.24, [0.6, 0.15, 1.0], 1.6),
    s(0.34, [1.0, 0.08, 0.35], 2.2),
    s(0.44, [1.0, 0.15, 0.7], 1.9),
    s(0.55, [0.35, 0.1, 1.0], 1.5),
    s(0.66, [0.08, 0.35, 1.0], 1.8),
    s(0.76, [0.2, 0.8, 1.0], 1.7),
    s(0.86, [0.5, 0.1, 0.9], 1.5),
    s(0.94, [0.1, 0.12, 0.8], 1.2),
  ],
};

export const ALL_COMPOSITIONS: BladeArrayConfig[] = [
  ribbedBlueGreen,
  ribbedRainbow,
  ribbedTealBanded,
  ribbedNavyGlow,
  waveBlueViolet,
  waveMagenta,
  waveCrimson,
  neonColumns,
  neonBarrel,
  neonWaveBand,
];
