import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BASE_LEVEL,
  BLOOM_BLUR_PX,
  BLOOM_DOWNSCALE,
  BLOOM_OPACITY,
  BLOOM_PULSE_THRESHOLD,
  BUCKETS,
  CLUSTER_DRIFT_X,
  CLUSTER_DRIFT_Y,
  CLUSTER_FREQ_X,
  CLUSTER_FREQ_Y,
  CLUSTER_GAIN,
  CLUSTER_GAIN_EXP,
  CLUSTER_GAIN_MIN,
  CLUSTER_KNEE_HI,
  CLUSTER_KNEE_LO,
  CLUSTER_NOISE_PERIOD,
  COLS,
  DOT_GAIN_MAX,
  DOT_GAIN_MIN,
  DURATION_IN_FRAMES,
  GLOW_CX,
  GLOW_CY,
  GLOW_DRIFT_X,
  GLOW_DRIFT_Y,
  GLOW_FALLOFF,
  GLOW_GAIN,
  GLOW_RADIUS_X,
  GLOW_RADIUS_Y,
  GRAIN_TILE_COUNT,
  HAZE_OPACITY,
  HEIGHT,
  HOT_DUTY,
  HOT_ELIGIBLE_FRACTION,
  HOT_GATE_HI,
  HOT_GATE_LO,
  HOT_PERIODS,
  HOT_STRENGTH,
  PITCH,
  ROWS,
  SHIMMER_DEPTH,
  SHIMMER_PERIODS,
  SIZE_LADDER,
  WIDTH,
  assertWholePixelGrid,
  insetForSize,
} from "./constants";
import { clamp01, hash01, loopNoise3, smoothstep } from "./noise";
import { PALETTES, buildRamp, parseHex } from "./palettes";
import { GRAIN_DRAW_SCALE, buildGrainTiles } from "./grain";

export const dotMatrixWallSchema = z.object({
  variant: z.enum(["blue", "amber", "mono"]),
});

export type DotMatrixWallProps = z.infer<typeof dotMatrixWallSchema>;

// Checked at import time: fails the render rather than silently shipping a
// grid whose pitch does not land on whole pixels, which shimmers.
assertWholePixelGrid();

const DOT_COUNT = COLS * ROWS;
const TWO_PI = Math.PI * 2;

const BLOOM_W = WIDTH / BLOOM_DOWNSCALE;
const BLOOM_H = HEIGHT / BLOOM_DOWNSCALE;

/**
 * Bucket -> dot size and cell inset, resolved once.
 *
 * Deliberately not linear. Most dots live in the lower third of the ramp, so a
 * linear map parks nearly everything on the smallest size and the size
 * variation — the thing that makes this read as a panel with varying drive
 * current rather than a grid of identical squares — never becomes visible. The
 * 0.7 exponent spreads the ladder across the range where the dots actually are.
 */
const SIZE_FOR_BUCKET = new Int32Array(BUCKETS);
const INSET_FOR_BUCKET = new Int32Array(BUCKETS);
for (let b = 0; b < BUCKETS; b++) {
  const step = Math.min(
    SIZE_LADDER.length - 1,
    Math.floor((b / BUCKETS) ** 0.7 * SIZE_LADDER.length),
  );
  SIZE_FOR_BUCKET[b] = SIZE_LADDER[step];
  INSET_FOR_BUCKET[b] = insetForSize(SIZE_LADDER[step]);
}

/** Per-dot identity: fixed for the life of the composition. */
type DotTable = {
  /** Multiplies the always-on ambient level (base + glow). */
  gain: Float32Array;
  /** Multiplies the cluster contribution. Deliberately a separate draw. */
  clusterGain: Float32Array;
  shimmerPeriod: Float32Array;
  shimmerPhase: Float32Array;
  /** 0 means "never goes hot". */
  hotPeriod: Uint16Array;
  hotPhase: Uint16Array;
};

