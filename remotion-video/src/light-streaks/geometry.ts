// The ribbon is one sine wave living on a straight axis, drawn many times
// over at different perpendicular offsets. Every strand is a pure function of
// (strandIndex, t) — Remotion renders frames out of order across workers, so
// nothing here may touch Math.random() or Date.now().
//
// `t` is normalised time, 0 at the first frame and 1 one frame past the last.
// Every temporal term is sin/cos of an INTEGER multiple of 2*pi*t, and every
// dash offset advances by an integer number of dash patterns, so t = 1 lands
// exactly back on t = 0 and the clip loops seamlessly.

import { seededRandom } from "../particle-ring/random";
import {
  AXIS_ANGLE_DEG,
  AXIS_LENGTH,
  AXIS_ORIGIN,
  SAMPLES,
} from "./constants";
import { PALETTES, type PaletteName } from "./palettes";

const TAU = Math.PI * 2;

const THETA = (AXIS_ANGLE_DEG * Math.PI) / 180;
export const AXIS_DIR = { x: Math.cos(THETA), y: Math.sin(THETA) };
/** Perpendicular to the axis; every offset in this file is along this vector. */
export const AXIS_NORMAL = { x: -Math.sin(THETA), y: Math.cos(THETA) };
export const AXIS_END = {
  x: AXIS_ORIGIN.x + AXIS_DIR.x * AXIS_LENGTH,
  y: AXIS_ORIGIN.y + AXIS_DIR.y * AXIS_LENGTH,
};

// --- The centreline ------------------------------------------------------
// Three harmonics travelling at 1x, 2x and 3x the loop rate. The amplitude
// grows with `s` so the near (bottom-left) end reads as a straight, strongly
// foreshortened run-up and the bends happen out in the middle of frame,
// the way they do in a perspective shot.
// ~1.05 wavelengths fit inside the visible slice of the axis, which is what
// keeps a full S in frame at every moment of the loop rather than the ribbon
// flattening out whenever a node drifts through.
const WAVE_F1 = 1.42;
const WAVE_F2 = 2.84;
const WAVE_F3 = 4.26;

const amplitude = (s: number) => 150 + 205 * Math.pow(Math.max(s, 0), 1.1);

export const waveOffset = (s: number, t: number) =>
  amplitude(s) *
  (Math.sin(TAU * (WAVE_F1 * s - t)) +
    0.24 * Math.sin(TAU * (WAVE_F2 * s - 2 * t + 0.37)) +
    0.08 * Math.sin(TAU * (WAVE_F3 * s + 3 * t + 0.82)));

// --- The bundle ----------------------------------------------------------
// Half-width of the strand bundle. Wide and open at the near end, converging
// towards the far end so the strands bunch into a hot spot as they recede.
const SPREAD_NEAR = 132;
const SPREAD_FAR = 44;
const spread = (s: number) => SPREAD_NEAR + (SPREAD_FAR - SPREAD_NEAR) * s;

export type Dash = {
  /** Dash pattern in viewBox units. */
  pattern: number[];
  /** Total pattern length — the offset has to be an exact multiple of this. */
  period: number;
  /** Whole patterns travelled over one loop. Integer keeps the loop seamless. */
  cycles: number;
};

export type Strand = {
  /** Position across the bundle, -1 (one edge) to 1 (the other). */
  offset: number;
  /**
   * How strongly this strand follows the centreline wave. Strands that sit
   * slightly off 1 trace a wider or tighter arc than the bundle, which is what
   * makes single lines peel away from the pack and cross open space.
   */
  waveGain: number;
  weaveAmp: number;
  weaveFreq: number;
  weavePhase: number;
  /** Integer, so the weave closes the loop. */
  weaveSpeed: number;
  width: number;
  opacity: number;
  color: string;
  sStart: number;
  sEnd: number;
  dash: Dash | null;
  /** Centre strands get extra bloom. */
  hot: number;
};

const pick = <T,>(list: T[], r: number) =>
  list[Math.min(list.length - 1, Math.floor(r * list.length))];

