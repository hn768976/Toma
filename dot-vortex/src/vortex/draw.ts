// Per-frame canvas draw. Pure function of (frame, size, palette) — no
// state carried between frames.

import {
  BREATHE_AMOUNT,
  BRIGHTNESS_BUCKETS,
  BRIGHTNESS_CUTOFF,
  BRIGHTNESS_GAMMA,
  CENTER_X_FRACTION,
  CENTER_Y_FRACTION,
  GRAIN_OFFSET_CYCLE,
  GRAIN_STRENGTH,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  NOISE_WEIGHT,
  PULSE_WAVES,
  PULSE_WEIGHT,
  REFERENCE_HEIGHT,
  SEED_GRAIN,
  SPARKLE_FADE,
  SPARKLE_SIZE,
  SWEEP_LOBES,
  SWEEP_WEIGHT,
  TAU,
  TWINKLE_PERIODS,
  type Palette,
} from "./constants";
import { brightnessField, jitterField, sparkleField, twinkleField } from "./fields";
import { LAYOUT } from "./layout";
import { mulberry32 } from "./random";
import { getBackgroundLift, getGrainTiles, getSparkleSprite } from "./sprites";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep01 = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

// --- Colour ramp ---------------------------------------------------------
// Brightness is quantised into buckets so the whole field can be drawn
// with one fillStyle change per bucket instead of one per dot.
const rampCache = new Map<string, string[]>();

const getBucketColors = (palette: Palette): string[] => {
  const key = `${palette.stops.map((s) => s.join(",")).join("|")}@${palette.rampBias}`;
  const cached = rampCache.get(key);
  if (cached) {
    return cached;
  }
  const stops = palette.stops;
  const colors: string[] = [];
  for (let b = 0; b < BRIGHTNESS_BUCKETS; b++) {
    const t = (b + 0.5) / BRIGHTNESS_BUCKETS;
    // Colour climbs the ramp faster than alpha does, so a mid-brightness
    // dot already reads as gold rather than as dim bronze.
    const scaled = Math.pow(t, palette.rampBias) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(scaled));
    const f = scaled - i;
    const r = Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f);
    const g = Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f);
    const bl = Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f);
    // Alpha carries brightness too: under additive compositing the dot
    // contributes alpha * colour, so the dimmest dots stay genuinely dim
    // without crushing their hue.
    // Near-zero at the bottom of the ramp, so a dot crossing the
    // brightness cutoff fades in rather than popping.
    const alpha = 0.06 + 0.94 * Math.pow(t, 0.42);
    colors.push(`rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(4)})`);
  }
  rampCache.set(key, colors);
  return colors;
};

// --- Scratch buffers -----------------------------------------------------
// Allocated once and reused; re-allocating ~35k-entry arrays 300 times
// would just feed the garbage collector.
const N = LAYOUT.count;
const dotX = new Float32Array(N);
const dotY = new Float32Array(N);
const dotS = new Float32Array(N);
const dotBucket = new Int32Array(N);
const bucketCounts = new Int32Array(BRIGHTNESS_BUCKETS);
const bucketOffsets = new Int32Array(BRIGHTNESS_BUCKETS);
const bucketCursor = new Int32Array(BRIGHTNESS_BUCKETS);
const order = new Int32Array(N);
const sparkX = new Float32Array(N);
const sparkY = new Float32Array(N);
const sparkS = new Float32Array(N);
const sparkA = new Float32Array(N);

export type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  frame: number;
  width: number;
  height: number;
  durationInFrames: number;
  palette: Palette;
};

