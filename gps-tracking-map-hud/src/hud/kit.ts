// Canvas 2D HUD drawing kit. All coordinates are 4K composition pixels.
// All "data" is invented and deterministic: values depend only on the frame.
import { hash01 } from '../lib/rng';
import { MONO, LABEL } from '../lib/fonts';
import { LOOP } from '../city';

export type Ctx = CanvasRenderingContext2D;
export const lf = (f: number) => ((f % LOOP) + LOOP) % LOOP;
export const TAU = Math.PI * 2;

export interface Theme {
  text: string; // primary text
  dim: string; // secondary text
  faint: string; // hairlines
  accent: string; // highlight colour
  accent2: string; // secondary highlight
  panel: string; // panel fill
  panelEdge: string;
}

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// integer in [0, 10^digits) that changes every `period` frames (period divides LOOP)
export const tick = (id: number, f: number, period: number, digits = 2) => {
  const k = Math.floor(lf(f) / period);
  return Math.floor(hash01(id, k) * 10 ** digits);
};
export const pad = (n: number, d: number) => String(Math.abs(Math.floor(n))).padStart(d, '0');
// smooth periodic value in [lo, hi]
export const wave = (id: number, f: number, lo: number, hi: number, cycles = 1) => {
  const ph = hash01(id, 99) * TAU;
  const t = (lf(f) / LOOP) * TAU * cycles;
  return lo + (hi - lo) * (0.5 + 0.35 * Math.sin(t + ph) + 0.15 * Math.sin(2 * t + ph * 1.7));
};
export const fixedNum = (id: number, digits: number) => pad(Math.floor(hash01(id, 7) * 10 ** digits), digits);

