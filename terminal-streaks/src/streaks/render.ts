/**
 * The frame pipeline. Pure: given a frame number it rebuilds everything from
 * scratch, including the trail, so Remotion can render frames out of order on
 * any number of threads and still get an identical result.
 */

import { backgroundAt, rgbCss, tintAt, type Variant } from "./palette";
import { SQUASH, getSurfaces, type Surfaces } from "./page";
import {
  BANDS,
  TRAIL_STATES,
  bandBlur,
  rollBarCentre,
  rowJitter,
  scrollPx,
  trailWeights,
  type Layout,
} from "./motion";
import { clamp, hash2 } from "./random";

/**
 * Paint a vertical gradient into the 4px strip, then return it for stretching
 * across the frame.
 */
const gradientStrip = (
  s: Surfaces,
  height: number,
  stops: (v: number) => string,
  steps = 12,
) => {
  const ctx = s.strip.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "copy";
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (let i = 0; i <= steps; i++) g.addColorStop(i / steps, stops(i / steps));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s.strip.width, height);
  ctx.globalCompositeOperation = "source-over";
  return s.strip;
};

/** Patterns are cached per context: one per grain tile, not one per frame. */
const patternCache = new WeakMap<CanvasRenderingContext2D, Map<number, CanvasPattern>>();

const grainPattern = (ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement, key: number) => {
  let byTile = patternCache.get(ctx);
  if (!byTile) {
    byTile = new Map();
    patternCache.set(ctx, byTile);
  }
  const hit = byTile.get(key);
  if (hit) return hit;
  const pattern = ctx.createPattern(tile, "repeat")!;
  byTile.set(key, pattern);
  return pattern;
};

const wrapFrame = (frame: number, duration: number) =>
  ((frame % duration) + duration) % duration;

/** Sigma at or below which a band is blurred at full resolution. */
const SHARP_SIGMA = 0.0035;

/**
 * Offsets and weights approximating a gaussian of the given sigma with a
 * handful of shifted copies. Cheap, and every tap is a plain blit.
 */
const gaussianTaps = (sigma: number, count: number) => {
  const taps: { dx: number; w: number }[] = [];
  const spacing = (sigma * 5) / (count - 1); // reach +/- 2.5 sigma
  const half = (count - 1) / 2;
  let sum = 0;
  for (let i = -half; i <= half; i++) {
    const dx = i * spacing;
    const w = Math.exp(-(dx * dx) / (2 * sigma * sigma));
    taps.push({ dx, w });
    sum += w;
  }
  for (const t of taps) t.w /= sum;
  return taps;
};

/**
 * Trail: the last TRAIL_STATES frames' worth of horizontal jitter are
 * composited at decreasing weight. Older states are read with wrapped frame
 * numbers, so the accumulation is already settled at frame 0 and the loop has
 * no seam. Vertical scroll is taken from the current frame only — the trail
 * is purely horizontal, so the scroll itself stays crisp.
 */
const drawTrail = (
  smear: CanvasRenderingContext2D,
  s: Surfaces,
  frame: number,
  duration: number,
  layout: Layout,
) => {
  const { canvasWidth, rowHeight, rowsDrawn } = layout;
  const page = s.page;

  smear.setTransform(1, 0, 0, 1, 0, 0);
  smear.globalCompositeOperation = "source-over";
  smear.globalAlpha = 1;
  smear.fillStyle = "#000000";
  smear.fillRect(0, 0, canvasWidth, layout.height);
  smear.globalCompositeOperation = "lighter";

  const base = scrollPx(frame, duration, layout);
  const baseRounded = Math.round(base);

  // A screen-aligned strip straddles two content rows, so it has to be as
  // wide as the wider of the two. Empty strips are skipped outright.
  const strips: { sy: number; sh: number; w: number }[] = [];
  for (let j = 0; j < rowsDrawn; j++) {
    const sy = Math.round(base + j * rowHeight);
    const sh = Math.round(base + (j + 1) * rowHeight) - sy;
    const a = Math.floor(sy / rowHeight);
    const w = Math.max(
      s.rowWidths[a % s.rowWidths.length],
      s.rowWidths[(a + 1) % s.rowWidths.length],
    );
    strips.push({ sy, sh, w });
  }

  for (let i = TRAIL_STATES - 1; i >= 0; i--) {
    smear.globalAlpha = trailWeights[i];
    const f = frame - i;
    for (let j = 0; j < rowsDrawn; j++) {
      const strip = strips[j];
      if (strip.w === 0) continue;
      const dx = Math.round(rowJitter(j, f, duration, layout));
      smear.drawImage(
        page,
        0, strip.sy, strip.w, strip.sh,
        dx, strip.sy - baseRounded, strip.w, strip.sh,
      );
    }
  }
  smear.globalAlpha = 1;
  smear.globalCompositeOperation = "source-over";
};

