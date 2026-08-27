import {rgba} from './color';

/**
 * Particles are drawn as pre-rendered sprites rather than arc()+fill(): 7000
 * gradient-edged discs per frame at 4K is far cheaper as drawImage calls, and
 * the same trick gives the bloom pass a soft glow for free.
 */
const DOT_SIZE = 64;
const GLOW_SIZE = 128;

const cache = new Map<string, HTMLCanvasElement>();

const build = (
  key: string,
  size: number,
  stops: [number, number][],
  color: string,
): HTMLCanvasElement => {
  const hit = cache.get(key);
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable while building a sprite');
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [offset, alpha] of stops) {
    g.addColorStop(offset, rgba(color, alpha));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cache.set(key, cv);
  return cv;
};

export const dotSprite = (color: string): HTMLCanvasElement =>
  build(
    `dot:${color}`,
    DOT_SIZE,
    [
      [0, 1],
      [0.5, 0.96],
      [0.78, 0.36],
      [1, 0],
    ],
    color,
  );

export const glowSprite = (color: string): HTMLCanvasElement =>
  build(
    `glow:${color}`,
    GLOW_SIZE,
    [
      [0, 0.85],
      [0.22, 0.3],
      [0.55, 0.07],
      [1, 0],
    ],
    color,
  );
