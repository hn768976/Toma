import { INTER } from "../../lib/fonts";
import { LOOP, LoopNoise } from "../../lib/loop";
import { gauss, mulberry32 } from "../../lib/random";
import { easeInOutCubic, easeOutCubic } from "../../lib/ease";

const rng = mulberry32(0xca7d1e);

// ---------------------------------------------------------------- candles
// 40 visible candles. The series shifts left one candle per 120 frames
// (5 shifts per loop). A candle's close is a trend fixed to its *screen slot*
// plus a detail term that repeats every 5 candles, so after 5 shifts the
// chart is exactly where it started, without a visible 5-candle pattern.

export const CANDLES = 40;
const SHIFT = 120;
const SLIDE = 14; // frames the slide takes at the start of each interval

const detail = Array.from({ length: 5 }, () => gauss(rng) * 0.55);
const wickUp = Array.from({ length: 5 }, () => 0.15 + Math.abs(gauss(rng)) * 0.5);
const wickDn = Array.from({ length: 5 }, () => 0.15 + Math.abs(gauss(rng)) * 0.5);
const trendNoise = new LoopNoise(rng, 48, 1);
const filled = Array.from({ length: 5 }, (_, i) => i === 2);

/** Slot-fixed trend, continuous in the slot coordinate x. */
const trend = (x: number) =>
  2.2 * Math.sin(x / 6.5 + 0.6) + 1.4 * Math.sin(x / 2.9 + 2.1) + 1.1 * trendNoise.at(x * 1.1) + x * 0.09;

const close = (i: number, x: number) => trend(x) + detail[((i % 5) + 5) % 5];

export interface Candle {
  x: number; // slot position (0 = leftmost, 39 = newest)
  open: number;
  close: number;
  high: number;
  low: number;
  filled: boolean;
}

export const candlesAt = (f: number): Candle[] => {
  const s = Math.floor(f / SHIFT);
  const S = s - 1 + easeInOutCubic(Math.min(1, (f % SHIFT) / SLIDE));
  const g = easeOutCubic((f % SHIFT) / SHIFT); // growth of the newest candle
  const newest = s + CANDLES - 1;
  const out: Candle[] = [];
  for (let i = newest - CANDLES - 1; i <= newest; i++) {
    const x = i - S;
    const k = ((i % 5) + 5) % 5;
    const o = close(i - 1, x - 1);
    let c = close(i, x);
    let up = wickUp[k];
    let dn = wickDn[k];
    if (i === newest) {
      c = o + (c - o) * g;
      up *= g;
      dn *= g;
    }
    out.push({ x, open: o, close: c, high: Math.max(o, c) + up, low: Math.min(o, c) - dn, filled: filled[k] });
  }
  return out;
};

/** Draw the candle layer into a transparent canvas (design 2000 x 1000). */
export const drawCandles = (ctx: CanvasRenderingContext2D, tw: number, f: number, color: string) => {
  const k = tw / 2000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, tw, tw / 2);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const cs = candlesAt(f);
  const slotW = 1900 / CANDLES;
  const xOf = (x: number) => 50 + (x + 0.5) * slotW;
  const yOf = (v: number) => 520 - v * 95;
  const lw = Math.max(2.6, 1.4 / k);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 * k;
  for (const c of cs) {
    // fade candles sliding in or out at the ends
    const a = Math.min(1, Math.max(0, c.x + 1), Math.max(0, CANDLES - c.x + 0.0));
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    const cx = xOf(c.x);
    const top = yOf(Math.max(c.open, c.close));
    const bot = yOf(Math.min(c.open, c.close));
    const bw = slotW * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, yOf(c.high));
    ctx.lineTo(cx, top);
    ctx.moveTo(cx, bot);
    ctx.lineTo(cx, yOf(c.low));
    ctx.stroke();
    const h = Math.max(lw, bot - top);
    if (c.filled) ctx.fillRect(cx - bw / 2, top, bw, h);
    else ctx.strokeRect(cx - bw / 2, top, bw, h);
  }
  // a moving average through the closes
  ctx.globalAlpha = 0.6;
  ctx.shadowBlur = 6 * k;
  ctx.beginPath();
  let first = true;
  for (const c of cs) {
    if (c.x < 0 || c.x > CANDLES - 1) continue;
    const y = yOf((c.open + c.close) / 2) - 70;
    if (first) ctx.moveTo(xOf(c.x), y);
    else ctx.lineTo(xOf(c.x), y);
    first = false;
  }
  ctx.stroke();
  // axis ticks with small labels at the right
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.7;
  ctx.font = `400 22px "${INTER}"`;
  for (let i = 0; i < 8; i++) {
    const y = 140 + i * 105;
    ctx.fillRect(1960, y, 16, lw);
    ctx.fillText(String(50 - i * 5), 1925, y + 8);
  }
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- line charts
// Horizontally periodic line textures (wrap S), scrolled by whole periods.

