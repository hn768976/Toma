// Procedural textures for the clock spiral, drawn with Canvas 2D.
// Everything is generated from a seeded PRNG so every frame and every
// machine produces identical pixels (no fonts, no image files needed).

import { mulberry32 } from "./random";

export const DIAL_CELLS = 12; // I..XII, one numeral per cell
export const DIAL_CELL_W = 320;
export const DIAL_H = 384;

type Ctx = OffscreenCanvasRenderingContext2D;

// --- Roman numerals drawn as serif strokes ---------------------------------

const drawStroke = (
  ctx: Ctx,
  xTop: number,
  xBottom: number,
  top: number,
  bottom: number,
  w: number,
) => {
  ctx.beginPath();
  ctx.moveTo(xTop - w / 2, top);
  ctx.lineTo(xTop + w / 2, top);
  ctx.lineTo(xBottom + w / 2, bottom);
  ctx.lineTo(xBottom - w / 2, bottom);
  ctx.closePath();
  ctx.fill();
};

const serif = (ctx: Ctx, x: number, y: number, w: number, t: number) => {
  ctx.fillRect(x - w / 2, y - t / 2, w, t);
};

// Width of a glyph, in units of glyph height.
const GLYPH_W: Record<string, number> = { I: 0.2, V: 0.62, X: 0.62 };

const drawGlyph = (ctx: Ctx, ch: string, x: number, top: number, h: number) => {
  const thick = 0.17 * h;
  const thin = 0.065 * h;
  const sT = 0.05 * h; // serif thickness
  const bottom = top + h;
  const w = GLYPH_W[ch] * h;
  if (ch === "I") {
    const cx = x + w / 2;
    drawStroke(ctx, cx, cx, top, bottom, thick);
    serif(ctx, cx, top + sT / 2, thick + 0.16 * h, sT);
    serif(ctx, cx, bottom - sT / 2, thick + 0.16 * h, sT);
  } else if (ch === "V") {
    const cx = x + w / 2;
    drawStroke(ctx, x + thick / 2, cx, top, bottom, thick);
    drawStroke(ctx, x + w - thin / 2, cx, top, bottom, thin);
    serif(ctx, x + thick / 2, top + sT / 2, thick + 0.18 * h, sT);
    serif(ctx, x + w - thin / 2, top + sT / 2, thin + 0.16 * h, sT);
  } else if (ch === "X") {
    drawStroke(ctx, x + thick / 2, x + w - thick / 2, top, bottom, thick);
    drawStroke(ctx, x + w - thin / 2, x + thin / 2, top, bottom, thin);
    serif(ctx, x + thick / 2, top + sT / 2, thick + 0.14 * h, sT);
    serif(ctx, x + w - thin / 2, top + sT / 2, thin + 0.14 * h, sT);
    serif(ctx, x + thin / 2, bottom - sT / 2, thin + 0.14 * h, sT);
    serif(ctx, x + w - thick / 2, bottom - sT / 2, thick + 0.14 * h, sT);
  }
};

