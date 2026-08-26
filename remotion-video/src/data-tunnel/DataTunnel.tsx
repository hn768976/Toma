import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BLOOM_SCALE,
  BLOOM_TIGHT_ALPHA,
  BLOOM_TIGHT_BLUR,
  BLOOM_WIDE_ALPHA,
  BLOOM_WIDE_BLUR,
  BLUR_TIER_FULL_MAX,
  BLUR_TIER_HALF_MAX,
  BLUR_TIER_SCALES,
  DRIFT_PHASE,
  DRIFT_PIXELS,
  DURATION_IN_FRAMES,
  FLASH_ALPHA_BOOST,
  GLOW_STRENGTH,
  GRAIN_ALPHA,
  GRAIN_TILE_SIZE,
  HEIGHT,
  MOTION_BLUR_U,
  PULSE_AMPLITUDE,
  SPARKLE_BLUR,
  SPARKLE_MAX_ALPHA,
  SPARKLE_TWINKLE_EXPONENT,
  SPRITE_SMALL_THRESHOLD,
  TAU,
  VANISHING_POINT,
  VIGNETTE_ALPHA,
  VIGNETTE_INNER_STOP,
  WIDTH,
} from "./config";
import { withAlpha } from "./color";
import {
  FLOW_PER_FRAME,
  alphaAt,
  bandIndexFor,
  buildBlurBands,
  buildChips,
  buildPaths,
  buildSparkles,
  chipDepthU,
  chipWidthAt,
  flashStrengthAt,
  lateralAt,
  pointOnPath,
  radiusAt,
  wrapFrames,
} from "./geometry";
import { buildGrainTiles } from "./grain";
import { buildSpriteAtlas } from "./sprites";
import type { Sprite } from "./sprites";
import { THEMES } from "./theme";
import { VARIANTS, VARIANT_NAMES } from "./variants";
import type { TunnelVariant } from "./variants";

export const dataTunnelSchema = z.object({
  variant: z.enum(VARIANT_NAMES),
});

export type DataTunnelProps = z.infer<typeof dataTunnelSchema>;

export const dataTunnelDefaultProps: DataTunnelProps = { variant: "violet" };

export const dataTunnelApproachDefaultProps: DataTunnelProps = { variant: "violetApproach" };

const BLOOM_WIDTH = Math.round(WIDTH * BLOOM_SCALE);
const BLOOM_HEIGHT = Math.round(HEIGHT * BLOOM_SCALE);

// One chip blit, resolved for this frame.
type DrawItem = {
  x: number;
  y: number;
  angle: number;
  width: number;
  alpha: number;
  sprite: Sprite;
  // Per-frame travel vector, used for the near-band motion-blur smear.
  // Zero for chips outside that band.
  trailX: number;
  trailY: number;
};

// A blur band renders into a scratch pair sized to this fraction of the
// frame. See the note on BLUR_TIER_SCALES in config.ts.
const tierScaleFor = (blur: number) =>
  blur <= BLUR_TIER_FULL_MAX
    ? BLUR_TIER_SCALES.full
    : blur <= BLUR_TIER_HALF_MAX
      ? BLUR_TIER_SCALES.half
      : BLUR_TIER_SCALES.quarter;

type Scratch = { draw: HTMLCanvasElement; blur: HTMLCanvasElement; scale: number };

const createScratch = (scale: number): Scratch | null => {
  if (typeof document === "undefined") return null;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WIDTH * scale);
    canvas.height = Math.round(HEIGHT * scale);
    return canvas;
  };
  return { draw: make(), blur: make(), scale };
};

const blitSprite = (
  ctx: CanvasRenderingContext2D,
  item: DrawItem,
  offsetX: number,
  offsetY: number,
  alpha: number,
) => {
  const scale = item.width / item.sprite.chipWidth;
  const w = item.sprite.canvasWidth * scale;
  const h = item.sprite.canvasHeight * scale;
  ctx.save();
  ctx.translate(item.x + offsetX, item.y + offsetY);
  ctx.rotate(item.angle);
  ctx.globalAlpha = alpha;
  ctx.drawImage(item.sprite.canvas, -w / 2, -h / 2, w, h);
  ctx.restore();
};

