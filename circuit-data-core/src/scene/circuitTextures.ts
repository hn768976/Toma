import { mulberry32, range, Rng } from "./random";

// Procedural, tileable printed-circuit-board textures drawn with Canvas 2D.
//  - "base": dark board with chip footprints, pin rows, pads and dim traces
//  - "glow": only the energised traces / pads (white on black, tinted in shader)
// Each is produced in three focus levels (sharp, soft, very soft) which the
// floor shader blends between to fake a shallow depth of field.

export const TILE = 2048;

type Ctx = CanvasRenderingContext2D;

const makeCanvas = (size: number) => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas not available");
  }
  return { c, ctx };
};

// Manhattan / 45° trace starting at (x, y).
const tracePath = (rng: Rng, x: number, y: number, step: number) => {
  const pts: [number, number][] = [[x, y]];
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  let d = dirs[Math.floor(rng() * 4)];
  const segs = 2 + Math.floor(rng() * 5);
  for (let i = 0; i < segs; i++) {
    const len = step * (1 + Math.floor(rng() * 6));
    x += d[0] * len;
    y += d[1] * len;
    pts.push([x, y]);
    // turn by ±45° or ±90°
    const idx = dirs.findIndex((v) => v[0] === d[0] && v[1] === d[1]);
    const turnOpts = idx < 4 ? [4, 5, 6, 7] : [0, 1, 2, 3];
    const cand = dirs[turnOpts[Math.floor(rng() * 4)]];
    if (cand[0] * d[0] + cand[1] * d[1] >= 0) {
      d = cand;
    }
  }
  return pts;
};

const strokePath = (ctx: Ctx, pts: [number, number][]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) {
    ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
};

const drawBoard = (base: Ctx, glow: Ctx, seed: number, size: number) => {
  const rng = mulberry32(seed);
  // Board colour
  base.fillStyle = "#060a16";
  base.fillRect(0, 0, size, size);
  glow.fillStyle = "#000";
  glow.fillRect(0, 0, size, size);

  // Fine grid of tiny solder points
  const fine = size / 128;
  base.fillStyle = "rgba(90,110,160,0.18)";
  for (let gy = 0; gy < 128; gy++) {
    for (let gx = 0; gx < 128; gx++) {
      if (rng() < 0.22) {
        base.fillRect(gx * fine + fine * 0.35, gy * fine + fine * 0.35, fine * 0.3, fine * 0.3);
      }
    }
  }

  // Chip footprints with pin rows
  const chips = 40;
  for (let i = 0; i < chips; i++) {
    const w = range(rng, 0.05, 0.16) * size;
    const h = w * range(rng, 0.4, 1.2);
    const x = Math.floor(rng() * (size - w));
    const y = Math.floor(rng() * (size - h));
    base.fillStyle = `rgba(${18 + rng() * 10},${24 + rng() * 12},${44 + rng() * 20},1)`;
    base.fillRect(x, y, w, h);
    base.strokeStyle = "rgba(70,95,150,0.55)";
    base.lineWidth = 2;
    base.strokeRect(x, y, w, h);
    // pins on two or four sides
    const pin = size * 0.004;
    const gap = pin * 2.4;
    base.fillStyle = "rgba(150,170,210,0.55)";
    for (let px = x + gap; px < x + w - gap; px += gap) {
      base.fillRect(px, y - pin * 2.2, pin, pin * 1.8);
      base.fillRect(px, y + h + pin * 0.4, pin, pin * 1.8);
    }
    if (rng() < 0.5) {
      for (let py = y + gap; py < y + h - gap; py += gap) {
        base.fillRect(x - pin * 2.2, py, pin * 1.8, pin);
        base.fillRect(x + w + pin * 0.4, py, pin * 1.8, pin);
      }
    }
    // inner grid of cells on some chips
    if (rng() < 0.5) {
      const cs = size * 0.006;
      base.fillStyle = "rgba(60,80,140,0.6)";
      for (let cy = y + cs; cy < y + h - cs; cy += cs * 1.8) {
        for (let cx = x + cs; cx < x + w - cs; cx += cs * 1.8) {
          if (rng() < 0.7) base.fillRect(cx, cy, cs, cs * 0.7);
        }
      }
    }
  }

  // Traces: many dim ones on the base, a subset energised on the glow layer.
  base.lineCap = "square";
  glow.lineCap = "round";
  glow.lineJoin = "round";
  const step = size / 96;
  for (let i = 0; i < 520; i++) {
    const x = Math.round((rng() * size) / step) * step;
    const y = Math.round((rng() * size) / step) * step;
    const pts = tracePath(rng, x, y, step);
    const w = range(rng, 1.5, 4.5);
    base.strokeStyle = `rgba(${40 + rng() * 30},${70 + rng() * 40},${130 + rng() * 60},${range(rng, 0.35, 0.8)})`;
    base.lineWidth = w;
    strokePath(base, pts);
    // via pads at ends
    base.fillStyle = "rgba(160,180,220,0.6)";
    const [ex, ey] = pts[pts.length - 1];
    base.beginPath();
    base.arc(ex, ey, w * 1.6, 0, Math.PI * 2);
    base.fill();

    if (rng() < 0.24) {
      const bright = range(rng, 0.45, 1);
      glow.strokeStyle = `rgba(255,255,255,${bright})`;
      glow.lineWidth = w * 2.6;
      strokePath(glow, pts);
      glow.fillStyle = `rgba(255,255,255,${bright})`;
      glow.beginPath();
      glow.arc(ex, ey, w * 2.2, 0, Math.PI * 2);
      glow.fill();
    }
  }

  // Bright white SMD pads / LEDs — they bloom into bokeh discs when defocused.
  for (let i = 0; i < 160; i++) {
    const s = size * range(rng, 0.004, 0.013);
    const x = rng() * size;
    const y = rng() * size;
    base.fillStyle = `rgba(210,225,255,${range(rng, 0.5, 0.95)})`;
    base.fillRect(x, y, s, s * range(rng, 0.6, 1));
    if (rng() < 0.4) {
      glow.fillStyle = "rgba(255,255,255,0.9)";
      glow.fillRect(x, y, s, s);
    }
  }
};

