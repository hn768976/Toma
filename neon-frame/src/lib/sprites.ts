/**
 * Pre-rendered radial light sprites.
 *
 * Building a createRadialGradient() per point per frame is the second most
 * expensive mistake available at 4K (the first is re-laying-out glyphs). Every
 * glow in this piece is one gradient rasterised once into a small offscreen
 * canvas, then blitted — scaled uniformly for a halo, scaled non-uniformly for
 * an anamorphic streak.
 */
import { offscreen, rgba } from "./canvas";

const SPRITE_SIZE = 256;

export type LightSprite = {
  canvas: HTMLCanvasElement;
  /** Sprite edge length in its own pixel space. */
  size: number;
};

const cache = new Map<string, LightSprite>();

/**
 * A soft point of light: a white-hot core fading through `color` to nothing.
 *
 * @param color     hex colour of the glow body
 * @param coreStop  0-1, how far out the white core reaches
 * @param falloff   exponent on the fade; higher = tighter, more concentrated
 */
export const lightSprite = (
  color: string,
  coreStop = 0.06,
  falloff = 2.4,
): LightSprite => {
  const key = `${color}|${coreStop}|${falloff}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  const { canvas, ctx } = offscreen(SPRITE_SIZE, SPRITE_SIZE);
  const half = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);

  const STEPS = 24;
  gradient.addColorStop(0, `rgba(255, 255, 255, 1)`);
  gradient.addColorStop(coreStop, rgba(color, 0.95));
  for (let i = 1; i <= STEPS; i++) {
    const t = coreStop + ((1 - coreStop) * i) / STEPS;
    const a = Math.pow(1 - (i - 1) / STEPS, falloff) * 0.95;
    gradient.addColorStop(Math.min(1, t), rgba(color, a));
  }
  gradient.addColorStop(1, rgba(color, 0));

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const sprite: LightSprite = { canvas, size: SPRITE_SIZE };
  cache.set(key, sprite);
  return sprite;
};

/** Blits a light sprite centred on (x, y) at an arbitrary width and height. */
export const blitSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: LightSprite,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number,
) => {
  if (alpha <= 0.002 || width <= 0 || height <= 0) {
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite.canvas, x - width / 2, y - height / 2, width, height);
};
