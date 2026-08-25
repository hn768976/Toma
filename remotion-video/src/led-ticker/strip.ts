// Band content -> LED lattice.
//
// The chunky, stair-stepped letterforms come from SAMPLING, not masking: each
// band's sequence is drawn once into an offscreen strip at full board
// resolution, then a single pixel is read at every LED centre. An emitter
// lights where that sample's coverage clears the threshold. Curves therefore
// break into visible dot steps, which a dot overlay on top of clean type
// never does.
//
// The strip is sampled ONCE per band for the whole loop and cached — the
// sequence tiles, so scrolling is just an offset into the cached lattice.

import {
  BANDS,
  FONT_FAMILY,
  FONT_PX,
  GLYPH_ROWS,
  GREEN,
  LIT_GREEN,
  LIT_RED,
  LIT_WHITE,
  PITCH,
  RED,
  TEXT_ROWS,
  WHITE,
} from "./constants";
import { buildBandContent, Entry } from "./content";
import { makeCanvas } from "./sprites";

const CAP_PX = GLYPH_ROWS * PITCH;
const STRIP_H = TEXT_ROWS * PITCH;
/** Cap box centred in the strip, leaving room for "$" and "%" overshoot. */
const CAP_TOP = (STRIP_H - CAP_PX) / 2;
const BASELINE = CAP_TOP + CAP_PX;
const TRI_W = CAP_PX * 1.25;

/** Coverage above which an emitter counts as lit. */
const LIT_THRESHOLD = 128;

const hexOf = (color: number) =>
  color === LIT_GREEN ? GREEN : color === LIT_RED ? RED : WHITE;

const font = () =>
  `700 ${FONT_PX}px "${FONT_FAMILY}", "Liberation Sans", sans-serif`;

const measureWith = (ctx: CanvasRenderingContext2D) => (e: Entry) =>
  e.kind === "tri" ? TRI_W : ctx.measureText(e.text).width;

/** Triangles are LED-lit shapes sampled onto the lattice, not font glyphs. */
const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  up: boolean,
) => {
  const top = CAP_TOP;
  const bottom = CAP_TOP + CAP_PX;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x + TRI_W / 2, top);
    ctx.lineTo(x + TRI_W, bottom);
    ctx.lineTo(x, bottom);
  } else {
    ctx.moveTo(x, top);
    ctx.lineTo(x + TRI_W, top);
    ctx.lineTo(x + TRI_W / 2, bottom);
  }
  ctx.closePath();
  ctx.fill();
};

export interface BandLeds {
  cols: number;
  /** cols * TEXT_ROWS lattice states, row-major. */
  map: Uint8Array;
}

const cache: (BandLeds | null)[] = BANDS.map(() => null);

export const getBandLeds = (index: number): BandLeds => {
  const cached = cache[index];
  if (cached) {
    return cached;
  }

  const { cols } = BANDS[index];
  const stripW = cols * PITCH;

  const canvas = makeCanvas(stripW, STRIP_H);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.font = font();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const content = buildBandContent(index, stripW, measureWith(ctx));

  for (let i = 0; i < content.entries.length; i++) {
    const e = content.entries[i];
    const x = content.offsets[i];
    ctx.fillStyle = hexOf(e.color);
    if (e.kind === "tri") {
      drawTriangle(ctx, x, e.up);
    } else {
      ctx.fillText(e.text, x, BASELINE);
    }
  }

  // Sample one pixel at every LED centre. Drawing onto a transparent strip
  // means the alpha channel is glyph coverage directly, which thresholds all
  // three emitter colours identically — a luminance read would thin the reds,
  // whose peak luminance is a third of white's.
  const data = ctx.getImageData(0, 0, stripW, STRIP_H).data;
  const map = new Uint8Array(cols * TEXT_ROWS);

  for (let r = 0; r < TEXT_ROWS; r++) {
    const py = Math.floor(r * PITCH + PITCH / 2);
    const rowBase = py * stripW;
    for (let c = 0; c < cols; c++) {
      const px = Math.floor(c * PITCH + PITCH / 2);
      const o = (rowBase + px) * 4;
      if (data[o + 3] < LIT_THRESHOLD) {
        continue;
      }
      const red = data[o];
      const green = data[o + 1];
      map[r * cols + c] =
        green > red * 1.3 ? LIT_GREEN : red > green * 1.3 ? LIT_RED : LIT_WHITE;
    }
  }

  const result: BandLeds = { cols, map };
  cache[index] = result;
  return result;
};

/** Drops the sampled lattice, e.g. if the webfont arrives after first paint. */
export const clearBandCache = () => {
  for (let i = 0; i < cache.length; i++) {
    cache[i] = null;
  }
};