/** Successive horizontal halvings of the smear buffer. */
const buildChain = (s: Surfaces, layout: Layout) => {
  let src: HTMLCanvasElement = s.smear;
  for (const step of s.chain) {
    const ctx = step.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.clearRect(0, 0, step.width, step.height);
    ctx.drawImage(src, 0, 0, src.width, layout.height, 0, 0, step.width, layout.height);
    src = step;
  }
};

/**
 * Directional blur, band by band. A horizontal-only blur is built from a few
 * shifted copies rather than a 2D filter: it is the right shape, it leaves
 * the vertical detail untouched, and it costs a handful of blits.
 *
 * Heavily smeared bands are blurred in the 8x-narrower buffer, where the taps
 * are eight times cheaper. Bands that are close to focus are blurred at full
 * resolution so their text stays readable.
 */
const drawBandBlur = (
  out: CanvasRenderingContext2D,
  s: Surfaces,
  frame: number,
  duration: number,
  layout: Layout,
) => {
  const { canvasWidth, height, rowHeight, width } = layout;
  const small = s.chain[s.chain.length - 1];
  const smallCtx = s.smallB.getContext("2d")!;
  const smallWidth = small.width;

  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalCompositeOperation = "source-over";
  out.globalAlpha = 1;
  out.fillStyle = "#000000";
  out.fillRect(0, 0, canvasWidth, height);
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = "low";

  for (let b = 0; b < BANDS.count; b++) {
    const y0 = Math.round(BANDS.starts[b] * rowHeight);
    const y1 = Math.min(height, Math.round(BANDS.ends[b] * rowHeight));
    if (y1 <= y0) continue;
    const bandHeight = y1 - y0;
    const sigma = bandBlur(b, frame, duration, layout);

    if (sigma <= SHARP_SIGMA * width) {
      // Full resolution: the band stays legible.
      const taps = gaussianTaps(sigma, 17);
      out.globalCompositeOperation = "lighter";
      for (const tap of taps) {
        out.globalAlpha = tap.w;
        out.drawImage(
          s.smear,
          0, y0, canvasWidth, bandHeight,
          tap.dx, y0, canvasWidth, bandHeight,
        );
      }
      out.globalAlpha = 1;
      out.globalCompositeOperation = "source-over";
      continue;
    }

    const sigmaSmall = sigma / SQUASH;
    const taps = gaussianTaps(sigmaSmall, 21);
    smallCtx.setTransform(1, 0, 0, 1, 0, 0);
    smallCtx.globalAlpha = 1;
    smallCtx.globalCompositeOperation = "source-over";
    smallCtx.clearRect(0, y0, smallWidth, bandHeight);
    smallCtx.globalCompositeOperation = "lighter";
    for (const tap of taps) {
      smallCtx.globalAlpha = tap.w;
      smallCtx.drawImage(
        small,
        0, y0, smallWidth, bandHeight,
        tap.dx, y0, smallWidth, bandHeight,
      );
    }
    smallCtx.globalAlpha = 1;
    smallCtx.globalCompositeOperation = "source-over";

    out.drawImage(
      s.smallB,
      0, y0, smallWidth, bandHeight,
      0, y0, canvasWidth, bandHeight,
    );
  }
};

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  duration: number,
  variant: Variant,
  layout: Layout,
) => {
  const s = getSurfaces(layout);
  const { width, height, canvasWidth, overscan } = layout;
  const f = wrapFrame(frame, duration);
  const t = f / duration;

  drawTrail(s.smear.getContext("2d")!, s, frame, duration, layout);
  buildChain(s, layout);

  const blurred = s.blurred.getContext("2d")!;
  drawBandBlur(blurred, s, frame, duration, layout);

  // Bloom: a very wide, very soft copy added back, so the brightest text
  // bleeds furthest. Built from the narrow buffer, which is already an
  // average of the frame, then stretched back over it.
  const small = s.chain[s.chain.length - 1];
  const bloom = s.bloom.getContext("2d")!;
  bloom.setTransform(1, 0, 0, 1, 0, 0);
  bloom.globalCompositeOperation = "source-over";
  bloom.globalAlpha = 1;
  bloom.imageSmoothingEnabled = true;
  bloom.imageSmoothingQuality = "low";
  bloom.clearRect(0, 0, s.bloom.width, s.bloom.height);
  bloom.drawImage(small, 0, 0, small.width, height, 0, 0, s.bloom.width, s.bloom.height);
  blurred.globalCompositeOperation = "lighter";
  blurred.globalAlpha = 0.3;
  blurred.imageSmoothingEnabled = true;
  blurred.imageSmoothingQuality = "low";
  blurred.drawImage(s.bloom, 0, 0, s.bloom.width, s.bloom.height, 0, 0, canvasWidth, height);
  blurred.globalAlpha = 1;

  // Tint the greyscale streaks. Multiply keeps the luminance structure, so
  // faint trails land on the dim end of the ramp on their own.
  const tint = gradientStrip(s, height, (v) => rgbCss(tintAt(variant, v, t)));
  blurred.globalCompositeOperation = "multiply";
  blurred.imageSmoothingEnabled = false;
  blurred.drawImage(tint, 0, 0, tint.width, height, 0, 0, canvasWidth, height);
  blurred.imageSmoothingEnabled = true;
  blurred.globalCompositeOperation = "source-over";

  /* ---------------------------------------------------------- composite */

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const bg = gradientStrip(s, height, (v) => rgbCss(backgroundAt(variant, v, t)));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bg, 0, 0, bg.width, height, 0, 0, width, height);
  ctx.imageSmoothingEnabled = true;

  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(s.blurred, -overscan, 0);

  // Roll bar: a soft bright band with a darker leading edge, one slow pass
  // down the frame per loop.
  const roll = rollBarCentre(t, height);
  const rollTint = tintAt(variant, clamp((roll.y + roll.h / 2) / height, 0, 1), t);
  const rollBright = gradientStrip(
    s,
    roll.h,
    (v) => rgbCss(rollTint, 0.075 * Math.sin(Math.PI * v)),
    8,
  );
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rollBright, 0, 0, rollBright.width, roll.h, 0, roll.y, width, roll.h);

  const edge = roll.h * 0.35;
  const rollEdge = gradientStrip(s, edge, (v) => `rgba(0, 0, 0, ${(0.16 * (1 - v)).toFixed(3)})`, 6);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(rollEdge, 0, 0, rollEdge.width, edge, 0, roll.y + roll.h, width, edge);
  ctx.imageSmoothingEnabled = true;

  // Grain. The tile is drawn at a fixed fraction of the frame so the preview
  // and the 4K render carry the same grain size.
  const grainScale = width / 1920;
  const tile = s.noise[f % s.noise.length];
  const ox = -Math.floor(hash2(f, 5, 91) * tile.width);
  const oy = -Math.floor(hash2(f, 6, 92) * tile.height);
  const grain = grainPattern(ctx, tile, f % s.noise.length);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.03;
  ctx.setTransform(grainScale, 0, 0, grainScale, ox * grainScale, oy * grainScale);
  ctx.fillStyle = grain;
  ctx.fillRect(-ox, -oy, width / grainScale, height / grainScale);
  ctx.restore();

  // Scanlines, vignette and corner darkening, baked into one overlay.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(s.overlay, 0, 0);
};
