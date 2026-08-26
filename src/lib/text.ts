import {rgba} from './theme';
import {Theme, Variant} from './variants';

/**
 * Labels are laid out once into a small offscreen canvas — glow and all — and
 * then blitted with a transform every frame. Re-laying-out text 30x per frame
 * is the single most expensive thing this piece could do; this avoids it.
 *
 * The tile is rendered at a canonical CACHE_FONT size (times the render unit,
 * capped so a 4K render does not blow the cache up), and a label at size `s` is
 * blitted scaled by `s / CACHE_FONT` in design space.
 */
export const CACHE_FONT = 72;

export type CachedTile = {
  canvas: HTMLCanvasElement;
  /** tile size in CSS px at the canonical font size */
  cssW: number;
  cssH: number;
};

export type TextCache = Map<string, CachedTile>;

export const cacheKey = (
  variant: Variant,
  text: string,
  white: boolean,
  unit: number,
  blurTile: number,
) => `${variant}|${white ? 'w' : 'd'}|${unit}|${blurTile}|${text}`;

export const getTextTile = (
  cache: TextCache,
  theme: Theme,
  variant: Variant,
  measure: CanvasRenderingContext2D,
  text: string,
  white: boolean,
  unit: number,
  /**
   * Softness, in canonical CACHE_FONT units, baked straight into the tile.
   * Applying `ctx.filter` at blit time instead is catastrophically slow under
   * software rasterisation — it dominated the entire render — and the result is
   * identical, because a label's blur never changes across the loop.
   */
  blurTile: number,
  fontFamily: string,
): CachedTile => {
  const key = cacheKey(variant, text, white, unit, blurTile);
  const hit = cache.get(key);
  if (hit) return hit;

  const fontPx = CACHE_FONT * unit;
  const font = `500 ${fontPx}px "${fontFamily}", ui-monospace, monospace`;
  measure.font = font;
  const w = measure.measureText(text).width;

  const pad = fontPx * 0.62; // room for the halo
  const cw = Math.ceil(w + pad * 2);
  const ch = Math.ceil(fontPx * 1.35 + pad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const tile: CachedTile = {canvas, cssW: cw / unit, cssH: ch / unit};
  if (!ctx) {
    cache.set(key, tile);
    return tile;
  }

  ctx.font = font;
  if (blurTile > 0) ctx.filter = `blur(${(blurTile * unit).toFixed(2)}px)`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = 'lighter';
  const cx = cw / 2;
  const cy = ch / 2;

  // 1. soft green halo
  ctx.shadowColor = rgba(theme.lineGlow, 1);
  ctx.shadowBlur = fontPx * 0.4;
  ctx.fillStyle = rgba(theme.lineGlow, white ? 0.5 : 0.38);
  ctx.fillText(text, cx, cy);
  ctx.fillText(text, cx, cy);

  // 2. tighter neon bloom
  ctx.shadowColor = rgba(theme.lineMid, 1);
  ctx.shadowBlur = fontPx * 0.15;
  ctx.fillStyle = rgba(theme.lineMid, white ? 0.45 : 0.5);
  ctx.fillText(text, cx, cy);

  // 3. the legible core
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.fillStyle = white ? rgba(theme.labelWhite, 1) : rgba(theme.labelDim, 0.92);
  ctx.fillText(text, cx, cy);
  ctx.filter = 'none';

  cache.set(key, tile);
  return tile;
};

/**
 * The most distant labels never resolve into digits — they are blurred
 * dashes. Cached per length bucket.
 */
export const getDashTile = (
  cache: TextCache,
  theme: Theme,
  variant: Variant,
  lenBucket: number,
  unit: number,
): CachedTile => {
  const key = `dash|${variant}|${unit}|${lenBucket}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const lenCss = lenBucket * 4;
  const hCss = 5;
  const pad = 12;
  const cw = Math.ceil((lenCss + pad * 2) * unit);
  const ch = Math.ceil((hCss + pad * 2) * unit);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const tile: CachedTile = {canvas, cssW: cw / unit, cssH: ch / unit};
  if (!ctx) {
    cache.set(key, tile);
    return tile;
  }
  ctx.scale(unit, unit);
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = rgba(theme.lineGlow, 1);
  ctx.shadowBlur = 9;
  ctx.fillStyle = rgba(theme.labelDim, 0.75);
  const x = pad;
  const y = pad;
  ctx.beginPath();
  ctx.roundRect(x, y, lenCss, hCss, hCss / 2);
  ctx.fill();
  ctx.fill();
  cache.set(key, tile);
  return tile;
};