export const drawLineTexture = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string, jag: number) => {
  const r = mulberry32(seed);
  const n = 260;
  const v = new Float64Array(n + 1);
  let x = 0;
  for (let i = 0; i <= n; i++) {
    v[i] = x;
    x += gauss(r) * jag;
  }
  const drift = v[n];
  for (let i = 0; i <= n; i++) v[i] = v[i] - (drift * i) / n + 2.5 * Math.sin((2 * Math.PI * i * 2) / n + seed);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, v[i]);
    hi = Math.max(hi, v[i]);
  }
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  const yOf = (val: number) => h * 0.12 + ((hi - val) / (hi - lo)) * h * 0.76;
  const pass = (lineW: number, alpha: number, blur: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineW;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    // draw a little past both ends so the wrap seam is continuous
    for (let i = -2; i <= n + 2; i++) {
      const px = (i / n) * w;
      const py = yOf(v[((i % n) + n) % n]);
      if (i === -2) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };
  pass(Math.max(2, h / 140), 0.45, h / 40);
  pass(Math.max(1.5, h / 260), 1, 0);
};

/** Static grid layer: faint lines, axis ticks and labels. */
export const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, color: string) => {
  ctx.clearRect(0, 0, w, h);
  const k = w / 2000;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const x = i * 200;
    ctx.globalAlpha = i % 5 === 0 ? 0.32 : 0.14;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1000);
    ctx.stroke();
  }
  for (let j = 0; j <= 10; j++) {
    const y = j * 100;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(2000, y);
    ctx.stroke();
  }
  // axis with ticks and numbers
  ctx.globalAlpha = 0.6;
  ctx.font = `400 18px "${INTER}"`;
  for (const ax of [600, 1400]) {
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, 1000);
    ctx.stroke();
    for (let j = 0; j < 20; j++) {
      const y = 25 + j * 50;
      ctx.fillRect(ax, y, j % 2 ? 8 : 16, 2);
      if (j % 2 === 0) ctx.fillText(String(95 - j * 5), ax + 22, y + 7);
    }
  }
  // small text readouts
  const rt = mulberry32(0x7e47);
  ctx.globalAlpha = 0.55;
  ctx.font = `400 15px "${INTER}"`;
  for (let blk = 0; blk < 9; blk++) {
    const bx = 60 + rt() * 1800;
    const by = 60 + rt() * 860;
    for (let l = 0; l < 4 + Math.floor(rt() * 5); l++) {
      ctx.fillText(`${(rt() * 900).toFixed(2)}  ${(rt() * 99).toFixed(1)}  ${Math.floor(rt() * 9999)}`, bx, by + l * 20);
    }
  }
  // a strong vertical axis 60..20
  ctx.globalAlpha = 0.75;
  ctx.fillRect(1000, 80, 3, 860);
  ctx.font = `400 24px "${INTER}"`;
  for (let j = 0; j < 5; j++) {
    const y = 160 + j * 170;
    ctx.fillRect(1003, y, 18, 3);
    ctx.fillText(String(60 - j * 10), 1030, y + 9);
  }
  // scattered plus marks
  const r = mulberry32(0x6a1d);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 60; i++) {
    const x = r() * 2000;
    const y = r() * 1000;
    ctx.fillRect(x - 6, y - 1, 12, 2);
    ctx.fillRect(x - 1, y - 6, 2, 12);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

/** Soft horizontal streak (white core, transparent ends). */
export const drawStreak = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.7, "rgba(255,255,255,0.8)");
  g.addColorStop(0.95, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  for (let y = 0; y < h; y++) {
    const d = Math.abs(y + 0.5 - h / 2) / (h / 2);
    ctx.globalAlpha = Math.exp(-d * d * 6);
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;
};

export { LOOP };