const buildDotTable = (): DotTable => {
  const gain = new Float32Array(DOT_COUNT);
  const clusterGain = new Float32Array(DOT_COUNT);
  const shimmerPeriod = new Float32Array(DOT_COUNT);
  const shimmerPhase = new Float32Array(DOT_COUNT);
  const hotPeriod = new Uint16Array(DOT_COUNT);
  const hotPhase = new Uint16Array(DOT_COUNT);

  for (let i = 0; i < DOT_COUNT; i++) {
    const col = i % COLS;
    const row = (i / COLS) | 0;

    // Two separate per-dot gains, because the ambient level and the cluster
    // patches want opposite distributions. The ambient gain is skewed hard to
    // the dim end so the unlit field stays a sea of near-invisible specks; the
    // cluster gain is only mildly skewed so that when a patch moves over a dot
    // it actually lights up. Sharing one hard-skewed gain (which is what this
    // did first) leaves the patches as dim as the field and the frame never
    // gets a bright population at all.
    const g = hash01(col, row, 1) ** 1.9;
    gain[i] = DOT_GAIN_MIN + (DOT_GAIN_MAX - DOT_GAIN_MIN) * g;
    clusterGain[i] =
      CLUSTER_GAIN_MIN +
      (1 - CLUSTER_GAIN_MIN) * hash01(col, row, 17) ** CLUSTER_GAIN_EXP;

    shimmerPeriod[i] =
      SHIMMER_PERIODS[
        Math.floor(hash01(col, row, 3) * SHIMMER_PERIODS.length) %
          SHIMMER_PERIODS.length
      ];
    shimmerPhase[i] = hash01(col, row, 5);

    if (hash01(col, row, 7) < HOT_ELIGIBLE_FRACTION) {
      const period =
        HOT_PERIODS[
          Math.floor(hash01(col, row, 11) * HOT_PERIODS.length) %
            HOT_PERIODS.length
        ];
      hotPeriod[i] = period;
      hotPhase[i] = Math.floor(hash01(col, row, 13) * period);
    }
  }

  return {
    gain,
    clusterGain,
    shimmerPeriod,
    shimmerPhase,
    hotPeriod,
    hotPhase,
  };
};

/**
 * LED dot matrix wall: a fixed grid of square dots over a slow-drifting glow.
 *
 * The grid itself never moves, scales or rotates — all of the life comes from
 * which dots are lit and how brightly. Everything is a pure function of
 * useCurrentFrame(), and every periodic term has a period that divides
 * DURATION_IN_FRAMES, so the 600-frame loop is seamless.
 */
