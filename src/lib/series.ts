import {rnd, rndRange, rndInt} from './rand';
import {SeriesConfig} from './variants';

/**
 * The price series.
 *
 * It is authored as a *tiling* series: the walk is expressed as `n` steps whose
 * sum is exactly zero, so the residual at index n equals the residual at index
 * 0. Point n of tile k is therefore point 0 of tile k+1, displaced by the tile
 * vector (tileWidth, -tileRise). Drawing the series at k = -1, 0, 1 and
 * translating the camera by (frame/840) * tileVector closes the loop exactly:
 * frame 0 and frame 840 land on identical geometry.
 *
 * Because the seam is expressed in *steps* rather than positions, there is no
 * slope kink there either — step[n-1] -> step[0] is statistically the same
 * hand-off as any other pair of neighbours.
 *
 * `tileRise` is signed. Positive climbs up the screen, negative falls, and the
 * camera picks its direction up from the same number — so a bear market is a
 * different set of numbers rather than a different code path.
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

export const buildSeries = (cfg: SeriesConfig): Series => {
  const N = cfg.n;
  const steps = new Float64Array(N);

  // ---- trending runs -------------------------------------------------------
  // Pure unbiased noise reads flat and characterless. Biasing the step
  // direction over runs is what produces the recognisable structure of real
  // market data — long climbs and short pullbacks for the bull, short steep
  // drops and long failing recoveries for the bear.
  let i = 0;
  let run = 0;
  const kinds = cfg.runKinds;
  while (i < N) {
    const roll = rnd(`run-kind-${run}`);
    const kind = kinds.find((k) => roll < k.upto) ?? kinds[kinds.length - 1];
    const len = rndInt(`run-len-${run}`, kind.len[0], kind.len[1]);
    const drift = rndRange(`run-d-${run}`, kind.drift[0], kind.drift[1]);
    const vol = rndRange(`run-v-${run}`, kind.vol[0], kind.vol[1]);
    for (let k = 0; k < len && i < N; k++, i++) {
      steps[i] = drift + (rnd(`tick-${i}`) * 2 - 1) * vol * cfg.tickVol;
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
  // monotone slope on screen. Subtracting a very long circular moving average
  // keeps only the structure at or below one screen width, which is exactly
  // the scale the run drifts wrote. The result tiles unchanged, because a
  // circular average of a periodic array is periodic.
  const slow = circMA(resid.subarray(0, N) as Float64Array, N, cfg.hpWindow);
  const detr = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) detr[k] = resid[k] - slow[k % N];

  // Normalise on RMS, not on the peak: peak normalisation lets a single large
  // excursion crush the character out of the whole rest of the series.
  let ss = 0;
  for (let k = 0; k < N; k++) ss += detr[k] * detr[k];
  const rms = Math.sqrt(ss / N);
  const scale = rms > 0 ? cfg.amp / rms : 1;

  // ---- punctuation --------------------------------------------------------
  // Events are additive offsets in canvas-y world px, positive = down the
  // screen. Applied after normalisation so their size is authored rather than
  // emergent, and every one of them starts and ends at exactly zero, so the
  // tile join is untouched no matter what happens in between.
  const offset = new Float64Array(N + 1);

  // Spike-and-retrace: one or two jagged peaks that shoot up and fall back.
  if (cfg.spikes) {
    const sp = cfg.spikes;
    const spikeCount = rndInt('spike-count', sp.count[0], sp.count[1]);
    for (let e = 0; e < spikeCount; e++) {
      const up = rndInt(`spike-up-${e}`, sp.up[0], sp.up[1]);
      const down = rndInt(`spike-down-${e}`, sp.down[0], sp.down[1]);
      const pos = rndInt(`spike-pos-${e}`, 20, N - up - down - 20);
      const height = rndRange(`spike-h-${e}`, sp.height[0], sp.height[1]);
      for (let k = 1; k <= up; k++) {
        offset[pos + k] -= height * (k / up) * rndRange(`spike-j-${e}-${k}`, 0.86, 1.06);
      }
      for (let k = 1; k <= down; k++) {
        offset[pos + up + k] -=
          height * (1 - k / down) * rndRange(`spike-r-${e}-${k}`, 0.88, 1.05);
      }
    }
  }

  // Failed rallies: a climb that recovers part of a prior decline, decelerating
  // as it loses steam, then rolls over and accelerates back down. These are
  // what make a decline read as a decline rather than a downhill slope.
  if (cfg.failedRallies) {
    const fr = cfg.failedRallies;
    fr.at.forEach((frac, e) => {
      const pos =
        Math.round(frac * N) + rndInt(`rally-pos-${e}`, -fr.jitter, fr.jitter);
      const up = rndInt(`rally-up-${e}`, fr.up[0], fr.up[1]);
      const down = rndInt(`rally-down-${e}`, fr.down[0], fr.down[1]);
      const height = rndRange(`rally-h-${e}`, fr.height[0], fr.height[1]);
      for (let k = 1; k <= up; k++) {
        const f = k / up;
        const j = k === up ? 1 : rndRange(`rally-ju-${e}-${k}`, 0.94, 1.05);
        offset[pos + k] -= height * (1 - (1 - f) * (1 - f)) * j;
      }
      for (let k = 1; k <= down; k++) {
        const f = k / down;
        const j = k === down ? 1 : rndRange(`rally-jd-${e}-${k}`, 0.94, 1.05);
        offset[pos + up + k] -= height * (1 - f * f) * j;
      }
    });
  }

  // Capitulation: a near-vertical collapse — an order of magnitude steeper than
  // any run — then a dead-cat bounce, then a long flat base that relaxes the
  // offset back to zero by the end of the tile. Because the trend is falling
  // underneath it, that relaxation reads as a market going sideways after the
  // flush rather than as a recovery.
  if (cfg.capitulation) {
    const cp = cfg.capitulation;
    const pos = Math.round(cp.at * N) + rndInt('cap-pos', -cp.jitter, cp.jitter);
    const drop = rndInt('cap-drop', cp.drop[0], cp.drop[1]);
    const depth = rndRange('cap-depth', cp.depth[0], cp.depth[1]);
    const bounceLen = rndInt('cap-bounce-len', cp.bounceLen[0], cp.bounceLen[1]);
    const bounceTo =
      depth * (1 - rndRange('cap-bounce-frac', cp.bounceFrac[0], cp.bounceFrac[1]));

    for (let k = 1; k <= drop; k++) {
      const j = k === drop ? 1 : rndRange(`cap-j-${k}`, 0.9, 1.07);
      offset[pos + k] += depth * (k / drop) * j;
    }
    for (let k = 1; k <= bounceLen; k++) {
      const f = k / bounceLen;
      const j = k === bounceLen ? 1 : rndRange(`cap-b-${k}`, 0.9, 1.08);
      offset[pos + drop + k] += depth + (bounceTo - depth) * f * j;
    }
    const baseStart = pos + drop + bounceLen;
    const baseLen = N - baseStart;
    for (let k = 1; k <= baseLen; k++) {
      offset[baseStart + k] += bounceTo * (1 - k / baseLen);
    }
  }

  // ---- the moving-average companion ---------------------------------------
  // Smoothed twice: near-straight where the data trends, gently curved through
  // the consolidations — it reads as a trend line fitted to the series.
  const smooth = circMA(
    circMA(detr.subarray(0, N) as Float64Array, N, cfg.maSmooth[0]),
    N,
    cfg.maSmooth[1],
  );

  // A bear market spends its life below its own average. `maBias` lifts the
  // average clear of the price, relaxing to a crossing near the start of the
  // loop — a periodic bump, so the two lines cross once on the way in and the
  // offset closes at the seam.
  const sigma = cfg.maBiasSigma;
  const maBiasAt = (k: number): number => {
    const x = k / N;
    const d = Math.min(x, 1 - x); // circular distance to the loop point
    return cfg.maBias * (1 - 1.4 * Math.exp(-(d * d) / (2 * sigma * sigma)));
  };

  const main = new Float64Array(N + 1);
  const ma = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) {
    const ramp = -(k / N) * cfg.tileRise;
    // A little un-integrated jitter on top of the walk. Integration alone is
    // dominated by low frequencies and reads too smooth; this is the tick-level
    // texture. Indexed by k % N so it tiles with everything else.
    const hf = (rnd(`hf-${k % N}`) * 2 - 1) * cfg.hfAmp;
    main[k] = ramp - detr[k] * scale - hf + offset[k];
    ma[k] = ramp - smooth[k % N] * scale + maBiasAt(k);
  }

  return {
    n: N,
    dx: cfg.tileWidth / N,
    tileWidth: cfg.tileWidth,
    tileRise: cfg.tileRise,
    main,
    ma,
  };
};
