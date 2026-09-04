/**
 * Offscreen surfaces that only depend on the frame size: the text page, the
 * grain tiles and the scanline pattern. Built once and reused, never mutated
 * per frame, so nothing carries state between frames.
 */

import { PAGE_ROWS, TOTAL_ROWS } from "./content";
import type { Layout } from "./motion";
import { makeRng } from "./random";

export const FONT_FAMILY = "JetBrains Mono";

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/**
 * The scrolling text page, drawn in greyscale. The first visible screen of
 * rows is repeated after the last row so the vertical wrap never needs a
 * split blit.
 */
const drawPage = (layout: Layout) => {
  const { canvasWidth, rowHeight, charWidth, fontSize, overscan, rowsDrawn } = layout;
  const canvas = makeCanvas(canvasWidth, rowHeight * (TOTAL_ROWS + rowsDrawn));
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${fontSize}px "${FONT_FAMILY}", monospace`;

  // Terminal cells are wider than the font's natural advance, so stretch the
  // glyphs horizontally into the cell instead of changing the row height.
  const advance = ctx.measureText("M").width || fontSize * 0.6;
  const stretch = charWidth / advance;
  const left = overscan - charWidth * 3;

  const total = TOTAL_ROWS + rowsDrawn;
  for (let i = 0; i < total; i++) {
    const row = PAGE_ROWS[i % TOTAL_ROWS];
    if (!row.text) continue;
    const top = i * rowHeight;
    const baseline = top + rowHeight * 0.76;

    if (row.invert) {
      const w = row.text.length * charWidth + charWidth * 2;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.fillRect(left - charWidth, top + rowHeight * 0.1, w, rowHeight * 0.86);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(255, 255, 255, ${row.level})`;
    }

    ctx.save();
    ctx.transform(stretch, 0, 0, 1, left, 0);
    ctx.fillText(row.text, 0, baseline);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
};

/** A handful of grain tiles; the frame number picks one and offsets it. */
const buildNoiseTiles = (size: number) => {
  const rng = makeRng(0x51f2a9);
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < 5; t++) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rng();
      // Weighted toward black so the grain reads as sparse signal noise.
      const g = Math.round(255 * v * v * v);
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

/**
 * Horizontal extent of each content row in canvas pixels. The trail blits one
 * strip per row per state, so not copying the empty right-hand side of a short
 * row is the single cheapest win in the whole pipeline.
 */
const buildRowWidths = (layout: Layout) => {
  const left = layout.overscan - layout.charWidth * 3;
  return PAGE_ROWS.map((r) =>
    r.text.length === 0
      ? 0
      : Math.min(
          layout.canvasWidth,
          Math.ceil(left + (r.text.length + 3) * layout.charWidth),
        ),
  );
};

/**
 * Scanlines, the aspect-matched vignette and the corner darkening, baked into
 * one overlay. All three are static, so the frame only pays for one blit.
 */
const buildOverlay = (layout: Layout) => {
  const { width, height } = layout;
  const period = Math.max(4, Math.round(height / 270)); // 8px at 4K
  const line = makeCanvas(4, period);
  const lineCtx = line.getContext("2d")!;
  lineCtx.fillStyle = "rgba(0, 0, 0, 1)";
  lineCtx.fillRect(0, 0, 4, Math.round(period / 2));

  const c = makeCanvas(width, height);
  const ctx = c.getContext("2d")!;
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = ctx.createPattern(line, "repeat")!;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, height / width);
  const v1 = ctx.createRadialGradient(0, 0, width * 0.22, 0, 0, width * 0.72);
  v1.addColorStop(0, "rgba(0, 0, 0, 0)");
  v1.addColorStop(0.6, "rgba(0, 0, 0, 0.14)");
  v1.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = v1;
  ctx.fillRect(-width, -width, width * 2, width * 2);
  ctx.restore();

  const v2 = ctx.createRadialGradient(
    width / 2, height / 2, width * 0.42,
    width / 2, height / 2, width * 0.6,
  );
  v2.addColorStop(0, "rgba(0, 0, 0, 0)");
  v2.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = v2;
  ctx.fillRect(0, 0, width, height);

  return c;
};

/** Width divisor of each downscale step; the last one is SQUASH. */
export const SQUASH_STEPS = [2, 4, 8] as const;
export const SQUASH = SQUASH_STEPS[SQUASH_STEPS.length - 1];

export type Surfaces = {
  layout: Layout;
  page: HTMLCanvasElement;
  /** Trail accumulation, opaque black under the text. */
  smear: HTMLCanvasElement;
  /** Band-blurred and tinted copy of the smear. */
  blurred: HTMLCanvasElement;
  /**
   * Horizontal downscale chain for the directional blur: each step halves the
   * width, so the small buffer is a proper box average of the frame rather
   * than an aliased sample of it.
   */
  chain: HTMLCanvasElement[];
  /** Scratch buffer the same size as the last chain step. */
  smallB: HTMLCanvasElement;
  /** Small buffer for the bloom pass. */
  bloom: HTMLCanvasElement;
  noise: HTMLCanvasElement[];
  /**
   * A 4px-wide strip used to build the vertical gradients. Filling a strip and
   * stretching it is a plain blit; filling the whole frame with a fresh
   * gradient every frame makes the rasteriser build and cache a new shader 600
   * times over, which it does not enjoy.
   */
  strip: HTMLCanvasElement;
  /** Scanlines and vignette, baked together: both are static. */
  overlay: HTMLCanvasElement;
  rowWidths: number[];
};

const cache = new Map<string, Surfaces>();

export const getSurfaces = (layout: Layout): Surfaces => {
  const key = `${layout.width}x${layout.height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const surfaces: Surfaces = {
    layout,
    page: drawPage(layout),
    smear: makeCanvas(layout.canvasWidth, layout.height),
    blurred: makeCanvas(layout.canvasWidth, layout.height),
    chain: SQUASH_STEPS.map((div) =>
      makeCanvas(Math.ceil(layout.canvasWidth / div), layout.height),
    ),
    smallB: makeCanvas(Math.ceil(layout.canvasWidth / SQUASH), layout.height),
    bloom: makeCanvas(Math.round(layout.canvasWidth / 20), Math.round(layout.height / 6)),
    noise: buildNoiseTiles(512),
    strip: makeCanvas(4, layout.height),
    overlay: buildOverlay(layout),
    rowWidths: buildRowWidths(layout),
  };
  cache.set(key, surfaces);
  return surfaces;
};
