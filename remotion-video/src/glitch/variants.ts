/**
 * The three looks, one per supplied reference.
 *
 * All lengths are in *design pixels* on a 1920x1080 canvas. A 4K render sets
 * resolutionScale = 2 and the shaders divide by it, so the 4K master is a
 * genuine 2x supersample of the same composition rather than a different one.
 *
 * Loop-critical values (anything named *Cycles or *Slots, and the noise drift)
 * must stay whole numbers, or the clip will pop on the cut back to frame 0.
 */

export const FPS = 30;
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export type FieldParams = {
  fieldFreq: [number, number];
  period: [number, number, number];
  driftPeriods: [number, number, number];
  densityBias: number;
  densityGain: number;
  bandAmount: number;
  columnAmount: number;
};

export type CellParams = {
  cell: [number, number];
  gutter: [number, number];
  speedSteps: number;
  coverage: number;
  runCoherence: number;
  maxRun: number;
  holeChance: number;
  streakChance: number;
  streakRun: number;
  streakBoost: number;
  twinkleCycles: number;
  twinkleDepth: number;
  cellSparkle: number;
  hotChance: number;
  hotBoost: number;
  primaryChance: number;
  hueJitter: number;
  rowHueJitter: number;
  bright: number;
  sat: number;
  rowWarp: number;
  rowJitter: number;
  waveFreq: number;
  waveCycles: number;
  tearChance: number;
  tearAmount: number;
  tearBlock: number;
  tearSlots: number;
};

export type PostParams = {
  threshold: number;
  knee: number;
  bloomARadius: [number, number];
  bloomBRadius: [number, number];
  bloomAMix: number;
  bloomBMix: number;
  aberration: number;
  scanAmount: number;
  scanPeriod: number;
  grain: number;
  vignette: number;
  exposure: number;
  blackPoint: number;
  lift: [number, number, number];
};

export type GlitchVariant = {
  id: string;
  label: string;
  reference: string;
  durationInSeconds: number;
  seed: number;
  palette: string[];
  field: FieldParams;
  cells: CellParams;
  post: PostParams;
};

/** Reference f71c11cd / istock 1413416855 — dense full-frame chromatic storm. */
const DATA_STORM: GlitchVariant = {
  id: "DataStorm",
  label: "Data Storm",
  reference: "istockphoto-1413416855",
  durationInSeconds: 8,
  seed: 17.31,
  palette: [
    "#1b2bff",
    "#0a74ff",
    "#00cfff",
    "#22e6a4",
    "#ffd24a",
    "#ff7a2a",
    "#ff2fa0",
    "#b44cff",
    "#2a3cff",
  ],
  field: {
    fieldFreq: [4, 3],
    period: [4, 3, 4],
    driftPeriods: [1, 0, 2],
    densityBias: 0.45,
    densityGain: 1.6,
    bandAmount: 0.15,
    columnAmount: 0.1,
  },
  cells: {
    cell: [5, 4],
    gutter: [0, 0.22],
    speedSteps: 2,
    coverage: 1.0,
    runCoherence: 0.7,
    maxRun: 8,
    holeChance: 0.08,
    streakChance: 0.05,
    streakRun: 40,
    streakBoost: 1.7,
    twinkleCycles: 8,
    twinkleDepth: 0.45,
    cellSparkle: 0.35,
    hotChance: 0.02,
    hotBoost: 2.6,
    primaryChance: 0.0,
    hueJitter: 0.55,
    rowHueJitter: 0.18,
    bright: 1.5,
    sat: 1.15,
    rowWarp: 0.035,
    rowJitter: 0.02,
    waveFreq: 0.07,
    waveCycles: 1,
    tearChance: 0.1,
    tearAmount: 90,
    tearBlock: 6,
    tearSlots: 16,
  },
  post: {
    threshold: 0.22,
    knee: 0.25,
    bloomARadius: [1.0, 0.45],
    bloomBRadius: [1.3, 0.5],
    bloomAMix: 0.8,
    bloomBMix: 0.55,
    aberration: 1.2,
    scanAmount: 0.0,
    scanPeriod: 4,
    grain: 0.006,
    vignette: 0.25,
    exposure: 1.2,
    blackPoint: 0.01,
    lift: [0.0, 0.0, 0.004],
  },
};