export const DotMatrixWall: React.FC<DotMatrixWallProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const palette = PALETTES[variant];

  const ramp = useMemo(() => buildRamp(palette), [palette]);
  const hazeRgb = useMemo(() => parseHex(palette.haze), [palette.haze]);
  const dots = useMemo(() => buildDotTable(), []);
  const grainTiles = useMemo(() => buildGrainTiles(), []);

  // Scratch buffers, allocated once. Allocating these per frame would dominate
  // the frame time and thrash GC across Remotion's render threads.
  const scratch = useMemo(
    () => ({
      bucketOf: new Uint8Array(DOT_COUNT),
      hotNow: new Uint8Array(DOT_COUNT),
      counts: new Int32Array(BUCKETS),
      cursor: new Int32Array(BUCKETS),
      order: new Int32Array(DOT_COUNT),
    }),
    [],
  );

  const hazeRef = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const hazeCtx = hazeRef.current?.getContext("2d");
    const bloomCtx = bloomRef.current?.getContext("2d");
    const dotsCtx = dotsRef.current?.getContext("2d");
    const grainCtx = grainRef.current?.getContext("2d");
    if (!hazeCtx || !bloomCtx || !dotsCtx || !grainCtx) return;

    const tNorm = frame / DURATION_IN_FRAMES;
    const theta = TWO_PI * tNorm;
    const sinT = Math.sin(theta);
    // (1 - cos) / 2 runs 0 -> 1 -> 0 across the loop, so pairing it with sin
    // traces a closed path that returns exactly to its start at frame 600.
    const cosT = (1 - Math.cos(theta)) / 2;

    const glowCx = GLOW_CX + GLOW_DRIFT_X * sinT;
    const glowCy = GLOW_CY + GLOW_DRIFT_Y * cosT;

    const clusterDx = CLUSTER_DRIFT_X * sinT;
    const clusterDy = CLUSTER_DRIFT_Y * cosT;
    const clusterZ = tNorm * CLUSTER_NOISE_PERIOD;
    const clusterZ2 = tNorm * CLUSTER_NOISE_PERIOD * 2;

    // -- Layer 2: the broad glow, painted as the haze behind the grid --------
    //
    // Built from the same exp() falloff the dots sample, so the haze and the
    // dot brightness read as one light source rather than two.
    hazeCtx.clearRect(0, 0, WIDTH, HEIGHT);
    hazeCtx.save();
    hazeCtx.translate(glowCx * WIDTH, glowCy * HEIGHT);
    hazeCtx.scale(WIDTH * GLOW_RADIUS_X, HEIGHT * GLOW_RADIUS_Y);
    const hazeR = 1.7; // in the scaled space: comfortably past every corner
    const grad = hazeCtx.createRadialGradient(0, 0, 0, 0, 0, hazeR);
    const [hr, hg, hb] = hazeRgb;
    for (let s = 0; s <= 24; s++) {
      const t = s / 24;
      const d = t * hazeR;
      const a =
        Math.exp(-d * d * GLOW_FALLOFF) * palette.hazeAlpha * HAZE_OPACITY;
      grad.addColorStop(t, `rgba(${hr},${hg},${hb},${a})`);
    }
    hazeCtx.fillStyle = grad;
    hazeCtx.fillRect(-hazeR, -hazeR, hazeR * 2, hazeR * 2);
    hazeCtx.restore();

    // -- Layers 1/3/4: per-dot brightness ------------------------------------
    const { bucketOf, hotNow, counts, cursor, order } = scratch;
    counts.fill(0);
    hotNow.fill(0);

    for (let i = 0; i < DOT_COUNT; i++) {
      const col = i % COLS;
      const row = (i / COLS) | 0;
      const u = (col + 0.5) / COLS;
      const v = (row + 0.5) / ROWS;

      // Broad glow: dots inherit brightness from the light mass, which is what
      // makes this read as a lit panel and not scattered pixels.
      const ex = (u - glowCx) / GLOW_RADIUS_X;
      const ey = (v - glowCy) / GLOW_RADIUS_Y;
      const glow = Math.exp(-(ex * ex + ey * ey) * GLOW_FALLOFF);

      // Cluster patches: two octaves of looping noise, then a soft knee so
      // only the top of the field lights and the patches pool into clumps.
      const nx = u * CLUSTER_FREQ_X + clusterDx;
      const ny = v * CLUSTER_FREQ_Y + clusterDy;
      const n =
        loopNoise3(nx, ny, clusterZ, CLUSTER_NOISE_PERIOD) * 0.68 +
        loopNoise3(
          nx * 2.1 + 11.3,
          ny * 2.1 + 7.7,
          clusterZ2,
          CLUSTER_NOISE_PERIOD * 2,
        ) *
          0.32;
      const cluster = smoothstep(CLUSTER_KNEE_LO, CLUSTER_KNEE_HI, n);

      const shimmer =
        1 -
        SHIMMER_DEPTH *
          0.5 *
          (1 +
            Math.sin(
              TWO_PI * (frame / dots.shimmerPeriod[i] + dots.shimmerPhase[i]),
            ));

      let b =
        ((BASE_LEVEL + GLOW_GAIN * glow) * dots.gain[i] +
          CLUSTER_GAIN * cluster * dots.clusterGain[i]) *
        shimmer;

      // Hot dots: sparse, near-white, individually flickering on staggered
      // short cycles. Gated by the lit regions so they pool with the clusters
      // instead of sparkling in the dark corners.
      const hotPeriod = dots.hotPeriod[i];
      if (hotPeriod > 0) {
        const p = ((frame + dots.hotPhase[i]) % hotPeriod) / hotPeriod;
        if (p < HOT_DUTY) {
          const env = Math.sin((Math.PI * p) / HOT_DUTY) ** 1.7;
          const gate = smoothstep(HOT_GATE_LO, HOT_GATE_HI, glow + cluster);
          const pulse = env * gate;
          b += HOT_STRENGTH * pulse;
          if (pulse > BLOOM_PULSE_THRESHOLD) hotNow[i] = 1;
        }
      }

      const bucket = Math.min(BUCKETS - 1, (clamp01(b) * BUCKETS) | 0);
      bucketOf[i] = bucket;
      counts[bucket]++;
    }

    // Counting sort into bucket-contiguous order, so the draw loop can set
    // fillStyle once per bucket. At ~9200 dots the fillRects are cheap but a
    // per-dot style change is not.
    let running = 0;
    for (let b = 0; b < BUCKETS; b++) {
      cursor[b] = running;
      running += counts[b];
    }
    for (let i = 0; i < DOT_COUNT; i++) {
      order[cursor[bucketOf[i]]++] = i;
    }

    dotsCtx.clearRect(0, 0, WIDTH, HEIGHT);
    bloomCtx.clearRect(0, 0, BLOOM_W, BLOOM_H);
    bloomCtx.globalCompositeOperation = "lighter";

    let start = 0;
    for (let b = 0; b < BUCKETS; b++) {
      const count = counts[b];
      if (count === 0) continue;

      const size = SIZE_FOR_BUCKET[b];
      const inset = INSET_FOR_BUCKET[b];
      dotsCtx.fillStyle = ramp[b];
      bloomCtx.fillStyle = ramp[b];

      for (let k = start; k < start + count; k++) {
        const i = order[k];
        const x = (i % COLS) * PITCH + inset;
        const y = ((i / COLS) | 0) * PITCH + inset;
        dotsCtx.fillRect(x, y, size, size);

        if (hotNow[i] === 1) {
          bloomCtx.fillRect(
            x / BLOOM_DOWNSCALE,
            y / BLOOM_DOWNSCALE,
            size / BLOOM_DOWNSCALE,
            size / BLOOM_DOWNSCALE,
          );
        }
      }
      start += count;
    }
    bloomCtx.globalCompositeOperation = "source-over";

    // -- Grain ---------------------------------------------------------------
    grainCtx.clearRect(0, 0, WIDTH, HEIGHT);
    if (grainTiles) {
      const tile = grainTiles[frame % GRAIN_TILE_COUNT];
      const pattern = grainCtx.createPattern(tile, "repeat");
      if (pattern) {
        grainCtx.save();
        grainCtx.scale(GRAIN_DRAW_SCALE, GRAIN_DRAW_SCALE);
        grainCtx.fillStyle = pattern;
        grainCtx.fillRect(
          0,
          0,
          WIDTH / GRAIN_DRAW_SCALE,
          HEIGHT / GRAIN_DRAW_SCALE,
        );
        grainCtx.restore();
      }
    }
  }, [frame, ramp, hazeRgb, dots, grainTiles, scratch, palette.hazeAlpha]);

  const fill: React.CSSProperties = { position: "absolute", inset: 0 };

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <canvas ref={hazeRef} width={WIDTH} height={HEIGHT} style={fill} />
      {/* Bloom lives on its own low-res, blurred canvas and carries only the
          hot dots. Blurring the whole grid would merge neighbouring dots and
          destroy the panel read, which is the entire subject. */}
      <canvas
        ref={bloomRef}
        width={BLOOM_W}
        height={BLOOM_H}
        style={{
          ...fill,
          width: "100%",
          height: "100%",
          filter: `blur(${BLOOM_BLUR_PX}px)`,
          opacity: BLOOM_OPACITY,
          mixBlendMode: "screen",
        }}
      />
      {/* Screen-blended so the dots always ADD light: a dim dot over the bright
          part of the haze washes into it instead of punching a dark square. */}
      <canvas
        ref={dotsRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ ...fill, mixBlendMode: "screen" }}
      />
      <canvas
        ref={grainRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ ...fill, mixBlendMode: "screen" }}
      />
    </AbsoluteFill>
  );
};