export function text(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, opts: { font?: 'mono' | 'label'; weight?: number; align?: CanvasTextAlign; spacing?: number } = {}) {
  ctx.font = `${opts.weight ?? (opts.font === 'label' ? 600 : 400)} ${size}px ${opts.font === 'label' ? LABEL : MONO}`;
  ctx.fillStyle = color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${opts.spacing ?? 0}px`;
  ctx.fillText(s, x, y);
  (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill?: string, stroke?: string, lw = 2) {
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// rows of tiny orderly data: fixed-width columns of codes and numbers
export function dataRows(ctx: Ctx, x: number, y: number, rows: number, cols: number[], id: number, f: number, th: Theme, size = 24, lh = 34, live = 2) {
  for (let r = 0; r < rows; r++) {
    let cx = x;
    cols.forEach((digits, c) => {
      const isLive = c >= cols.length - live;
      const v = isLive ? tick(id * 31 + r * 7 + c, f + r * 3, 20 + 10 * ((r + c) % 3), digits) : Math.floor(hash01(id, r, c) * 10 ** digits);
      const s = c === 0 ? 'X' + pad(v, digits) : pad(v, digits);
      text(ctx, s, cx, y + r * lh, size, c === 0 ? th.text : isLive ? th.text : th.dim);
      cx += (digits + 1.6) * size * 0.56 + (c === 0 ? size * 0.6 : 0);
    });
  }
}

// a horizontal bar meter with a moving fill
export function barMeter(ctx: Ctx, x: number, y: number, w: number, h: number, v: number, th: Theme, color?: string) {
  rect(ctx, x, y, w, h, rgba(th.faint, 0.35));
  rect(ctx, x, y, w * Math.max(0, Math.min(1, v)), h, color ?? th.text);
}

// segmented bar (ticks)
export function segBar(ctx: Ctx, x: number, y: number, w: number, h: number, n: number, v: number, th: Theme, color?: string) {
  const gap = 3, sw = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) rect(ctx, x + i * (sw + gap), y, sw, h, i / n < v ? (color ?? th.text) : rgba(th.faint, 0.35));
}

// thin round gauge: background ring + arc + centre number
export function gauge(ctx: Ctx, cx: number, cy: number, r: number, v: number, th: Theme, color?: string, label?: string, lw = 6) {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = rgba(th.faint, 0.5);
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = color ?? th.accent;
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * v); ctx.stroke();
  if (label !== undefined) text(ctx, label, cx, cy + r * 0.22, r * 0.62, th.text, { align: 'center' });
}

// open "C" gauge like a dial: arc with gap + small tick
export function cGauge(ctx: Ctx, cx: number, cy: number, r: number, v: number, th: Theme, color: string, lw = 7) {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = rgba(th.faint, 0.45);
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * v); ctx.stroke();
}

export function toggle(ctx: Ctx, x: number, y: number, on: boolean, th: Theme, w = 54, h = 24) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = on ? th.accent : th.dim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = on ? th.accent : th.dim;
  ctx.beginPath();
  ctx.arc(on ? x + w - h / 2 : x + h / 2, y + h / 2, h / 2 - 5, 0, TAU);
  ctx.fill();
}

export function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, len: number, color: string, lw = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
  ctx.stroke();
}

export function cross(ctx: Ctx, x: number, y: number, s: number, color: string, lw = 2) {
  line(ctx, x - s, y, x + s, y, color, lw);
  line(ctx, x, y - s, x, y + s, color, lw);
}

// scrolling waveform strip (periodic in LOOP)
export function waveform(ctx: Ctx, x: number, y: number, w: number, h: number, f: number, id: number, color: string, bars = true) {
  const n = Math.floor(w / 7);
  const shift = (lf(f) / LOOP) * n; // scrolls exactly n bars per loop -> periodic
  for (let i = 0; i < n; i++) {
    const k = i + shift;
    const k0 = Math.floor(k), fr = k - k0;
    const a = (j: number) => {
      const jj = ((j % n) + n) % n;
      const env = 0.35 + 0.65 * Math.abs(Math.sin((jj / n) * TAU * 3 + id));
      return env * (0.25 + 0.75 * hash01(id, jj));
    };
    const amp = a(k0) * (1 - fr) + a(k0 + 1) * fr;
    if (bars) rect(ctx, x + i * 7, y + h / 2 - (amp * h) / 2, 3, Math.max(2, amp * h), color);
  }
}

// small "thumbnail" box with a big number and a caption
export function numBox(ctx: Ctx, x: number, y: number, w: number, h: number, value: string, caption: string, th: Theme) {
  // grey gradient tile, small number top-right, caption bottom-left, corner notch
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, rgba(th.dim, 0.55));
  g.addColorStop(1, rgba(th.faint, 0.18));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  rect(ctx, x, y, w, h, undefined, rgba(th.dim, 0.6), 2);
  text(ctx, value, x + w - 10, y + h * 0.42, h * 0.34, th.text, { align: 'right' });
  text(ctx, caption, x + 10, y + h - 12, h * 0.15, th.text);
  ctx.fillStyle = rgba(th.text, 0.7);
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + 14, y + h); ctx.lineTo(x, y + h - 14); ctx.fill();
}

export function heading(ctx: Ctx, s: string, x: number, y: number, th: Theme, size = 40, color?: string) {
  text(ctx, s, x, y, size, color ?? th.text, { font: 'label', weight: 600, spacing: size * 0.06 });
}

import { isLand } from '../render/geo';
// dot-matrix flat world map (equirectangular, Natural Earth land mask)
export function worldMap(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, step = 9, r = 2.6) {
  ctx.fillStyle = color;
  const cols = Math.floor(w / step), rows = Math.floor(h / step);
  for (let j = 0; j < rows; j++) {
    const lat = 82 - (j / rows) * 140;
    for (let i = 0; i < cols; i++) {
      const lon = -180 + (i / cols) * 360;
      if (isLand(lon, lat)) { ctx.beginPath(); ctx.arc(x + i * step + step / 2, y + j * step + step / 2, r, 0, TAU); ctx.fill(); }
    }
  }
}

// odometer-style rolling digit string; `from`/`to` digit strings, t in [0,1]
export function odometer(ctx: Ctx, x: number, y: number, from: string, to: string, t: number, size: number, th: Theme, boxColor: string, dotColor: string) {
  const cw = size * 0.78;
  let cx = x;
  const e = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
  for (let i = 0; i < to.length; i++) {
    const ch = to[i];
    if (ch === '-') {
      text(ctx, '-', cx + cw * 0.25, y, size, th.dim, { align: 'center' });
      cx += cw * 0.5;
      continue;
    }
    const a = Number(from[i] ?? '0'), b = Number(ch);
    const spins = 1 + (i % 3);
    const total = ((b - a + 10) % 10) + 10 * spins;
    const stagger = Math.min(1, Math.max(0, e * 1.25 - (i / to.length) * 0.25));
    const pos = a + total * stagger;
    const d0 = Math.floor(pos) % 10, fr = pos - Math.floor(pos);
    rect(ctx, cx, y - size * 0.95, cw * 0.86, size * 1.2, 'rgba(60,64,70,0.55)', rgba(boxColor, 0.3), 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, y - size * 0.95, cw * 0.86, size * 1.2);
    ctx.clip();
    text(ctx, String(d0), cx + cw * 0.43, y - fr * size * 1.2, size, rgba(th.text, 0.85), { align: 'center' });
    text(ctx, String((d0 + 1) % 10), cx + cw * 0.43, y + (1 - fr) * size * 1.2, size, rgba(th.text, 0.85), { align: 'center' });
    ctx.restore();
    ctx.fillStyle = dotColor;
    ctx.fillRect(cx + cw * 0.86 + 2, y + size * 0.12, 6, 6);
    cx += cw;
  }
}
