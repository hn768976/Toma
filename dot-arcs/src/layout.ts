import { clamp, lerp, makeIndexNoise, mulberry32, smootherstep } from './rng';

/**
 * All geometry below is in *frame-height units* (1.0 == the height of the
 * composition). The renderer multiplies by the real device pixel height, so dot
 * sizes, blur radii and jitter all scale with resolution — the 1080p preview is
 * a true downscale of the 4K master rather than a differently-blurred image.
 */

export const DURATION = 300;
export const FPS = 30;

/** Centre of the concentric family, off-frame just beyond the right edge. */
export const CENTER_X = 1.62;
export const CENTER_Y = -1.1;

const N_ARCS = 30;
const R_MIN = 1.06;
const R_MAX = 2.72;

/** Radius the focus plane sits at, chosen so the sharp band crosses the middle
 * of the frame diagonally. */
const FOCUS_R = 1.78;

/**
 * Ridge radii. Fingerprint ridges are never evenly spaced, and the foreground
 * ones sit much further apart than the far ones, so the near bokeh reads as
 * separated chains of discs rather than one soft wall.
 */
const buildRadii = () => {
  const spacingNoise = makeIndexNoise(0xa11ce, N_ARCS, 5.5);
  const spacingNoise2 = makeIndexNoise(0xb0b, N_ARCS, 2.1);
  const gaps: number[] = [];
  for (let i = 0; i < N_ARCS - 1; i++) {
    const trend = 0.32 + 3.4 * Math.pow(i / (N_ARCS - 2), 1.4);
    gaps.push(
      Math.max(
        0.12,
        trend * (1 + 0.3 * spacingNoise(i) + 0.15 * spacingNoise2(i)),
      ),
    );
  }
  const scale = (R_MAX - R_MIN) / gaps.reduce((a, b) => a + b, 0);
  const radii = [R_MIN];
  for (let i = 0; i < N_ARCS - 1; i++) {
    radii.push(radii[i] + gaps[i] * scale);
  }
  return radii;
};

const RADII = buildRadii();

/** Depth of the focus plane, as a normalised arc index. */
export const FOCUS_T = (() => {
  for (let i = 0; i < RADII.length - 1; i++) {
    if (RADII[i] <= FOCUS_R && FOCUS_R <= RADII[i + 1]) {
      const f = (FOCUS_R - RADII[i]) / (RADII[i + 1] - RADII[i]);
      return (i + f) / (N_ARCS - 1);
    }
  }
  return 0.5;
})();

/**
 * Dot spacing along the arc. Grows sharply toward the foreground so the near
 * discs overlap only slightly instead of merging into a continuous tube.
 */
const DOT_SPACING = 0.019;
const spacingAt = (t: number) =>
  DOT_SPACING * (0.5 + 4.15 * Math.pow(t, 3.5));

/** Nominal angular travel over one 300-frame loop, in radians. */
const SWEEP = 0.48;

export const N_BUCKETS = 8;

export const dotRadiusAt = (t: number) => 0.0024 + 0.0062 * Math.pow(t, 1.15);

/**
 * Near dots blur into discs several times their own diameter; the far side
 * softens far more gently, as in the reference where the far ridges stay
 * readable inside the haze.
 */
export const blurRadiusAt = (t: number) =>
  t > FOCUS_T
    ? 0.068 * Math.pow((t - FOCUS_T) / (1 - FOCUS_T), 0.9)
    : 0.008 * Math.pow((FOCUS_T - t) / FOCUS_T, 1.15);

/** The sharp band is brightest; both ends fall away. */
/** How far this depth sits from the focus plane, normalised per side. */
export const defocusAt = (t: number) =>
  t > FOCUS_T ? (t - FOCUS_T) / (1 - FOCUS_T) : (FOCUS_T - t) / FOCUS_T;

