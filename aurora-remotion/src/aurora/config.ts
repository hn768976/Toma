import {mulberry32, range, type Rng} from '../lib/rng';
import type {Wave} from '../lib/noise';

export type VariantId = 'green-ridge' | 'violet-storm' | 'sky-plate';

/** Vertical colour ramp of a curtain, from the hot bottom edge upward. */
export type Stop = {at: number; color: string; alpha: number};

export type Palette = {
  key: string;
  stops: readonly Stop[];
  /** Colour of the bright lower lip, used for the bloom pass. */
  hot: string;
};

const GREEN: Palette = {
  key: 'green',
  hot: '#c8ffe0',
  stops: [
    {at: 0.0, color: '#eafff3', alpha: 1.0},
    {at: 0.018, color: '#8dfabc', alpha: 0.94},
    {at: 0.09, color: '#4ade80', alpha: 0.78},
    {at: 0.22, color: '#28e07c', alpha: 0.5},
    {at: 0.4, color: '#2ec8b0', alpha: 0.27},
    {at: 0.56, color: '#4a9fd0', alpha: 0.14},
    {at: 0.72, color: '#a78bfa', alpha: 0.065},
    {at: 0.87, color: '#e0a0d0', alpha: 0.022},
    {at: 1.0, color: '#e8b4dc', alpha: 0.0},
  ],
};

const VIOLET: Palette = {
  key: 'violet',
  hot: '#ffd8ec',
  stops: [
    {at: 0.0, color: '#fff0f7', alpha: 1.0},
    {at: 0.016, color: '#8dfabf', alpha: 0.95},
    {at: 0.05, color: '#ff69b4', alpha: 0.86},
    {at: 0.13, color: '#ff3f9a', alpha: 0.62},
    {at: 0.27, color: '#e04ce6', alpha: 0.38},
    {at: 0.44, color: '#a95cf5', alpha: 0.2},
    {at: 0.63, color: '#7d6cff', alpha: 0.09},
    {at: 0.82, color: '#c3a8ff', alpha: 0.03},
    {at: 1.0, color: '#d8c4ff', alpha: 0.0},
  ],
};

export type CurtainSpec = {
  seed: number;
  /** Bottom edge, as a fraction of frame height. */
  baseY: number;
  /** Wave amplitude of the bottom edge, fraction of frame height. */
  amp: number;
  /** Mean curtain height, fraction of frame height. */
  height: number;
  /** Horizontal extent in normalised x; may run past the frame. */
  x0: number;
  x1: number;
  /** Spatial frequency of the undulating base path. */
  pathFreq: number;
  /** Radius of the time circle: larger = the curtain waves faster. */
  pathSpeed: number;
  /** Frequency / speed of the height variation along the path. */
  heightFreq: number;
  heightSpeed: number;
  /** Fan-out: columns lean away from `vanishX`, by this much per unit height. */
  spread: number;
  tilt: number;
  vanishX: number;
  /** Height multiplier at x0 vs x1 — the perspective taper. */
  taper: number;
  /** Bow of the arc: the curtain dips toward its ends, as seen from beneath. */
  arc: number;
  /** Linear rise of the bottom edge across the frame — curtains are not
   * parallel to the horizon; they sweep down and out from the zenith. */
  slope: number;
  opacity: number;
  /** Long, staggered intensity swell. */
  swellA: number;
  swellPhA: number;
  swellB: number;
  swellPhB: number;
  /** Fine vertical bands, and the broad brightness envelope moving over them. */
  striations: Wave[];
  envelope: Wave[];
  /** Softness of the whole curtain: broad faint sheets get a wider blur. */
  soft: number;
};

export type Variant = {
  id: VariantId;
  palette: Palette;
  landscape: boolean;
  /** Overall aurora brightness trim for this version. */
  gain: number;
  /** Horizon line as a fraction of frame height (landscape variants only). */
  horizonY: number;
  curtains: CurtainSpec[];
  starCount: number;
  seed: number;
};

const makeWaves = (
  rng: Rng,
  count: number,
  fMin: number,
  fMax: number,
  nMin: number,
  nMax: number,
): Wave[] => {
  const raw: Wave[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const a = range(rng, 0.45, 1);
    total += a;
    raw.push({
      a,
      f: range(rng, fMin, fMax),
      // Integer cycle count -> the travelling phase closes the loop exactly.
      // The sign gives some curtains striations that drift the other way.
      n: Math.round(range(rng, nMin, nMax)) * (rng() < 0.3 ? -1 : 1),
      ph: rng(),
    });
  }
  return raw.map((w) => ({...w, a: w.a / total}));
};

