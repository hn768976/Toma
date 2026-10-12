// Data-strip texture atlas: rows of tiny JetBrains Mono text, dots and small
// rectangles, drawn once into a canvas after the font has loaded. Seeded.
import { irange, mulberry32, pick, range } from "../lib/random";

export const ATLAS_ROWS = 48;
export const ROW_H = 40;
export const ATLAS_TEX_W = 4096;
export const ATLAS_TEX_H = ATLAS_ROWS * ROW_H; // 1920

const WORDS = [
  "SYS", "MEM", "NODE", "SYNC", "DATA", "CORE", "FLUX", "GRID", "ADDR", "PKT", "CACHE", "PROC",
  "IO", "BUS", "NET", "TX", "RX", "ACK", "HASH", "KEY", "VAL", "QUEUE", "SEG", "MAP", "INIT", "EXEC",
];

const hex = (rng: () => number, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789ABCDEF"[Math.floor(rng() * 16)];
  return s;
};
const num = (rng: () => number, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 10);
  return s;
};

const token = (rng: () => number) => {
  const r = rng();
  if (r < 0.55) return num(rng, irange(rng, 2, 6));
  if (r < 0.65) return "0x" + hex(rng, irange(rng, 2, 6));
  if (r < 0.75) return pick(rng, WORDS) + (rng() < 0.5 ? "." + pick(rng, WORDS) : "_" + num(rng, 2));
  if (r < 0.92) return num(rng, irange(rng, 1, 3)) + "." + num(rng, irange(rng, 2, 4));
  return pick(rng, WORDS).toLowerCase() + "(" + num(rng, irange(rng, 1, 3)) + ")";
};

/** Draws the atlas. White on transparent; the shader colours and fades it. */
export const drawStripAtlas = (fontFamily: string): HTMLCanvasElement => {
  const rng = mulberry32(0xda7a5);
  const c = document.createElement("canvas");
  c.width = ATLAS_TEX_W;
  c.height = ATLAS_TEX_H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#ffffff";
  g.textBaseline = "middle";
  for (let row = 0; row < ATLAS_ROWS; row++) {
    const y0 = row * ROW_H;
    const cy = y0 + ROW_H / 2;
    const style = rng();
    let x = range(rng, 0, 80);
    while (x < ATLAS_TEX_W - 40) {
      const r = rng();
      if (r < 0.42) {
        // A run of text tokens.
        const size = pick(rng, [13, 15, 17, 20]);
        g.font = `${size}px "${fontFamily}"`;
        g.globalAlpha = range(rng, 0.45, 1);
        const n = irange(rng, 1, 4);
        let s = "";
        for (let i = 0; i < n; i++) s += token(rng) + (i < n - 1 ? "  " : "");
        const yy = style < 0.5 ? cy : cy + (rng() < 0.5 ? -9 : 9);
        g.fillText(s, x, yy);
        x += g.measureText(s).width + range(rng, 20, 140);
      } else if (r < 0.75) {
        // A row of dots.
        g.globalAlpha = range(rng, 0.4, 1);
        const n = irange(rng, 4, 30);
        const step = pick(rng, [6, 8, 10, 14]);
        const d = pick(rng, [2, 2, 3, 4]);
        for (let i = 0; i < n; i++) if (rng() < 0.8) g.fillRect(x + i * step, cy - d / 2, d, d);
        x += n * step + range(rng, 20, 120);
      } else if (r < 0.88) {
        // Small rectangles / bars.
        g.globalAlpha = range(rng, 0.3, 0.9);
        const n = irange(rng, 1, 5);
        for (let i = 0; i < n; i++) {
          const w = range(rng, 6, 40);
          const h = range(rng, 3, 12);
          g.fillRect(x, cy - h / 2, w, h);
          x += w + range(rng, 4, 14);
        }
        x += range(rng, 30, 180);
      } else {
        // Thin rule.
        g.globalAlpha = range(rng, 0.15, 0.45);
        const w = range(rng, 60, 400);
        g.fillRect(x, cy - 0.75, w, 1.5);
        x += w + range(rng, 20, 120);
      }
    }
  }
  g.globalAlpha = 1;
  return c;
};
