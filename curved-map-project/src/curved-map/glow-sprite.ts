/**
 * Soft radial glow sprites, built once per colour and stamped with drawImage.
 * Far cheaper than a shadowBlur or a gradient fill per dot, of which there are
 * thousands per frame.
 */
import { hexToRgb, rgba } from "./color";

const SPRITE_SIZE = 128;
const cache = new Map<string, HTMLCanvasElement>();

export const getGlowSprite = (hex: string, coreAlpha: number): HTMLCanvasElement => {
  const key = `${hex}|${coreAlpha}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d")!;
  const rgb = hexToRgb(hex);
  const r = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, rgba(rgb, coreAlpha));
  gradient.addColorStop(0.28, rgba(rgb, coreAlpha * 0.42));
  gradient.addColorStop(0.62, rgba(rgb, coreAlpha * 0.1));
  gradient.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  cache.set(key, canvas);
  return canvas;
};

export const stampGlow = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
): void => {
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
};
