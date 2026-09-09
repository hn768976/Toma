import {
  DURATION_IN_FRAMES,
  GLOW_LAYERS,
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
} from "./constants";
import { PALETTES, rgba, type VariantName } from "./palette";
import type { SpriteSet } from "./sprites";

// Enough stops that the encoded file does not band. The grain pass on
// top dithers whatever is left.
const GLOW_STOPS = 32;

/**
 * A broad warm glow low in frame and centred: brightest just below the
 * lower edge, fading upward to near-black at the top corners. Built
 * from three offset elliptical gradients so it is never a perfect
 * radial, and each drifts and breathes over the loop.
 */
export const drawGlow = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
  variant: VariantName,
) => {
  const palette = PALETTES[variant];
  const tau = (2 * Math.PI * frame) / DURATION_IN_FRAMES;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = rgba(palette.base, 1);
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  GLOW_LAYERS.forEach((layer, index) => {
    const color = palette.glow[index];
    const peak = palette.glowAlpha[index];
    const drift = Math.sin(tau * layer.driftHarmonic + index * 1.7);
    const breathe = 1 + layer.breathe * Math.sin(tau * (index + 1) + index);
    const cx = width * (0.5 + layer.offsetX + layer.driftX * drift);
    const cy = height * layer.offsetY;
    const radius = height * layer.radius * breathe;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(layer.aspect, 1);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    for (let i = 0; i <= GLOW_STOPS; i++) {
      const t = i / GLOW_STOPS;
      // Smooth, edgeless falloff — it should read as light spilling
      // from below frame, never as a disc with a rim.
      const a = i === GLOW_STOPS ? 0 : peak * Math.pow(1 - t, 2.4);
      gradient.addColorStop(t, rgba(color, a));
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

/**
 * Fine grain at ~1.5%. It is also the dither that keeps the glow
 * gradient from ringing once H.264 quantises it.
 */
export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSet,
  frame: number,
  width: number,
  height: number,
) => {
  const tile = sprites.grain[frame % GRAIN_TILE_COUNT];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) {
    return;
  }
  // Shift the tile each frame so the grain never sits still and the
  // 256px repeat is invisible.
  const offsetX = (frame * 37) % GRAIN_TILE_SIZE;
  const offsetY = (frame * 53) % GRAIN_TILE_SIZE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = GRAIN_ALPHA;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + GRAIN_TILE_SIZE, height + GRAIN_TILE_SIZE);
  ctx.restore();
};
