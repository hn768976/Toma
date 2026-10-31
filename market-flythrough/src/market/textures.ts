import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
} from "three";

export const FONT = "OswaldMarket";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const finish = (canvas: HTMLCanvasElement) => {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 8;
  return tex;
};

/**
 * LED-panel look: knock out thin horizontal lines. Invisible from afar
 * (mip-mapped away), but up close the glyphs break into glowing bars just
 * like the reference's macro shots.
 */
const scanlines = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  period: number,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  const gap = Math.max(1, Math.round(period * 0.34));
  for (let y = 0; y < h; y += period) ctx.fillRect(0, y, w, gap);
  ctx.restore();
};

const triangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  up: boolean,
) => {
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y - s * 0.55);
    ctx.lineTo(x + s * 0.55, y + s * 0.4);
    ctx.lineTo(x - s * 0.55, y + s * 0.4);
  } else {
    ctx.moveTo(x, y + s * 0.55);
    ctx.lineTo(x + s * 0.55, y - s * 0.4);
    ctx.lineTo(x - s * 0.55, y - s * 0.4);
  }
  ctx.closePath();
  ctx.fill();
};

export type TableSpec = {
  rows: number;
  /** Columns: symbol, price, price, change, % (fewer = narrower table). */
  columns: 3 | 4 | 5;
  /** Row height in canvas pixels; bigger = crisper close-ups. */
  rowPx: number;
};

/** A ticker table (white glyphs; tinted by the material colour). */
export const makeTableTexture = (spec: TableSpec, rand: () => number) => {
  const { rows, columns, rowPx } = spec;
  const font = Math.round(rowPx * 0.78);
  const colW = [
    rowPx * 1.75,
    rowPx * 2.7,
    rowPx * 2.75,
    rowPx * 2.25,
    rowPx * 2.7,
  ].slice(0, columns);
  const w = Math.ceil(colW.reduce((a, b) => a + b, 0) + rowPx * 0.6);
  const h = Math.ceil(rows * rowPx + rowPx * 0.6);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = "middle";
  ctx.font = `${font}px ${FONT}`;
  for (let r = 0; r < rows; r++) {
    const y = rowPx * 0.3 + r * rowPx + rowPx / 2;
    const sym = Array.from(
      { length: 3 },
      () => LETTERS[Math.floor(rand() * 26)],
    ).join("");
    const p1 = 100 + rand() * 1400;
    const p2 = p1 * (1.12 + rand() * 0.2);
    const ch = p2 - p1;
    const pct = (ch / p1) * 100;
    const up = rand() > 0.12;
    const alpha = 0.78 + rand() * 0.22;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    let x = rowPx * 0.3;
    const cells = [
      sym,
      p1.toFixed(2),
      p2.toFixed(2),
      ch.toFixed(2),
      `${pct.toFixed(2)}%`,
    ];
    for (let c = 0; c < columns; c++) {
      if (c === 4) {
        triangle(ctx, x + font * 0.3, y, font * 0.55, up);
        ctx.textAlign = "left";
        ctx.fillText(cells[c], x + font * 0.75, y);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(cells[c], x, y);
      }
      x += colW[c];
    }
  }
  scanlines(ctx, w, h, Math.max(3, Math.round(rowPx / 14)));
  return { texture: finish(canvas), aspect: w / h };
};

/** Candlestick strip trending upward. */
export const makeCandleTexture = (count: number, rand: () => number) => {
  const w = 2048;
  const h = 768;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const step = w / count;
  let v = h * 0.8;
  for (let i = 0; i < count; i++) {
    const drift = -h * 0.006;
    const open = v;
    const close = v + drift + (rand() - 0.5) * h * 0.07;
    const hi = Math.min(open, close) - rand() * h * 0.05;
    const lo = Math.max(open, close) + rand() * h * 0.05;
    const x = i * step + step / 2;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(x - step * 0.06, hi, step * 0.12, lo - hi);
    const top = Math.min(open, close);
    const bh = Math.max(4, Math.abs(close - open));
    if (close < open) {
      ctx.fillRect(x - step * 0.3, top, step * 0.6, bh);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = step * 0.1;
      ctx.strokeRect(x - step * 0.27, top, step * 0.54, bh);
    }
    v = Math.min(h * 0.92, Math.max(h * 0.08, close));
  }
  scanlines(ctx, w, h, 6);
  return { texture: finish(canvas), aspect: w / h };
};

/** Lens-flare star: hot core, soft halo and thin anamorphic rays. */
export const makeFlareTexture = () => {
  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const c = s / 2;
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
  halo.addColorStop(0, "rgba(255,255,255,1)");
  halo.addColorStop(0.04, "rgba(255,255,255,0.9)");
  halo.addColorStop(0.12, "rgba(255,255,255,0.25)");
  halo.addColorStop(0.4, "rgba(255,255,255,0.05)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = "lighter";
  const ray = (angle: number, len: number, width: number, alpha: number) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(-len, 0, len, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-len, -width / 2, len * 2, width);
    ctx.restore();
  };
  ray(0, c, 3, 0.8);
  ray(Math.PI / 2, c * 0.7, 2.5, 0.55);
  ray(Math.PI / 4, c * 0.45, 2, 0.35);
  ray(-Math.PI / 4, c * 0.45, 2, 0.35);
  ray(0.18, c * 0.6, 1.5, 0.25);
  ray(-0.6, c * 0.5, 1.5, 0.22);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};

/** Soft radial blob used for the big centre glow. */
export const makeGlowTexture = () => {
  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.55)");
  g.addColorStop(0.65, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
};
