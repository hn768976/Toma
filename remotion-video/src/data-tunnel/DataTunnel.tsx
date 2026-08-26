import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BLOOM_TIGHT_ALPHA,
  BLOOM_TIGHT_BLUR,
  BLOOM_WIDE_ALPHA,
  BLOOM_WIDE_BLUR,
  CAMERA_DIRECTION,
  DRIFT_PHASE,
  DRIFT_PIXELS,
  DURATION_IN_FRAMES,
  FLASH_ALPHA_BOOST,
  GLOW_STRENGTH,
  GRAIN_ALPHA,
  GRAIN_TILE_SIZE,
  HEIGHT,
  MOTION_BLUR_TAPS,
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
  BLUR_BANDS,
  FLOW_PER_FRAME,
  alphaAt,
  bandIndexFor,
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
import { THEMES, THEME_NAMES } from "./theme";
import { random } from "remotion";

export const dataTunnelSchema = z.object({
  variant: z.enum(THEME_NAMES),
});

export type DataTunnelProps = z.infer<typeof dataTunnelSchema>;

export const dataTunnelDefaultProps: DataTunnelProps = { variant: "violet" };

// One chip blit, resolved for this frame. Pooled and reused so the per-frame
// draw pass allocates nothing.
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

const MOTION_BLUR_WEIGHT_TOTAL = MOTION_BLUR_TAPS.reduce((sum, tap) => sum + tap, 0);

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

const drawItem = (ctx: CanvasRenderingContext2D, item: DrawItem) => {
  if (item.trailX === 0 && item.trailY === 0) {
    blitSprite(ctx, item, 0, 0, item.alpha);
    return;
  }
  // Three taps spanning one frame of travel, trailing behind the chip. The
  // trail vector is derived from CAMERA_DIRECTION, so it reverses with it.
  for (let tap = 0; tap < MOTION_BLUR_TAPS.length; tap++) {
    const back = tap / (MOTION_BLUR_TAPS.length - 1);
    const weight = MOTION_BLUR_TAPS[tap] / MOTION_BLUR_WEIGHT_TOTAL;
    blitSprite(ctx, item, -item.trailX * back, -item.trailY * back, item.alpha * weight);
  }
};