export const brightnessAt = (t: number) =>
  t > FOCUS_T
    ? lerp(1, 0.42, Math.pow((t - FOCUS_T) / (1 - FOCUS_T), 1.15))
    : lerp(1, 0.55, Math.pow((FOCUS_T - t) / FOCUS_T, 1.05));

/** Near bokeh sits around a third opaque so the sharp band reads through it. */
export const opacityAt = (t: number) =>
  t > FOCUS_T
    ? lerp(0.95, 0.26, Math.pow((t - FOCUS_T) / (1 - FOCUS_T), 0.8))
    : lerp(0.95, 0.72, Math.pow((FOCUS_T - t) / FOCUS_T, 1.0));

export const bucketOf = (t: number) =>
  clamp(Math.floor(t * N_BUCKETS), 0, N_BUCKETS - 1);

export const bucketCenterT = (b: number) => (b + 0.5) / N_BUCKETS;

export type Arc = {
  index: number;
  /** Depth, taken from the arc index: 0 far, 1 near. */
  t: number;
  bucket: number;
  radius: number;
  /** Local ridge gap; radial jitter is measured against it. */
  gap: number;
  /** Dots around the complete ring. */
  K: number;
  /** Signed whole number of dot spacings travelled over one loop. */
  m: number;
  /**
   * |m|. Every per-dot attribute repeats with this period, which is what makes
   * the loop exact: after 300 frames dot k sits exactly where dot k+m sat, and
   * carries identical size, colour, jitter and shimmer.
   */
  period: number;
  dTheta: number;
  phase0: number;
  angJit: Float32Array;
  radJit: Float32Array;
  sizeMul: Float32Array;
  bright: Float32Array;
  shimAmp: Float32Array;
  shimPhase: Float32Array;
  shimRate: Float32Array;
  /** 0 where the ridge breaks. Fingerprint ridges are dashed, not continuous. */
  present: Uint8Array;
  /** Pooled fields the palette pass turns into colour indices. */
  accentGate: Float32Array;
  accentPick: Float32Array;
};