export const buildStrands = (
  count: number,
  seed: number,
  paletteName: PaletteName,
): Strand[] => {
  const palette = PALETTES[paletteName];
  const strands: Strand[] = [];

  for (let i = 0; i < count; i++) {
    const r = (salt: number) => seededRandom(i + seed * 131, salt);

    // Spread the strands evenly across the bundle, then jitter so they don't
    // read as a comb.
    const even = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const packed = Math.max(-1.1, Math.min(1.1, even + (r(1) - 0.5) * 0.22));

    // A fifth of the strands are strays: they sit well outside the bundle and
    // hold a different curvature, so they read as individual light trails
    // arcing through the empty part of the frame instead of more of the pack.
    const stray = r(24) < 0.2;
    const offset = stray ? packed * (1.5 + 1.7 * r(25)) : packed;
    const dist = Math.abs(packed);

    const band =
      dist < 0.16
        ? palette.core
        : dist < 0.4
          ? palette.inner
          : dist < 0.72
            ? palette.mid
            : palette.outer;

    // The accent hue rides the rim of the bundle in the reference, so bias it
    // towards the outer strands rather than sprinkling it evenly.
    const accentChance =
      palette.accentChance * (dist > 0.45 ? 1.9 : 0.7);
    const isAccent = r(2) < accentChance;
    const color = isAccent ? pick(palette.accent, r(3)) : pick(band, r(4));

    // Thick and bright at the centre of the bundle, thin and dim at its edge.
    const widthBase = 2.9 - 1.9 * Math.pow(dist, 0.8);
    const width = widthBase * (0.55 + 0.95 * r(5)) * (stray ? 0.62 : 1);

    // A few strand types: fine dotted "particle" runs, coarser dashes, short
    // bright shooters that fly along the curve, and plain solid lines.
    const kind = r(6);
    let dash: Dash | null = null;
    if (kind < 0.1) {
      const len = 90 + 420 * r(7);
      dash = { pattern: [len, 5200], period: len + 5200, cycles: 1 + Math.floor(r(8) * 3) };
    } else if (kind < 0.34) {
      const on = 1.2 + 1.6 * r(9);
      const off = 2.4 + 3.4 * r(10);
      dash = { pattern: [on, off], period: on + off, cycles: 90 + Math.floor(r(11) * 110) };
    } else if (kind < 0.48) {
      const on = 2.6 + 4 * r(12);
      const off = 3 + 6 * r(13);
      dash = { pattern: [on, off], period: on + off, cycles: 50 + Math.floor(r(14) * 70) };
    }

    strands.push({
      offset,
      waveGain: stray ? 0.62 + 0.5 * r(26) : 0.94 + 0.14 * r(26),
      weaveAmp: (0.1 + 0.4 * r(15)) * (stray ? 2.4 : 1),
      weaveFreq: 0.3 + 0.95 * r(16),
      weavePhase: r(17),
      weaveSpeed: r(18) < 0.5 ? -1 : 1,
      width,
      opacity: (0.4 + 0.6 * r(19)) * (stray ? 0.8 : 1),
      color,
      // Not every strand crosses the whole frame; letting them start and stop
      // at different points is what gives the bundle its layered depth.
      sStart: r(20) < 0.55 ? -0.06 : -0.06 + 0.34 * r(21),
      sEnd: r(22) < 0.55 ? 1.06 : 0.66 + 0.4 * r(23),
      dash,
      hot: Math.max(0, 1 - dist / 0.45),
    });
  }

  return strands;
};

/** Perpendicular distance of a strand from the axis at `s`. */
const strandOffset = (strand: Strand, s: number, t: number) =>
  waveOffset(s, t) * strand.waveGain +
  spread(s) *
    (strand.offset +
      strand.weaveAmp *
        Math.sin(
          TAU * (strand.weaveFreq * s + strand.weaveSpeed * t + strand.weavePhase),
        ));

/**
 * Sample the strand and smooth it into an SVG path. Quadratic segments through
 * the midpoints — cheap, and it stays curved at 4K where a polyline would
 * facet on the tight bends.
 */
export const strandPath = (strand: Strand, t: number) => {
  const xs: number[] = [];
  const ys: number[] = [];

  for (let j = 0; j < SAMPLES; j++) {
    const s = strand.sStart + (strand.sEnd - strand.sStart) * (j / (SAMPLES - 1));
    const d = strandOffset(strand, s, t);
    xs.push(AXIS_ORIGIN.x + AXIS_DIR.x * s * AXIS_LENGTH + AXIS_NORMAL.x * d);
    ys.push(AXIS_ORIGIN.y + AXIS_DIR.y * s * AXIS_LENGTH + AXIS_NORMAL.y * d);
  }

  const n = xs.length;
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let j = 1; j < n - 1; j++) {
    const mx = (xs[j] + xs[j + 1]) / 2;
    const my = (ys[j] + ys[j + 1]) / 2;
    d += `Q${xs[j].toFixed(1)} ${ys[j].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  d += `L${xs[n - 1].toFixed(1)} ${ys[n - 1].toFixed(1)}`;
  return d;
};