// A curved perspective corridor of glowing data chips, drawn to canvas.
//
// Depth is a single signed direction (CAMERA_DIRECTION in config.ts): +1
// retreats from the field so chips flow toward the vanishing point, -1 makes
// them rush the viewer. Nothing else in this file knows which way is which.
export const DataTunnel: React.FC<DataTunnelProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const loopFrame = wrapFrames(frame);
  const theme = THEMES[variant];

  // Geometry and rasters are built once, seeded, and never touched again.
  const paths = useMemo(buildPaths, []);
  const chips = useMemo(() => buildChips(theme.chipPalette), [theme]);
  const sparkles = useMemo(buildSparkles, []);
  const atlas = useMemo(() => buildSpriteAtlas(theme), [theme]);
  const grainTiles = useMemo(() => buildGrainTiles(theme.grainNeutral), [theme]);

  const whiteIndex = useMemo(
    () => Math.max(0, theme.chipPalette.findIndex((entry) => entry.color === theme.chipWhite)),
    [theme],
  );

  // One bucket per blur band, ordered far -> near. Chips composite additively
  // so order within a bucket is irrelevant, but sharing a bucket means a
  // whole run of chips draws under one canvas filter instead of hundreds.
  const buckets = useMemo(() => BLUR_BANDS.map<DrawItem[]>(() => []), []);

  const fieldRef = useRef<HTMLCanvasElement>(null);
  const bloomTightRef = useRef<HTMLCanvasElement>(null);
  const bloomWideRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const fieldCtx = fieldRef.current?.getContext("2d");
    const tightCtx = bloomTightRef.current?.getContext("2d");
    const wideCtx = bloomWideRef.current?.getContext("2d");
    const grainCtx = grainRef.current?.getContext("2d");
    if (!fieldCtx || !tightCtx || !wideCtx || !grainCtx || !atlas) return;

    for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;

    // --- resolve every chip for this frame --------------------------------
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const u = chipDepthU(chip, loopFrame);

      const pulse = 1 + PULSE_AMPLITUDE * Math.sin((TAU * loopFrame) / chip.pulsePeriod + chip.pulsePhase);
      const flash = flashStrengthAt(chip, loopFrame);
      const boost = 1 + flash * (FLASH_ALPHA_BOOST - 1);
      const alpha = Math.min(1, alphaAt(u) * chip.baseAlpha * pulse * boost);
      if (alpha <= 0.004) continue;

      const path = paths[chip.pathIndex];
      const r = radiusAt(u);
      const point = pointOnPath(path, r, lateralAt(chip, r));
      const width = chipWidthAt(chip, r);

      // Cull anything the (glow-padded) sprite cannot reach the frame with.
      const x = VANISHING_POINT.x + point.x;
      const y = VANISHING_POINT.y + point.y;
      const reach = width;
      if (x < -reach || x > WIDTH + reach || y < -reach || y > HEIGHT + reach) continue;

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
        // Deliberately unwrapped: a chip a hair past u = 0 should smear from
        // just outside the range, not from the far end of the corridor.
        const uPrev = u - CAMERA_DIRECTION * FLOW_PER_FRAME;
        const rPrev = radiusAt(uPrev);
        const prev = pointOnPath(path, rPrev, lateralAt(chip, rPrev));
        trailX = point.x - prev.x;
        trailY = point.y - prev.y;
      }

      buckets[bandIndexFor(u)].push({
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

    // --- draw the field ----------------------------------------------------
    fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
    fieldCtx.clearRect(0, 0, WIDTH, HEIGHT);

    // Ambient drift only: a closed Lissajous figure that returns exactly to
    // its start at frame 450.
    const driftX = DRIFT_PIXELS * Math.sin((TAU * loopFrame) / DURATION_IN_FRAMES);
    const driftY = DRIFT_PIXELS * Math.sin((2 * TAU * loopFrame) / DURATION_IN_FRAMES + DRIFT_PHASE);

    fieldCtx.translate(VANISHING_POINT.x + driftX, VANISHING_POINT.y + driftY);
    fieldCtx.globalCompositeOperation = "lighter";
    fieldCtx.imageSmoothingEnabled = true;
    fieldCtx.imageSmoothingQuality = "high";

    for (let band = 0; band < buckets.length; band++) {
      const items = buckets[band];
      if (items.length === 0) continue;
      const blur = BLUR_BANDS[band].blur;
      fieldCtx.filter = blur > 0 ? "blur(" + blur + "px)" : "none";
      for (let i = 0; i < items.length; i++) drawItem(fieldCtx, items[i]);
    }

    // --- star sparkles, in the near plane ---------------------------------
    fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
    fieldCtx.translate(driftX, driftY);
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
    const field = fieldRef.current;
    if (field) {
      tightCtx.clearRect(0, 0, WIDTH, HEIGHT);
      tightCtx.drawImage(field, 0, 0);
      wideCtx.clearRect(0, 0, WIDTH, HEIGHT);
      wideCtx.drawImage(field, 0, 0);
    }

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
    buckets,
    chips,
    grainTiles,
    loopFrame,
    paths,
    sparkles,
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
        width={WIDTH}
        height={HEIGHT}
        style={{
          ...layerStyle,
          filter: "blur(" + BLOOM_WIDE_BLUR * GLOW_STRENGTH + "px)",
          opacity: BLOOM_WIDE_ALPHA * GLOW_STRENGTH,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={bloomTightRef}
        width={WIDTH}
        height={HEIGHT}
        style={{
          ...layerStyle,
          filter: "blur(" + BLOOM_TIGHT_BLUR * GLOW_STRENGTH + "px)",
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
