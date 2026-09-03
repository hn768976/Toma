/**
 * Glyph atlases — rasterise each distinct character once, then blit.
 *
 * Laying out thousands of individual glyphs per frame with fillText() is the
 * expensive mistake at 4K: every call re-shapes and re-rasterises the glyph.
 * Instead each character is drawn ONCE per (font size x colour) into a strip
 * atlas, and per-frame work becomes a drawImage() out of that strip.
 *
 * Deterministic and palette-agnostic: the glyph set, font stack and colour are
 * all parameters.
 *
 * @example
 *   const atlas = glyphAtlas({fontSize: 32, color: "#4F9FD4", fontStack, generation});
 *   blitGlyph(ctx, atlas, 7, x, y, 1);
 */
import { offscreen } from "./canvas";

/** A reasonable default: digits, letters and a handful of symbols. */
export const DEFAULT_GLYPHS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz<>[]{}/\\|+*=:;#$%&@?!^~";

export type GlyphAtlas = {
  canvas: HTMLCanvasElement;
  cellWidth: number;
  cellHeight: number;
  count: number;
  glyphs: string;
};

export type GlyphAtlasOptions = {
  fontSize: number;
  /** Any canvas fillStyle string. */
  color: string;
  /** A CSS font-family stack, e.g. `"Roboto Mono", ui-monospace, monospace`. */
  fontStack: string;
  /**
   * Cache-busting token. Change it when the underlying font face changes, so
   * an atlas rasterised against a fallback face is never reused afterwards.
   */
  generation: string;
  glyphs?: string;
  fontWeight?: string;
};

const cache = new Map<string, GlyphAtlas>();

/** Builds (or returns a cached) single-row atlas of every glyph. */
export const glyphAtlas = (options: GlyphAtlasOptions): GlyphAtlas => {
  const {
    fontSize,
    color,
    fontStack,
    generation,
    glyphs = DEFAULT_GLYPHS,
    fontWeight = "700",
  } = options;

  const key = `${fontSize}|${color}|${fontWeight}|${fontStack}|${generation}|${glyphs.length}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  const font = `${fontWeight} ${fontSize}px ${fontStack}`;
  const probe = offscreen(8, 8).ctx;
  probe.font = font;
  const advance = probe.measureText("M").width || fontSize * 0.6;

  const cellWidth = Math.ceil(advance * 1.5);
  const cellHeight = Math.ceil(fontSize * 1.5);
  const count = glyphs.length;

  const { canvas, ctx } = offscreen(cellWidth * count, cellHeight);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.fillText(
      glyphs[i],
      i * cellWidth + cellWidth / 2,
      cellHeight / 2 + fontSize * 0.02,
    );
  }

  const atlas: GlyphAtlas = { canvas, cellWidth, cellHeight, count, glyphs };
  cache.set(key, atlas);
  return atlas;
};

/**
 * Blits glyph `index` centred on (x, y).
 *
 * `scale` exists so an atlas rasterised at full resolution can be blitted into
 * a reduced-resolution buffer without needing a second set of atlases.
 */
export const blitGlyph = (
  ctx: CanvasRenderingContext2D,
  atlas: GlyphAtlas,
  index: number,
  x: number,
  y: number,
  scale = 1,
) => {
  const i = ((index % atlas.count) + atlas.count) % atlas.count;
  const w = atlas.cellWidth * scale;
  const h = atlas.cellHeight * scale;
  ctx.drawImage(
    atlas.canvas,
    i * atlas.cellWidth,
    0,
    atlas.cellWidth,
    atlas.cellHeight,
    x - w / 2,
    y - h / 2,
    w,
    h,
  );
};