// Draw a tile 3x3 times, blur, and crop the centre so blurred tiles stay seamless.
const blurTile = (src: HTMLCanvasElement, blurPx: number, outSize: number) => {
  const big = makeCanvas(src.width * 3);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      big.ctx.drawImage(src, x * src.width, y * src.width);
    }
  }
  const blurred = makeCanvas(src.width * 3);
  blurred.ctx.filter = `blur(${blurPx}px)`;
  blurred.ctx.drawImage(big.c, 0, 0);
  const out = makeCanvas(outSize);
  out.ctx.drawImage(blurred.c, src.width, src.width, src.width, src.width, 0, 0, outSize, outSize);
  return out.c;
};

export type CircuitCanvases = {
  base: HTMLCanvasElement[];
  glow: HTMLCanvasElement[];
};

export const createCircuitCanvases = (seed: number): CircuitCanvases => {
  const base = makeCanvas(TILE);
  const glow = makeCanvas(TILE);
  drawBoard(base.ctx, glow.ctx, seed, TILE);
  return {
    base: [base.c, blurTile(base.c, 10, 1024), blurTile(base.c, 24, 512)],
    glow: [glow.c, blurTile(glow.c, 10, 1024), blurTile(glow.c, 24, 512)],
  };
};

// Fine circuitry etched onto the cube's glass (glow-only, white on black).
export const createCubeTraceCanvas = (seed: number) => {
  const size = 1024;
  const { c, ctx } = makeCanvas(size);
  const rng = mulberry32(seed);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const step = size / 48;
  for (let i = 0; i < 70; i++) {
    const x = Math.round((rng() * size) / step) * step;
    const y = Math.round((rng() * size) / step) * step;
    const pts = tracePath(rng, x, y, step);
    ctx.strokeStyle = `rgba(255,255,255,${range(rng, 0.35, 1)})`;
    ctx.lineWidth = range(rng, 1.5, 4);
    strokePath(ctx, pts);
  }
  return c;
};