const NUMERALS = [
  "I",
  "II",
  "III",
  "IIII",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

const drawNumeral = (
  ctx: Ctx,
  text: string,
  cx: number,
  top: number,
  h: number,
  maxW: number,
) => {
  const gap = 0.05 * h;
  let total = 0;
  for (const ch of text) total += GLYPH_W[ch] * h;
  total += gap * (text.length - 1);
  // Squeeze wide numerals (VIII, XII...) horizontally to fit the cell.
  const sx = Math.min(1, maxW / total);
  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(sx, 1);
  let x = -total / 2;
  for (const ch of text) {
    drawGlyph(ctx, ch, x, top, h);
    x += GLYPH_W[ch] * h + gap;
  }
  ctx.restore();
};

// --- Dial strip --------------------------------------------------------------
// Channels: R = paper brightness, G = ink coverage, B = metal rim mask.
// Canvas row 0 is the OUTER edge of the band, the last row the INNER edge.

export const makeDialCanvas = (): OffscreenCanvas => {
  const W = DIAL_CELLS * DIAL_CELL_W;
  const H = DIAL_H;
  const rnd = mulberry32(7);

  // Ink layer (numerals + ticks) drawn in white on black, then packed.
  const ink = new OffscreenCanvas(W, H);
  const ic = ink.getContext("2d")!;
  ic.fillStyle = "#000";
  ic.fillRect(0, 0, W, H);
  ic.fillStyle = "#fff";
  ic.strokeStyle = "#fff";

  const trackTop = 38;
  const trackBottom = 66;
  ic.lineWidth = 3;
  ic.beginPath();
  ic.moveTo(0, trackTop);
  ic.lineTo(W, trackTop);
  ic.moveTo(0, trackBottom);
  ic.lineTo(W, trackBottom);
  ic.stroke();
  // Minute ticks: 5 per numeral cell, the one at the numeral is heavier.
  for (let i = 0; i < DIAL_CELLS * 5; i++) {
    const x = (i + 0.5) * (DIAL_CELL_W / 5);
    const major = i % 5 === 2;
    ic.fillRect(
      x - (major ? 5 : 2),
      trackTop,
      major ? 10 : 4,
      trackBottom - trackTop,
    );
  }
  for (let i = 0; i < DIAL_CELLS; i++) {
    const cx = (i + 0.5) * DIAL_CELL_W;
    drawNumeral(ic, NUMERALS[i], cx, 92, 190, DIAL_CELL_W * 0.84);
  }
  // Inner edge hairline.
  ic.fillRect(0, H - 30, W, 3);

  const inkData = ic.getImageData(0, 0, W, H).data;

  const out = new OffscreenCanvas(W, H);
  const oc = out.getContext("2d")!;
  const img = oc.createImageData(W, H);
  const d = img.data;

  // Low-frequency paper mottling (tileable horizontally).
  const blobs: { x: number; y: number; r: number; v: number }[] = [];
  for (let i = 0; i < 260; i++) {
    blobs.push({
      x: rnd() * W,
      y: rnd() * H,
      r: 20 + rnd() * 90,
      v: (rnd() - 0.5) * 0.22,
    });
  }
  const mottle = new Float32Array(W * H);
  for (const b of blobs) {
    for (const ox of [-W, 0, W]) {
      const x0 = Math.max(0, Math.floor(b.x + ox - b.r));
      const x1 = Math.min(W - 1, Math.ceil(b.x + ox + b.r));
      if (x1 < x0) continue;
      const y0 = Math.max(0, Math.floor(b.y - b.r));
      const y1 = Math.min(H - 1, Math.ceil(b.y + b.r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - b.x - ox;
          const dy = y - b.y;
          const q = 1 - (dx * dx + dy * dy) / (b.r * b.r);
          if (q > 0) mottle[y * W + x] += b.v * q * q;
        }
      }
    }
  }

  for (let y = 0; y < H; y++) {
    const ty = y / (H - 1);
    // Paper is brightest in the middle of the band, darker at both edges
    // (curl shading); the outer metal rim occupies the first rows.
    const edge =
      Math.min(1, ty / 0.12) *
      (1 - Math.pow(Math.max(0, (ty - 0.72) / 0.28), 1.6) * 0.8);
    const rim = ty < 0.07 ? 1 : ty < 0.085 ? 1 - (ty - 0.07) / 0.015 : 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const grain = (rnd() - 0.5) * 0.08;
      const paper = Math.max(
        0,
        Math.min(1, (0.86 + mottle[y * W + x] + grain) * edge),
      );
      let rimV = rim;
      let paperV = paper;
      // Small bright rivets studding the metal rim.
      const rx = (x % (DIAL_CELL_W / 5)) - DIAL_CELL_W / 10;
      const ry = y - 13;
      const rr = rx * rx + ry * ry;
      if (rr < 55) {
        const k = 1 - rr / 55;
        rimV = 1 - k;
        paperV = Math.max(paperV, k);
      }
      d[i] = paperV * 255;
      d[i + 1] = inkData[i] * (0.85 + rnd() * 0.15);
      d[i + 2] = rimV * 255;
      d[i + 3] = 255;
    }
  }
  oc.putImageData(img, 0, 0);
  return out;
};

// --- Tileable value-noise fBm (smoke) ---------------------------------------

export const makeNoiseCanvas = (size = 256): OffscreenCanvas => {
  const rnd = mulberry32(11);
  const out = new OffscreenCanvas(size, size);
  const oc = out.getContext("2d")!;
  const img = oc.createImageData(size, size);
  const field = (period: number, seedRnd: () => number) => {
    const g = new Float32Array(period * period).map(() => seedRnd());
    return (x: number, y: number) => {
      const fx = (x / size) * period;
      const fy = (y / size) * period;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const at = (a: number, b: number) =>
        g[
          (((b % period) + period) % period) * period +
            (((a % period) + period) % period)
        ];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const octA = [4, 8, 16, 32].map((p) => field(p, rnd));
  const octB = [3, 6, 12, 24].map((p) => field(p, rnd));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0;
      let b = 0;
      let amp = 0.5;
      for (let o = 0; o < 4; o++) {
        a += octA[o](x, y) * amp;
        b += octB[o](x, y) * amp;
        amp *= 0.5;
      }
      const i = (y * size + x) * 4;
      img.data[i] = (a / 0.9375) * 255;
      img.data[i + 1] = (b / 0.9375) * 255;
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
  oc.putImageData(img, 0, 0);
  return out;
};