/** Reference 751c2d5c / istock 1413416777 — sparse dust and laser bars on black. */
const SIGNAL_DUST: GlitchVariant = {
  id: "SignalDust",
  label: "Signal Dust",
  reference: "istockphoto-1413416777",
  durationInSeconds: 8,
  seed: 64.09,
  palette: [
    "#1030ff",
    "#1f7bff",
    "#2fd0ff",
    "#8ff0ff",
    "#ffffff",
    "#ff4a3a",
    "#e01030",
    "#ff2f9a",
    "#1a3cff",
  ],
  field: {
    fieldFreq: [3, 3],
    period: [3, 3, 4],
    driftPeriods: [1, -1, 2],
    densityBias: 0.55,
    densityGain: 1.8,
    bandAmount: 0.85,
    columnAmount: 0.15,
  },
  cells: {
    cell: [5, 4],
    gutter: [0.06, 0.4],
    speedSteps: 2,
    coverage: 0.7,
    runCoherence: 0.3,
    maxRun: 3,
    holeChance: 0.28,
    streakChance: 0.025,
    streakRun: 22,
    streakBoost: 2.0,
    twinkleCycles: 6,
    twinkleDepth: 0.55,
    cellSparkle: 0.45,
    hotChance: 0.03,
    hotBoost: 2.4,
    primaryChance: 0.12,
    hueJitter: 0.22,
    rowHueJitter: 0.14,
    bright: 2.1,
    sat: 1.2,
    rowWarp: 0.02,
    rowJitter: 0.03,
    waveFreq: 0.11,
    waveCycles: 1,
    tearChance: 0.08,
    tearAmount: 60,
    tearBlock: 4,
    tearSlots: 12,
  },
  post: {
    threshold: 0.08,
    knee: 0.22,
    bloomARadius: [1.2, 0.5],
    bloomBRadius: [1.6, 0.55],
    bloomAMix: 2.0,
    bloomBMix: 1.4,
    aberration: 1.2,
    scanAmount: 0.0,
    scanPeriod: 4,
    grain: 0.01,
    vignette: 0.3,
    exposure: 1.3,
    blackPoint: 0.008,
    lift: [0.0, 0.0, 0.003],
  },
};

/** Reference 72e1fa47 / istock 925779278 — fine navy scanline static, 15s. */
const SCANLINE_STATIC: GlitchVariant = {
  id: "ScanlineStatic",
  label: "Scanline Static",
  reference: "istockphoto-925779278",
  durationInSeconds: 15,
  seed: 128.77,
  palette: [
    "#04123a",
    "#0c2f7a",
    "#1553c8",
    "#2a86ff",
    "#5ab4ff",
    "#9fd4ff",
    "#1746a8",
    "#061a4a",
  ],
  field: {
    fieldFreq: [6, 2],
    period: [6, 2, 3],
    driftPeriods: [1, 0, 3],
    densityBias: 0.45,
    densityGain: 1.6,
    bandAmount: 0.1,
    columnAmount: 0.55,
  },
  cells: {
    cell: [10, 6],
    gutter: [0.08, 0.3],
    speedSteps: 3,
    coverage: 0.62,
    runCoherence: 0.7,
    maxRun: 12,
    holeChance: 0.2,
    streakChance: 0.05,
    streakRun: 45,
    streakBoost: 1.6,
    twinkleCycles: 15,
    twinkleDepth: 0.4,
    cellSparkle: 0.3,
    hotChance: 0.006,
    hotBoost: 2.2,
    primaryChance: 0.15,
    hueJitter: 0.18,
    rowHueJitter: 0.2,
    bright: 1.9,
    sat: 1.25,
    rowWarp: 0.012,
    rowJitter: 0.05,
    waveFreq: 0.23,
    waveCycles: 2,
    tearChance: 0.05,
    tearAmount: 40,
    tearBlock: 3,
    tearSlots: 30,
  },
  post: {
    threshold: 0.2,
    knee: 0.22,
    bloomARadius: [1.6, 0.35],
    bloomBRadius: [1.1, 0.45],
    bloomAMix: 0.5,
    bloomBMix: 0.3,
    aberration: 1.0,
    scanAmount: 0.1,
    scanPeriod: 6,
    grain: 0.004,
    vignette: 0.3,
    exposure: 1.35,
    blackPoint: 0.015,
    lift: [0.005, 0.012, 0.038],
  },
};

export const VARIANTS: GlitchVariant[] = [
  DATA_STORM,
  SIGNAL_DUST,
  SCANLINE_STATIC,
];

export const VARIANTS_BY_ID: Record<string, GlitchVariant> = Object.fromEntries(
  VARIANTS.map((v) => [v.id, v]),
);

export const durationInFrames = (v: GlitchVariant) =>
  Math.round(v.durationInSeconds * FPS);