const drawItem = (ctx: CanvasRenderingContext2D, item: DrawItem, variant: TunnelVariant) => {
  if (item.trailX === 0 && item.trailY === 0) {
    blitSprite(ctx, item, 0, 0, item.alpha);
    return;
  }
  // Taps fanned back along the travel direction, spanning motionBlurSpan
  // frames of travel. The trail vector comes from cameraDirection, so the
  // smear reverses with the flow.
  const taps = variant.motionBlurTaps;
  let total = 0;
  for (let i = 0; i < taps.length; i++) total += taps[i];
  for (let tap = 0; tap < taps.length; tap++) {
    const back = (tap / (taps.length - 1)) * variant.motionBlurSpan;
    blitSprite(ctx, item, -item.trailX * back, -item.trailY * back, (item.alpha * taps[tap]) / total);
  }
};

// How far, in device pixels, a drawn item can reach from its centre: the
// sprite's padded half-diagonal plus its motion-blur trail.
const itemReach = (item: DrawItem, variant: TunnelVariant) => {
  const spriteReach = (item.width / item.sprite.chipWidth) * item.sprite.canvasWidth * 0.75;
  const trail =
    Math.sqrt(item.trailX * item.trailX + item.trailY * item.trailY) * variant.motionBlurSpan;
  return spriteReach + trail;
};