const makeCurtain = (
  rng: Rng,
  seed: number,
  yLo: number,
  yHi: number,
  dominant: boolean,
  full: boolean,
): CurtainSpec => {
  const baseY = range(rng, yLo, yHi);
  // Convergence: the higher in frame a curtain sits, the closer it is to the
  // zenith of the arc — so it is narrower, steeper and leans harder.
  const zenith = 1 - (baseY - 0.2) / 0.75;
  // Not every curtain crosses the whole frame — some are shorter arcs.
  const x0 = range(rng, -0.34, 0.3);
  const x1 = x0 + range(rng, dominant ? 0.95 : 0.55, 1.62);

  return {
    seed,
    baseY,
    amp: range(rng, 0.04, 0.115) * (dominant ? 1 : 0.7),
    height: dominant
      ? range(rng, 0.3, 0.52) * (full ? 1.2 : 1)
      : range(rng, 0.16, 0.4) * (full ? 1.2 : 1),
    x0,
    x1,
    pathFreq: range(rng, 1.9, 5.2),
    pathSpeed: range(rng, 0.22, 0.55),
    heightFreq: range(rng, 1.1, 2.8),
    heightSpeed: range(rng, 0.15, 0.4),
    spread: range(rng, 0.5, 1.6) * (0.5 + 0.9 * zenith),
    tilt: range(rng, -0.3, 0.3),
    arc: range(rng, -0.04, 0.34),
    slope: range(rng, -0.42, 0.42) * (0.45 + 0.9 * zenith),
    vanishX: range(rng, 0.3, 0.72),
    taper: range(rng, 0.55, 1.0) * (rng() < 0.5 ? 1 : -1),
    opacity: dominant ? range(rng, 0.4, 0.72) : range(rng, 0.09, 0.22),
    swellA: Math.round(range(rng, 1, 2)),
    swellPhA: rng(),
    swellB: Math.round(range(rng, 2, 3)),
    swellPhB: rng(),
    striations: makeWaves(rng, 5, 22, 95, 5, 24),
    envelope: makeWaves(rng, 3, 1.2, 5, 1, 3),
    soft: dominant ? range(rng, 0.0, 0.2) : range(rng, 0.4, 0.78),
  };
};

const buildCurtains = (
  seed: number,
  count: number,
  dominantCount: number,
  yLo: number,
  yHi: number,
  full: boolean,
) => {
  const rng = mulberry32(seed);
  const out: CurtainSpec[] = [];
  for (let i = 0; i < count; i++) {
    const dominant = i < dominantCount;
    // Dominant curtains sit in the upper half of the band, the broad faint
    // sheets spread over the whole sky.
    const lo = dominant ? yLo : yLo + 0.04;
    const hi = dominant ? yLo + (yHi - yLo) * 0.62 : yHi;
    out.push(makeCurtain(rng, seed + i * 7919, lo, hi, dominant, full));
  }
  // Paint faint broad sheets first so the bright ones read on top.
  return out.sort((a, b) => a.opacity - b.opacity);
};

export const VARIANTS: Record<VariantId, Variant> = {
  'green-ridge': {
    id: 'green-ridge',
    palette: GREEN,
    landscape: true,
    gain: 1.0,
    horizonY: 0.858,
    starCount: 1900,
    seed: 20250412,
    curtains: buildCurtains(20250412, 8, 3, 0.28, 0.74, false),
  },
  'violet-storm': {
    id: 'violet-storm',
    palette: VIOLET,
    landscape: true,
    gain: 0.84,
    horizonY: 0.858,
    starCount: 2100,
    seed: 771103,
    curtains: buildCurtains(771103, 10, 4, 0.24, 0.76, false),
  },
  'sky-plate': {
    id: 'sky-plate',
    palette: GREEN,
    landscape: false,
    gain: 0.92,
    horizonY: 1.02,
    starCount: 2400,
    seed: 5150827,
    curtains: buildCurtains(5150827, 9, 3, 0.26, 0.92, true),
  },
};
