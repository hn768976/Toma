import {random} from 'remotion';

/**
 * The one and only place in this project where a colour value, a banner string
 * or a glitch schedule is written down. Every layer reads what it needs from
 * here, so the two versions differ by data alone and not by branching code.
 */

// >>>REGION:types
export type Palette = {
  washMain: string;
  washDeep: string;
  textBg: string;
  textDark: string;
  textLight: string;
  bannerBlack: string;
  bannerWhite: string;
  fringeA: string;
  fringeB: string;
};

export type TextLayerMode = 'corrupt' | 'restoring';

export type GlitchProfile = {
  /** Frames to wait before the next tear cluster, before jitter, at a given instability. */
  tearInterval: (instability: number) => number;
  /** Slices displaced at once, low and high ends of the instability range. */
  sliceCount: [number, number];
  /** Slice band height in px. */
  sliceHeight: [number, number];
  /** Sideways displacement in px at full instability. */
  sliceShift: [number, number];
  /** Chromatic separation in px at full instability. */
  chromatic: number;
  /** Flat wash opacity at zero and full instability. */
  washAlpha: [number, number];
  /** Striation texture strength at zero and full instability. */
  striation: [number, number];
  /** Banner shift in px at full instability. */
  bannerJitter: number;
};

export type TextLayerBehaviour = {
  mode: TextLayerMode;
  /** Rough spacing between corruption events, in frames. */
  eventSpacing: number;
  /** Corrupted run length in lines. */
  lines: [number, number];
  /** How long a corrupted run persists, in frames. */
  duration: [number, number];
  /** In 'restoring' mode, the frame by which no corruption remains. */
  clearedBy: number;
};

export type VariantConfig = {
  name: string;
  palette: Palette;
  banner: string;
  glitch: GlitchProfile;
  text: TextLayerBehaviour;
  /** Single curve, 0..1, driving tears, displacement, fringe, wash and jitter together. */
  instability: (frame: number) => number;
  /** Whole-frame brightness lift, 0..1. Used for the closing confirmation beat. */
  pulse: (frame: number) => number;
  /** Whether frame 0 and frame 300 are pixel-identical. */
  loops: boolean;
};
// <<<REGION:types

// >>>REGION:name
export type VariantName = 'denied' | 'granted';
// <<<REGION:name

// >>>REGION:denied
// The system is already failing when the clip opens and still failing when it
// ends. Four sine terms whose periods all divide 300 give an irregular-looking
// oscillation that is nevertheless exactly periodic over the composition, so the
// loop closes. Range is clamped to 0.65..1.0 — high, with no arc.
const unstableCurve = (frame: number): number => {
  const f = frame % 300;
  const waves: [number, number, string][] = [
    [100, 0.42, 'osc-slow'],
    [60, 0.28, 'osc-mid'],
    [25, 0.18, 'osc-fast'],
    [12, 0.12, 'osc-flutter'],
  ];
  let sum = 0;
  let amp = 0;
  for (const [period, weight, seed] of waves) {
    const phase = random(seed) * Math.PI * 2;
    sum += weight * Math.sin((f / period) * Math.PI * 2 + phase);
    amp += weight;
  }
  const n = (sum / amp + 1) / 2;
  return 0.65 + n * 0.35;
};

const noPulse = (): number => 0;

const denied: VariantConfig = {
  name: 'denied',
  palette: {
    washMain: '#E82810',
    washDeep: '#B01008',
    textBg: '#B01008',
    textDark: '#7A1008',
    textLight: '#FF8060',
    bannerBlack: '#000000',
    bannerWhite: '#FFFFFF',
    fringeA: '#30D0E0',
    fringeB: '#2040E0',
  },
  banner: 'ACCESS DENIED',
  glitch: {
    // 0.65 instability -> 20 frames between clusters, 1.0 -> 8 frames.
    tearInterval: (i) => 20 - ((i - 0.65) / 0.35) * 12,
    sliceCount: [4, 14],
    sliceHeight: [8, 90],
    sliceShift: [20, 260],
    chromatic: 13,
    washAlpha: [0.44, 0.6],
    striation: [0.18, 0.42],
    bannerJitter: 6,
  },
  text: {
    mode: 'corrupt',
    eventSpacing: 40,
    lines: [8, 15],
    duration: [20, 30],
    clearedBy: Infinity,
  },
  instability: unstableCurve,
  pulse: noPulse,
  loops: true,
};
// <<<REGION:denied

// >>>REGION:granted
const ramp = (x: number, a: number, b: number, from: number, to: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  const eased = t * t * (3 - 2 * t);
  return from + (to - from) * eased;
};

// Opens exactly as unstable as the denied cut, then resolves. Not a loop.
const resolvingCurve = (frame: number): number => {
  if (frame < 45) return 1;
  if (frame < 150) return ramp(frame, 45, 150, 1, 0.45);
  if (frame < 240) return ramp(frame, 150, 240, 0.45, 0.08);
  if (frame < 252) return ramp(frame, 240, 252, 0.08, 0);
  return 0;
};

// A single soft lift across the whole frame over the closing 25 frames.
const confirmPulse = (frame: number): number => {
  if (frame < 275) return 0;
  return Math.sin(((frame - 275) / 25) * Math.PI);
};

const granted: VariantConfig = {
  name: 'granted',
  palette: {
    washMain: '#18C43A',
    washDeep: '#0A7A22',
    textBg: '#0A7A22',
    textDark: '#064A16',
    textLight: '#80FFA0',
    bannerBlack: '#000000',
    bannerWhite: '#FFFFFF',
    fringeA: '#E040A0',
    fringeB: '#E0A020',
  },
  banner: 'ACCESS GRANTED',
  glitch: {
    // Long gaps once the frame settles: isolated tears rather than clusters.
    tearInterval: (i) => 8 + (1 - i) * 70,
    sliceCount: [4, 14],
    sliceHeight: [8, 90],
    sliceShift: [20, 260],
    chromatic: 13,
    // The green sits darker and less saturated than the red — a green at the
    // red's intensity reads as toxic rather than as approval.
    washAlpha: [0.4, 0.55],
    striation: [0.14, 0.36],
    bannerJitter: 6,
  },
  text: {
    mode: 'restoring',
    eventSpacing: 40,
    lines: [8, 15],
    duration: [20, 30],
    clearedBy: 200,
  },
  instability: resolvingCurve,
  pulse: confirmPulse,
  loops: false,
};
// <<<REGION:granted

// >>>REGION:export
export const VARIANTS: Record<VariantName, VariantConfig> = {denied, granted};

export const getVariant = (name: VariantName): VariantConfig => VARIANTS[name];
// <<<REGION:export