export const drawVortex = ({
  ctx,
  frame,
  width,
  height,
  durationInFrames,
  palette,
}: DrawArgs) => {
  // Normalised loop time. Frame `durationInFrames` would be frame 0
  // again, which is exactly what every periodic term below assumes.
  const tt = frame / durationInFrames;
  const breathe = 1 + BREATHE_AMOUNT * Math.sin(TAU * tt);
  const cx = width * CENTER_X_FRACTION;
  const cy = height * CENTER_Y_FRACTION;
  const pxScale = height / REFERENCE_HEIGHT;
  const sparkleSpan = SPARKLE_SIZE * height;

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  // Very faint lift under the densest part of the disc.
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = getBackgroundLift(ctx, palette, cx, cy, height);
  ctx.fillRect(0, 0, width, height);

  bucketCounts.fill(0);
  let visible = 0;
  let sparkles = 0;

  const {
    angle,
    radius,
    radiusNorm,
    rotation,
    size,
    fade,
    jitter,
    sparkleThreshold,
  } = LAYOUT;

  for (let i = 0; i < N; i++) {
    const rn = radiusNorm[i];
    // The dot's current world angle. Each ring turns at its own rate.
    const theta = angle[i] + rotation[i] * tt;

    // Sub-pixel angular jitter, read from a frame-fixed field so it does
    // not break the loop (see layout.ts).
    const jitterOffset =
      (jitterField.sample(rn, theta) - 0.5) * 2 * jitter[i];
    const drawTheta = theta + jitterOffset;

    const r = radius[i] * breathe * height;
    const x = cx + Math.cos(drawTheta) * r;
    const y = cy + Math.sin(drawTheta) * r;
    if (x < -16 || x > width + 16 || y < -16 || y > height + 16) {
      continue;
    }

    // Clustered base brightness, plus a slow angular sweep and an
    // outward radial pulse. Both animated terms run exactly one cycle
    // per loop, so they are seamless by construction.
    // The fbm concentrates around 0.5; expand it so the patches read as
    // genuinely brighter sectors rather than a flat field.
    const noise = clamp01((brightnessField.sample(rn, theta) - 0.5) * 2.8 + 0.5);
    const sweep = 0.5 + 0.5 * Math.cos(SWEEP_LOBES * theta - TAU * tt);
    const pulse = 0.5 + 0.5 * Math.cos(PULSE_WAVES * TAU * rn - TAU * tt);
    const raw =
      noise * NOISE_WEIGHT + sweep * SWEEP_WEIGHT + pulse * PULSE_WEIGHT;
    const bright = Math.pow(clamp01(raw), BRIGHTNESS_GAMMA) * fade[i];
    if (bright < BRIGHTNESS_CUTOFF) {
      continue;
    }
    // Renormalise the surviving range over the whole ramp.
    const level = (bright - BRIGHTNESS_CUTOFF) / (1 - BRIGHTNESS_CUTOFF);

    const bucket = Math.min(
      BRIGHTNESS_BUCKETS - 1,
      (level * BRIGHTNESS_BUCKETS) | 0,
    );
    // Brighter dots also read bigger, as they do in the reference. The
    // radial profile still sets the ceiling, so sizes stay within the
    // 1-4px-at-2160p range.
    const side = (1 + (size[i] - 1) * (0.55 + 0.45 * level)) * pxScale;
    dotX[visible] = x - side / 2;
    dotY[visible] = y - side / 2;
    dotS[visible] = side;
    dotBucket[visible] = bucket;
    bucketCounts[bucket]++;
    visible++;

    // Sparkles: the sparse 2-3% of dots that carry a 4-point cross.
    const spark = sparkleField.sample(rn, theta);
    if (spark > sparkleThreshold) {
      const mask = smoothstep01((spark - sparkleThreshold) / SPARKLE_FADE);
      const tw = twinkleField.sample(rn, theta);
      const phase = twinkleField.sample(rn, theta + 2.4);
      // Two staggered twinkle cycles, blended smoothly rather than
      // switched, so a dot drifting between them never pops.
      const mix = smoothstep01((tw - 0.35) / 0.3);
      const cycleA =
        0.5 + 0.5 * Math.cos(TAU * (frame / TWINKLE_PERIODS[0] + phase));
      const cycleB =
        0.5 + 0.5 * Math.cos(TAU * (frame / TWINKLE_PERIODS[1] + phase));
      const twinkle = cycleA * (1 - mix) + cycleB * mix;
      const alpha = mask * (0.6 + 0.4 * level) * (0.4 + 0.6 * twinkle);
      if (alpha > 0.01) {
        const span = sparkleSpan * (0.6 + 0.7 * level);
        sparkX[sparkles] = x - span / 2;
        sparkY[sparkles] = y - span / 2;
        sparkS[sparkles] = span;
        sparkA[sparkles] = Math.min(1, alpha);
        sparkles++;
      }
    }
  }

  // Counting sort into bucket order, so each fillStyle is set once.
  let running = 0;
  for (let b = 0; b < BRIGHTNESS_BUCKETS; b++) {
    bucketOffsets[b] = running;
    bucketCursor[b] = running;
    running += bucketCounts[b];
  }
  for (let i = 0; i < visible; i++) {
    order[bucketCursor[dotBucket[i]]++] = i;
  }

  // Additive compositing, so overlapping dots build brightness.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  const colors = getBucketColors(palette);
  for (let b = 0; b < BRIGHTNESS_BUCKETS; b++) {
    const count = bucketCounts[b];
    if (count === 0) {
      continue;
    }
    ctx.fillStyle = colors[b];
    const start = bucketOffsets[b];
    for (let k = start; k < start + count; k++) {
      const i = order[k];
      ctx.fillRect(dotX[i], dotY[i], dotS[i], dotS[i]);
    }
  }

  // Sparkle crosses last, from the cached sprite.
  const sprite = getSparkleSprite(palette.sparkle);
  for (let s = 0; s < sparkles; s++) {
    ctx.globalAlpha = sparkA[s];
    ctx.drawImage(sprite, sparkX[s], sparkY[s], sparkS[s], sparkS[s]);
  }
  ctx.globalAlpha = 1;

  drawGrain(ctx, frame, width, height);

  ctx.globalCompositeOperation = "source-over";
};

const drawGrain = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
) => {
  const tiles = getGrainTiles();
  const tile = tiles[frame % GRAIN_TILE_COUNT];
  // Tile choice and offset run on co-prime cycles (12 and 25) so the
  // grain never repeats inside the 300-frame loop, but does at its end.
  const rand = mulberry32(SEED_GRAIN + (frame % GRAIN_OFFSET_CYCLE) * 131);
  const offsetX = Math.floor(rand() * GRAIN_TILE_SIZE);
  const offsetY = Math.floor(rand() * GRAIN_TILE_SIZE);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = GRAIN_STRENGTH;
  for (let y = -offsetY; y < height; y += GRAIN_TILE_SIZE) {
    for (let x = -offsetX; x < width; x += GRAIN_TILE_SIZE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.globalAlpha = 1;
};