const buildArcs = (): Arc[] => {
  const rand = mulberry32(0x5eed1a7);
  const rateNoise = makeIndexNoise(0xc0ffee, N_ARCS, 6.5);
  const driftNoiseA = makeIndexNoise(0xd1f7, N_ARCS, 7);
  const driftNoiseB = makeIndexNoise(0x2b17, N_ARCS, 5);

  // A handful of arcs run the other way. Costs nothing, and stops the field
  // reading as one rigid rotation.
  const counter = new Set<number>();
  while (counter.size < 5) counter.add(Math.floor(rand() * N_ARCS));

  const arcs: Arc[] = [];

  for (let i = 0; i < N_ARCS; i++) {
    const radius = RADII[i];
    const gap =
      (RADII[Math.min(N_ARCS - 1, i + 1)] - RADII[Math.max(0, i - 1)]) /
      (i === 0 || i === N_ARCS - 1 ? 1 : 2);
    const t = i / (N_ARCS - 1);
    // Per-arc rate variation lives in the sweep angle, not in m: linear speed
    // is radius * sweep, so bumping m alone would change nothing.
    //
    // The ring must hold a whole number of attribute periods, or the pattern
    // has a seam where the dot index wraps and the loop stops being exact. So
    // the sweep is quantised to 2*PI / blocks and K is blocks * period.
    const blocks = clamp(
      Math.round((2 * Math.PI) / (SWEEP * (1 + 0.18 * rateNoise(i)))),
      8,
      20,
    );
    const sweep = (2 * Math.PI) / blocks;
    const mAbs = Math.max(3, Math.round((radius * sweep) / spacingAt(t)));
    const K = mAbs * blocks;
    const m = counter.has(i) ? -mAbs : mAbs;
    const period = mAbs;

    const arand = mulberry32(0x1000 + i * 7919);
    const phase = () => (arand() * 2 - 1) * Math.PI;
    const fA = [phase(), phase(), phase()];
    const fB = [phase(), phase(), phase()];
    const fC = [phase(), phase()];
    const driftA = 0.6 * driftNoiseA(i);
    const driftB = 0.6 * driftNoiseB(i);

    const angJit = new Float32Array(period);
    const radJit = new Float32Array(period);
    const sizeMul = new Float32Array(period);
    const bright = new Float32Array(period);
    const shimAmp = new Float32Array(period);
    const shimPhase = new Float32Array(period);
    const shimRate = new Float32Array(period);
    const accentGate = new Float32Array(period);
    const accentPick = new Float32Array(period);
    const present = new Uint8Array(period);

    for (let k = 0; k < period; k++) {
      // u is the loop coordinate. Because every arc's sweep is close to SWEEP,
      // u tracks screen angle, so these fields pool across neighbouring arcs
      // instead of forming radial stripes.
      const w = (2 * Math.PI * k) / period;
      const f1 =
        (Math.sin(w + fA[0]) +
          0.55 * Math.sin(2 * w + fA[1]) +
          0.3 * Math.sin(3 * w + fA[2])) /
          1.85 +
        driftA;
      const f2 =
        (Math.sin(w + fB[0]) +
          0.6 * Math.sin(2 * w + fB[1]) +
          0.28 * Math.sin(3 * w + fB[2])) /
          1.88 +
        driftB;
      const f3 = (Math.sin(w + fC[0]) + 0.5 * Math.sin(2 * w + fC[1])) / 1.5;

      angJit[k] = (arand() * 2 - 1) * 0.2;
      radJit[k] = (arand() * 2 - 1) * 0.13;
      sizeMul[k] = clamp(
        0.62 + 0.88 * Math.pow(arand(), 1.55) + 0.1 * f3,
        0.45,
        1.7,
      );
      bright[k] = clamp(0.78 + 0.34 * arand() + 0.08 * f3, 0.5, 1.25);

      shimPhase[k] = arand() * Math.PI * 2;
      shimRate[k] = [1, 2, 3][Math.floor(arand() * 3)];
      shimAmp[k] = arand() < 0.14 ? 0.2 + 0.32 * arand() : 0;

      // Gaps pool into runs rather than peppering the ridge evenly.
      present[k] = arand() < 0.28 + 0.3 * f3 ? 0 : 1;

      // f1 decides *whether* a dot is an accent, f2 decides *which* accent.
      accentGate[k] = arand() < smootherstep(-0.2, 0.9, f1) ? 1 : 0;
      accentPick[k] = clamp((f2 + 1) * 0.5, 0, 0.999999);
    }

    arcs.push({
      index: i,
      t,
      bucket: bucketOf(t),
      radius,
      gap,
      K,
      m,
      period,
      dTheta: (2 * Math.PI) / K,
      phase0: arand() * Math.PI * 2,
      angJit,
      radJit,
      sizeMul,
      bright,
      shimAmp,
      shimPhase,
      shimRate,
      present,
      accentGate,
      accentPick,
    });
  }
  return arcs;
};

export const ARCS = buildArcs();

/**
 * Colour indices depend on the palette's accent weights, so they are resolved
 * per version; the geometry above is shared by all three.
 */
export const resolveColors = (
  accentWeights: number[],
  accentAmount: number,
): Uint8Array[] => {
  const total = accentWeights.reduce((a, b) => a + b, 0);
  const cum: number[] = [];
  let s = 0;
  for (const w of accentWeights) {
    s += w / total;
    cum.push(s);
  }
  return ARCS.map((arc) => {
    const out = new Uint8Array(arc.period);
    for (let k = 0; k < arc.period; k++) {
      if (arc.accentGate[k] < 0.5 || arc.accentPick[k] > accentAmount) {
        out[k] = 0;
        continue;
      }
      const target = arc.accentPick[k] / accentAmount;
      let j = 0;
      while (j < cum.length - 1 && target > cum[j]) j++;
      out[k] = j + 1;
    }
    return out;
  });
};
