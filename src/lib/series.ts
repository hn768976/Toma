import {rnd, rndRange, rndInt} from './rand';

/**
 * The price series.
 *
 * It is authored as a *tiling* series: the walk is expressed as `N` steps whose
 * sum is exactly zero, so the residual at index N equals the residual at index
 * 0. Point N of tile k is therefore point 0 of tile k+1, displaced by the tile
 * vector (tileWidth, -tileRise). Drawing the series at k = -1, 0, 1 and
 * translating the camera by (frame/840) * tileVector closes the loop exactly:
 * frame 0 and frame 840 land on identical geometry.
 *
 * Because the seam is expressed in *steps* rather than positions, there is no
 * slope kink there either — step[N-1] -> step[0] is statistically the same
 * hand-off as any other pair of neighbours.
 */
export type Series = {
  /** number of steps; there are n+1 drawn points per tile (0..n inclusive) */
  n: number;
  /** horizontal world distance between consecutive points */
  dx: number;
  tileWidth: number;
  tileRise: number;
  /** world y of the main series, canvas-down (negative = up the screen) */
  main: Float64Array;
  /** world y of the moving-average companion line */
  ma: Float64Array;
};

const N = 400;
const TILE_WIDTH = 5040; // world px per loop — camera covers exactly this in 840 frames
const TILE_RISE = 1260; // the climb, world px per tile (~14deg, +8deg of tilt on top)
const AMP = 152; // RMS residual excursion around the trend, world px
const HF_AMP = 11; // per-tick jitter laid on top of the walk, world px

/** Circular (wrap-around) centred moving average over a periodic array. */
const circMA = (src: Float64Array, n: number, w: number): Float64Array => {
  const out = new Float64Array(n);
  const half = Math.floor(w / 2);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) {
      sum += src[(((i + k) % n) + n) % n];
    }
    out[i] = sum / (half * 2 + 1);
  }
  return out;
};

export const buildSeries = (): Series => {
  const steps = new Float64Array(N);

  // ---- trending runs -------------------------------------------------------
  // Pure unbiased noise reads flat and characterless. Biasing the step
  // direction over runs of 30-70 points is what produces the recognisable
  // climb / pullback / consolidation structure of real market data.
  let i = 0;
  let run = 0;
  while (i < N) {
    const len = rndInt(`run-len-${run}`, 30, 70);
    const kind = rnd(`run-kind-${run}`);
    let drift: number;
    let vol: number;
    if (kind < 0.4) {
      // steady climb
      drift = rndRange(`run-d-${run}`, 0.8, 1.9);
      vol = rndRange(`run-v-${run}`, 0.55, 1.0);
    } else if (kind < 0.64) {
      // pullback
      drift = rndRange(`run-d-${run}`, -1.7, -0.6);
      vol = rndRange(`run-v-${run}`, 0.7, 1.25);
    } else if (kind < 0.86) {
      // consolidation — flat and choppy
      drift = rndRange(`run-d-${run}`, -0.14, 0.14);
      vol = rndRange(`run-v-${run}`, 0.85, 1.45);
    } else {
      // impulse leg
      drift = rndRange(`run-d-${run}`, 2.1, 3.3);
      vol = rndRange(`run-v-${run}`, 0.4, 0.85);
    }
    for (let k = 0; k < len && i < N; k++, i++) {
      steps[i] = drift + (rnd(`tick-${i}`) * 2 - 1) * vol * 2.6;
    }
    run++;
  }

  // ---- force the steps to sum to zero so the series tiles ------------------
  let sum = 0;
  for (let k = 0; k < N; k++) sum += steps[k];
  const mean = sum / N;
  for (let k = 0; k < N; k++) steps[k] -= mean;

  // ---- integrate ----------------------------------------------------------
  const resid = new Float64Array(N + 1);
  for (let k = 0; k < N; k++) resid[k + 1] = resid[k] + steps[k];
  resid[N] = 0; // exact — kills any floating-point drift at the seam

  // ---- high-pass ----------------------------------------------------------
  // An integrated walk is dominated by its slowest component: one huge hump
  // that, once normalised, crushes everything else and leaves a featureless
  // monotone climb on screen. Subtracting a very long circular moving average
  // keeps only the structure at or below one screen width, which is exactly
  // the scale the run drifts wrote. The result tiles unchanged, because a
  // circular average of a periodic array is periodic.
  const slow = circMA(resid.subarray(0, N) as Float64Array, N, 161);
  const detr = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) detr[k] = resid[k] - slow[k % N];

  // Normalise on RMS, not on the peak: peak normalisation lets a single large
  // excursion crush the character out of the whole rest of the series.
  let ss = 0;
  for (let k = 0; k < N; k++) ss += detr[k] * detr[k];
  const rms = Math.sqrt(ss / N);
  const scale = rms > 0 ? AMP / rms : 1;

  // ---- spike-and-retrace punctuation --------------------------------------
  // One or two jagged peaks that shoot up and fall straight back. Added after
  // normalisation, in world px, so their size is authored rather than emergent
  // — and kept clear of the seam, so they never straddle the tile join.
  const spike = new Float64Array(N + 1);
  const spikeCount = rndInt('spike-count', 1, 2);
  for (let e = 0; e < spikeCount; e++) {
    const up = rndInt(`spike-up-${e}`, 5, 9);
    const down = rndInt(`spike-down-${e}`, 7, 13);
    const pos =
      rndInt(`spike-pos-${e}`, 20, N - up - down - 20);
    const height = rndRange(`spike-h-${e}`, 210, 340);
    for (let k = 1; k <= up; k++) {
      spike[pos + k] += height * (k / up) * rndRange(`spike-j-${e}-${k}`, 0.86, 1.06);
    }
    for (let k = 1; k <= down; k++) {
      spike[pos + up + k] +=
        height * (1 - k / down) * rndRange(`spike-r-${e}-${k}`, 0.88, 1.05);
    }
  }

  // ---- the moving-average companion ---------------------------------------
  // Smoothed twice: near-straight where the data trends, gently curved through
  // the consolidations — it reads as a trend line fitted to the series.
  const smooth = circMA(circMA(detr.subarray(0, N) as Float64Array, N, 61), N, 41);

  const main = new Float64Array(N + 1);
  const ma = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) {
    const ramp = -(k / N) * TILE_RISE;
    // A little un-integrated jitter on top of the walk. Integration alone is
    // dominated by low frequencies and reads too smooth; this is the tick-level
    // texture. Indexed by k % N so it tiles with everything else.
    const hf = (rnd(`hf-${k % N}`) * 2 - 1) * HF_AMP;
    main[k] = ramp - detr[k] * scale - hf - spike[k];
    ma[k] = ramp - smooth[k % N] * scale;
  }

  return {n: N, dx: TILE_WIDTH / N, tileWidth: TILE_WIDTH, tileRise: TILE_RISE, main, ma};
};