// A curved perspective corridor of glowing data chips, drawn to canvas.
//
// The variant (see variants.ts) supplies the signed camera direction and the
// depth response; nothing in this file knows which way the field is flowing.
export const DataTunnel: React.FC<DataTunnelProps> = ({ variant: variantName }) => {
  const frame = useCurrentFrame();
  const loopFrame = wrapFrames(frame);
  const variant: TunnelVariant = VARIANTS[variantName];
  const theme = THEMES[variant.theme];

  // Geometry and rasters are built once, seeded, and never touched again.
  const paths = useMemo(buildPaths, []);
  const chips = useMemo(() => buildChips(theme.chipPalette), [theme]);
  const sparkles = useMemo(buildSparkles, []);
  const atlas = useMemo(() => buildSpriteAtlas(theme), [theme]);
  const grainTiles = useMemo(() => buildGrainTiles(theme.grainNeutral), [theme]);
  const bands = useMemo(() => buildBlurBands(variant), [variant]);

  const whiteIndex = useMemo(
    () => Math.max(0, theme.chipPalette.findIndex((entry) => entry.color === theme.chipWhite)),
    [theme],
  );

  // One bucket per blur band, ordered far -> near. Chips composite additively
  // so order within a bucket is irrelevant; what the buckets buy is that a
  // whole run of chips is blurred ONCE, as a group, instead of each chip
  // paying for its own canvas filter.
  const buckets = useMemo(() => bands.map<DrawItem[]>(() => []), [bands]);

  const scratches = useMemo(() => {
    const full = createScratch(BLUR_TIER_SCALES.full);
    return {
      [BLUR_TIER_SCALES.full]: full,
      [BLUR_TIER_SCALES.half]: createScratch(BLUR_TIER_SCALES.half),
      [BLUR_TIER_SCALES.quarter]: createScratch(BLUR_TIER_SCALES.quarter),
    } as Record<number, Scratch | null>;
  }, []);

  const fieldRef = useRef<HTMLCanvasElement>(null);
  const bloomTightRef = useRef<HTMLCanvasElement>(null);
  const bloomWideRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    const fieldCtx = field?.getContext("2d");
    const tightCtx = bloomTightRef.current?.getContext("2d");
    const wideCtx = bloomWideRef.current?.getContext("2d");
    const grainCtx = grainRef.current?.getContext("2d");
    if (!field || !fieldCtx || !tightCtx || !wideCtx || !grainCtx || !atlas) return;

    for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;

    // Ambient drift only: a closed Lissajous figure that returns exactly to
    // its start at frame 450.
    const driftX = DRIFT_PIXELS * Math.sin((TAU * loopFrame) / DURATION_IN_FRAMES);
    const driftY = DRIFT_PIXELS * Math.sin((2 * TAU * loopFrame) / DURATION_IN_FRAMES + DRIFT_PHASE);
    const originX = VANISHING_POINT.x + driftX;
    const originY = VANISHING_POINT.y + driftY;

    // --- resolve every chip for this frame --------------------------------
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const u = chipDepthU(chip, loopFrame, variant);

      const pulse = 1 + PULSE_AMPLITUDE * Math.sin((TAU * loopFrame) / chip.pulsePeriod + chip.pulsePhase);
      const flash = flashStrengthAt(chip, loopFrame);
      const boost = 1 + flash * (FLASH_ALPHA_BOOST - 1);
      const alpha = Math.min(1, alphaAt(u, variant) * chip.baseAlpha * pulse * boost);
      if (alpha <= 0.004) continue;

      const path = paths[chip.pathIndex];
      const r = radiusAt(u, variant);
      const point = pointOnPath(path, r, lateralAt(chip, r));
      const width = chipWidthAt(chip, r);

      // Cull anything the (glow-padded) sprite cannot reach the frame with.
      const x = originX + point.x;
      const y = originY + point.y;
      if (x < -width || x > WIDTH + width || y < -width || y > HEIGHT + width) continue;

      const sizeIndex = width < SPRITE_SMALL_THRESHOLD ? 1 : 0;
      const flashing = flash > 0;
      const sprite =
        chip.kind === "filled"
          ? atlas.filled[sizeIndex][flashing ? whiteIndex : chip.colorIndex][chip.aspectIndex]
          : chip.kind === "hollow"
            ? atlas.hollow[sizeIndex][flashing ? 1 : 0][chip.aspectIndex]
            : atlas.hollowTicked[sizeIndex][flashing ? 1 : 0][chip.aspectIndex];

      let trailX = 0;
      let trailY = 0;
      if (u < MOTION_BLUR_U) {
        // Deliberately unwrapped: a chip a hair past the end of the range
        // should smear from just outside it, not from the far end of the
        // corridor.
        const uPrev = u - variant.cameraDirection * FLOW_PER_FRAME;
        const rPrev = radiusAt(uPrev, variant);
        const prev = pointOnPath(path, rPrev, lateralAt(chip, rPrev));
        trailX = point.x - prev.x;
        trailY = point.y - prev.y;
      }

      buckets[bandIndexFor(bands, u)].push({
        x: point.x,
        y: point.y,
        angle: point.angle,
        width,
        alpha,
        sprite,
        trailX,
        trailY,
      });
    }

    // --- draw the field, one blur band at a time --------------------------
    fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
    fieldCtx.clearRect(0, 0, WIDTH, HEIGHT);
    fieldCtx.globalCompositeOperation = "lighter";
    fieldCtx.imageSmoothingEnabled = true;
    fieldCtx.imageSmoothingQuality = "high";

    for (let band = 0; band < buckets.length; band++) {
      const items = buckets[band];
      if (items.length === 0) continue;
      const blur = bands[band].blur;

      if (blur <= 0) {
        fieldCtx.setTransform(1, 0, 0, 1, originX, originY);
        for (let i = 0; i < items.length; i++) drawItem(fieldCtx, items[i], variant);
        continue;
      }

      const scale = tierScaleFor(blur);
      const scratch = scratches[scale];
      if (!scratch) continue;
      const drawCtx = scratch.draw.getContext("2d");
      const blurCtx = scratch.blur.getContext("2d");
      if (!drawCtx || !blurCtx) continue;

      // Only touch the region this band actually covers. Bands near the
      // vanishing point occupy a few percent of the frame, and clearing the
      // whole scratch for each of them would cost more than the blur.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const reach = itemReach(item, variant);
        const cx = originX + item.x;
        const cy = originY + item.y;
        if (cx - reach < minX) minX = cx - reach;
        if (cy - reach < minY) minY = cy - reach;
        if (cx + reach > maxX) maxX = cx + reach;
        if (cy + reach > maxY) maxY = cy + reach;
      }
      // Room for the gaussian to spill, then snapped to a whole scratch
      // pixel so the scaled blits land on integer coordinates.
      const spill = blur * 3;
      const step = 1 / BLUR_TIER_SCALES.quarter;
      const bx = Math.max(0, Math.floor((minX - spill) / step) * step);
      const by = Math.max(0, Math.floor((minY - spill) / step) * step);
      const bw = Math.min(WIDTH, Math.ceil((maxX + spill) / step) * step) - bx;
      const bh = Math.min(HEIGHT, Math.ceil((maxY + spill) / step) * step) - by;
      if (bw <= 0 || bh <= 0) continue;

      const sx = bx * scale;
      const sy = by * scale;
      const sw = bw * scale;
      const sh = bh * scale;

      drawCtx.setTransform(1, 0, 0, 1, 0, 0);
      drawCtx.clearRect(sx, sy, sw, sh);
      drawCtx.globalCompositeOperation = "lighter";
      drawCtx.imageSmoothingEnabled = true;
      drawCtx.imageSmoothingQuality = "high";
      drawCtx.setTransform(scale, 0, 0, scale, originX * scale, originY * scale);
      for (let i = 0; i < items.length; i++) drawItem(drawCtx, items[i], variant);

      // Blur at the scratch's own resolution, which is the whole point of
      // the tier: a quarter-scale pass is a sixteenth of the pixels.
      blurCtx.setTransform(1, 0, 0, 1, 0, 0);
      blurCtx.globalCompositeOperation = "source-over";
      blurCtx.globalAlpha = 1;
      blurCtx.clearRect(sx, sy, sw, sh);
      blurCtx.filter = "blur(" + blur * scale + "px)";
      blurCtx.drawImage(scratch.draw, sx, sy, sw, sh, sx, sy, sw, sh);
      blurCtx.filter = "none";

      fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
      fieldCtx.globalAlpha = 1;
      fieldCtx.drawImage(scratch.blur, sx, sy, sw, sh, bx, by, bw, bh);
    }

    // --- star sparkles, in the near plane ---------------------------------
    fieldCtx.setTransform(1, 0, 0, 1, driftX, driftY);
    fieldCtx.filter = "blur(" + SPARKLE_BLUR + "px)";
    const sparkleSprite = atlas.sparkle;
    for (let i = 0; i < sparkles.length; i++) {
      const sparkle = sparkles[i];
      const wave = 0.5 + 0.5 * Math.sin((TAU * loopFrame) / sparkle.period + sparkle.phase);
      const alpha = Math.pow(wave, SPARKLE_TWINKLE_EXPONENT) * SPARKLE_MAX_ALPHA;
      if (alpha <= 0.004) continue;
      const scale = sparkle.size / sparkleSprite.chipWidth;
      const w = sparkleSprite.canvasWidth * scale;
      const h = sparkleSprite.canvasHeight * scale;
      fieldCtx.save();
      fieldCtx.translate(sparkle.x, sparkle.y);
      fieldCtx.rotate(sparkle.rotation);
      fieldCtx.globalAlpha = alpha;
      fieldCtx.drawImage(sparkleSprite.canvas, -w / 2, -h / 2, w, h);
      fieldCtx.restore();
    }

    fieldCtx.filter = "none";
    fieldCtx.globalAlpha = 1;
    fieldCtx.globalCompositeOperation = "source-over";
    fieldCtx.setTransform(1, 0, 0, 1, 0, 0);

    // --- bloom: two blurred copies of the same field ----------------------
    // Blurred here, on canvas, at BLOOM_SCALE — not with a CSS filter on a
    // full-size layer, which would make the compositor run both gaussians
    // over the whole 4K frame every single frame.
    tightCtx.clearRect(0, 0, BLOOM_WIDTH, BLOOM_HEIGHT);
    tightCtx.filter = "blur(" + BLOOM_TIGHT_BLUR * GLOW_STRENGTH * BLOOM_SCALE + "px)";
    tightCtx.drawImage(field, 0, 0, BLOOM_WIDTH, BLOOM_HEIGHT);
    tightCtx.filter = "none";

    wideCtx.clearRect(0, 0, BLOOM_WIDTH, BLOOM_HEIGHT);
    wideCtx.filter = "blur(" + BLOOM_WIDE_BLUR * GLOW_STRENGTH * BLOOM_SCALE + "px)";
    wideCtx.drawImage(field, 0, 0, BLOOM_WIDTH, BLOOM_HEIGHT);
    wideCtx.filter = "none";

    // --- grain -------------------------------------------------------------
    if (grainTiles && grainTiles.length > 0) {
      const tile = grainTiles[loopFrame % grainTiles.length];
      const pattern = grainCtx.createPattern(tile, "repeat");
      grainCtx.setTransform(1, 0, 0, 1, 0, 0);
      grainCtx.clearRect(0, 0, WIDTH, HEIGHT);
      if (pattern) {
        // Slide the tile each frame so the small tile set never reads as a
        // repeating cycle. Seeded on frame % 450, so the loop still closes.
        const shiftX = Math.floor(random("grain-shift-x-" + loopFrame) * GRAIN_TILE_SIZE);
        const shiftY = Math.floor(random("grain-shift-y-" + loopFrame) * GRAIN_TILE_SIZE);
        grainCtx.translate(-shiftX, -shiftY);
        grainCtx.fillStyle = pattern;
        grainCtx.fillRect(0, 0, WIDTH + GRAIN_TILE_SIZE, HEIGHT + GRAIN_TILE_SIZE);
        grainCtx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  }, [
    atlas,
    bands,
    buckets,
    chips,
    grainTiles,
    loopFrame,
    paths,
    scratches,
    sparkles,
    variant,
    whiteIndex,
  ]);

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };

  return (
    <AbsoluteFill
      style={{
        // Deep and saturated, never black — the richness is what makes the
        // chips read as glowing rather than merely bright.
        background:
          "radial-gradient(ellipse 118% 108% at 48% 52%, " +
          theme.backgroundMid +
          " 0%, " +
          theme.backgroundDeep +
          " 62%)",
      }}
    >
      <canvas
        ref={bloomWideRef}
        width={BLOOM_WIDTH}
        height={BLOOM_HEIGHT}
        style={{
          ...layerStyle,
          opacity: BLOOM_WIDE_ALPHA * GLOW_STRENGTH,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={bloomTightRef}
        width={BLOOM_WIDTH}
        height={BLOOM_HEIGHT}
        style={{
          ...layerStyle,
          opacity: BLOOM_TIGHT_ALPHA * GLOW_STRENGTH,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={fieldRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ ...layerStyle, mixBlendMode: "screen" }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 80% at 48% 50%, " +
            withAlpha(theme.vignette, 0) +
            " " +
            VIGNETTE_INNER_STOP * 100 +
            "%, " +
            withAlpha(theme.vignette, VIGNETTE_ALPHA) +
            " 100%)",
        }}
      />
      <canvas
        ref={grainRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ ...layerStyle, opacity: GRAIN_ALPHA, mixBlendMode: "overlay" }}
      />
    </AbsoluteFill>
  );
};
