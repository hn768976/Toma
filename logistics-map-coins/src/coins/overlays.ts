import type {Polygon} from '../lib/geo';
import {tracePolygons} from '../lib/geo';
import {mulberry32} from '../lib/random';
import {clamp, easeInOut, smoothstep} from '../lib/anim';

// Finance double-exposure overlays, drawn with Canvas 2D at the output
// resolution and screen-blended over the 3D scene in the final pass.
// Everything is abstract: glyph-like bars instead of text, invented axis
// values, no tickers or price-like numbers.

export type OverlayKind = 'financeBlue' | 'candlesWarm' | 'barsBlue';

export const LW = 3840; // logical overlay space (4K)
export const LH = 2160;

export type OverlayFrame = {
  progress: number; // 0..1 growth progress (chart draw-on)
  anchors: {x: number; y: number}[]; // stack tops in logical px (final heights)
  frame: number;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// Glyph-like row of short bars, standing in for table text.
const glyphRow = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: () => number) => {
  let cx = x;
  while (cx < x + w) {
    const gw = h * (0.4 + rng() * 2.6);
    ctx.fillRect(cx, y, gw, h);
    cx += gw + h * (0.5 + rng() * 1.2);
  }
};

const ringChart = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frac: number, lw: number) => {
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.globalAlpha *= 0.4;
  ctx.stroke();
  ctx.globalAlpha /= 0.4;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.stroke();
};

const arrow = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x - size * 0.6, y - size * 0.35);
  ctx.lineTo(x - size * 0.22, y - size * 0.35);
  ctx.lineTo(x - size * 0.22, y + size);
  ctx.lineTo(x + size * 0.22, y + size);
  ctx.lineTo(x + size * 0.22, y - size * 0.35);
  ctx.lineTo(x + size * 0.6, y - size * 0.35);
  ctx.closePath();
  ctx.fill();
};

// ---- static backgrounds (built once per size) --------------------------------

const financeBlueStatic = (w: number, h: number) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const s = w / LW;
  ctx.scale(s, s);
  const rng = mulberry32(0xb1e);
  const g = ctx.createLinearGradient(0, 0, LW, LH);
  g.addColorStop(0, 'rgba(120,175,215,0.85)');
  g.addColorStop(0.5, 'rgba(150,195,228,0.75)');
  g.addColorStop(1, 'rgba(185,215,240,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  // city-block silhouettes (abstract)
  ctx.fillStyle = 'rgba(225,240,250,0.18)';
  for (let i = 0; i < 26; i++) {
    const bw = 90 + rng() * 220;
    const bh = 300 + rng() * 900;
    const x = rng() * LW;
    ctx.fillRect(x, LH * 0.62 - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let wy = LH * 0.62 - bh + 20; wy < LH * 0.6; wy += 34) ctx.fillRect(x + 12, wy, bw - 24, 10);
    ctx.fillStyle = 'rgba(225,240,250,0.18)';
  }
  ctx.filter = `blur(${10 * s}px)`;
  ctx.drawImage(c, 0, 0, LW, LH);
  ctx.filter = 'none';
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let x = 0; x < LW; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LH);
    ctx.stroke();
  }
  for (let y = 0; y < LH; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LW, y);
    ctx.stroke();
  }
  // data tables (glyph rows)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  const tables = [
    [80, 120, 900, 16],
    [2900, 160, 850, 14],
    [120, 1250, 700, 10],
    [3000, 1100, 700, 12],
  ];
  for (const [x, y, tw, rows] of tables) {
    for (let r = 0; r < rows; r++) glyphRow(ctx, x, y + r * 46, tw * (0.55 + rng() * 0.45), 16, rng);
  }
  // ring charts
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ringChart(ctx, 1080, 120, 85, 0.68, 22);
  ringChart(ctx, 2560, 170, 60, 0.42, 16);
  ringChart(ctx, 3500, 900, 70, 0.8, 18);
  // small bar chart and line chart with dots
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 22; i++) ctx.fillRect(60 + i * 30, 1020 - (60 + rng() * 140), 16, 60 + rng() * 140);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const x = 1500 + i * 90;
    const y = 420 - i * 14 + Math.sin(i * 1.7) * 50;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // axis on the right
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(3330, 60);
  ctx.lineTo(3330, 1900);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 44px "JetBrains Mono"';
  ['A-90', 'A-75', 'A-60', 'A-45', 'A-30'].forEach((t, i) => {
    ctx.fillRect(3330, 140 + i * 360, 26, 4);
    ctx.fillText(t, 3380, 156 + i * 360);
  });
  // soft blur of everything except the axis is fine: the reference is soft
  const out = makeCanvas(w, h);
  const o = out.getContext('2d')!;
  o.filter = `blur(${2.2 * s}px)`;
  o.drawImage(c, 0, 0);
  return out;
};

const candlesWarmStatic = (w: number, h: number, land: Polygon[] | null) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const s = w / LW;
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, 0, LW, 0);
  g.addColorStop(0, 'rgba(250,175,110,0.95)');
  g.addColorStop(0.35, 'rgba(235,170,140,0.8)');
  g.addColorStop(0.6, 'rgba(150,185,215,0.8)');
  g.addColorStop(1, 'rgba(105,165,215,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  // soft warm/cool light blobs
  const rng = mulberry32(0xca5d);
  for (let i = 0; i < 18; i++) {
    const x = rng() * LW;
    const y = rng() * LH;
    const r = 120 + rng() * 380;
    const warm = x < LW * 0.45;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, warm ? 'rgba(255,215,160,0.45)' : 'rgba(200,230,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // faint world-map shape
  if (land) {
    ctx.save();
    ctx.translate(250, 160);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    tracePolygons(ctx, land, 3400, 1700, [-170, 190, -60, 85]);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  ctx.filter = `blur(${6 * s}px)`;
  ctx.drawImage(c, 0, 0, LW, LH);
  ctx.filter = 'none';
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2.5;
  for (let x = 0; x < LW; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LH);
    ctx.stroke();
  }
  for (let y = 30; y < LH; y += 150) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LW, y);
    ctx.stroke();
  }
  return c;
};

const barsBlueStatic = (w: number, h: number) => {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const s = w / LW;
  ctx.scale(s, s);
  const rng = mulberry32(0xba25);
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, 'rgba(150,190,222,0.9)');
  g.addColorStop(1, 'rgba(95,140,185,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  // large faint architectural panels
  ctx.fillStyle = 'rgba(235,245,255,0.16)';
  for (let i = 0; i < 9; i++) {
    const x = rng() * LW;
    const bw = 300 + rng() * 600;
    ctx.save();
    ctx.translate(x, 0);
    ctx.transform(1, 0, -0.25 + rng() * 0.5, 1, 0, 0);
    ctx.fillRect(0, rng() * 300, bw, LH);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const x = rng() * LW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rng() - 0.5) * 500, LH);
    ctx.stroke();
  }
  ctx.filter = `blur(${12 * s}px)`;
  ctx.drawImage(c, 0, 0, LW, LH);
  ctx.filter = 'none';
  // small charts top-left
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 18; i++) ctx.fillRect(140 + i * 38, 560 - (40 + rng() * 260), 20, 40 + rng() * 260);
  for (let r = 0; r < 8; r++) glyphRow(ctx, 160, 640 + r * 40, 520, 12, rng);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const x = 180 + i * 60;
    const y = 300 + Math.sin(i * 1.3) * 60 - i * 6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 34px "JetBrains Mono"';
  [20, 40, 60, 80, 100].forEach((t, i) => ctx.fillText(String(t), 170 + i * 120, 1400));
  const out = makeCanvas(w, h);
  const o = out.getContext('2d')!;
  o.filter = `blur(${1.6 * s}px)`;
  o.drawImage(c, 0, 0);
  return out;
};

// ---- per-frame overlays ------------------------------------------------------

export class Overlay {
  readonly canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement;
  private kind: OverlayKind;
  private s: number;
  private candles: {o: number; c: number; hi: number; lo: number}[] = [];
  private bars: number[] = [];

  constructor(kind: OverlayKind, w: number, h: number, land: Polygon[] | null) {
    this.kind = kind;
    this.canvas = makeCanvas(w, h);
    this.s = w / LW;
    this.base =
      kind === 'financeBlue' ? financeBlueStatic(w, h) : kind === 'candlesWarm' ? candlesWarmStatic(w, h, land) : barsBlueStatic(w, h);
    const rng = mulberry32(0x0c4d1e);
    let v = 0.25;
    for (let i = 0; i < 64; i++) {
      const o = v;
      v = clamp(v + (rng() - 0.42) * 0.09 + Math.sin(i * 0.35) * 0.012, 0.05, 0.95);
      const c = v;
      this.candles.push({o, c, hi: Math.max(o, c) + rng() * 0.05, lo: Math.min(o, c) - rng() * 0.05});
    }
    for (let i = 0; i < 10; i++) this.bars.push(0.18 + i * 0.07 + (mulberry32(0xbaa + i)() - 0.5) * 0.12);
  }

  draw(f: OverlayFrame) {
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    if (this.kind === 'financeBlue') this.drawStairsLine(ctx, f);
    else if (this.kind === 'candlesWarm') this.drawCandles(ctx, f);
    else this.drawBars(ctx, f);
  }

  // White line chart with dots that follows the stack tops as they grow.
  private drawStairsLine(ctx: CanvasRenderingContext2D, f: OverlayFrame) {
    const pts = f.anchors.map((a) => ({x: a.x, y: a.y - 70}));
    if (pts.length < 2) return;
    const n = pts.length - 1;
    const head = f.progress * n;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= n; i++) {
      const t = clamp(head - (i - 1));
      if (t <= 0) break;
      ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t);
    }
    ctx.stroke();
    pts.forEach((p, i) => {
      const a = smoothstep(i - 0.3, i, head);
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // up arrows behind the middle stacks
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    [0.35, 0.55, 0.7].forEach((k, i) => {
      const a = smoothstep(0.2 + i * 0.2, 0.4 + i * 0.2, f.progress);
      if (a <= 0) return;
      const idx = Math.min(pts.length - 1, Math.round(k * n));
      ctx.globalAlpha = a * 0.8;
      arrow(ctx, pts[idx].x - 140, pts[idx].y - 260 - a * 60, 70);
      ctx.globalAlpha = 1;
    });
    // final rising trend line with arrow head
    const t = smoothstep(0.75, 1, f.progress);
    if (t > 0) {
      const last = pts[pts.length - 1];
      ctx.globalAlpha = t;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(last.x + 260 * t, last.y - 300 * t);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawCandles(ctx: CanvasRenderingContext2D, f: OverlayFrame) {
    const n = this.candles.length;
    const shown = f.progress * n;
    const x0 = 0;
    const step = LW / (n - 4);
    const y = (v: number) => LH * 0.9 - v * LH * 0.8;
    for (let i = 0; i < n; i++) {
      const a = clamp(shown - i);
      if (a <= 0) break;
      const c = this.candles[i];
      const x = x0 + i * step;
      ctx.globalAlpha = 0.85 * a;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y(c.hi));
      ctx.lineTo(x, y(c.lo));
      ctx.stroke();
      const top = y(Math.max(c.o, c.c));
      const bot = y(Math.min(c.o, c.c));
      if (c.c >= c.o) ctx.fillRect(x - 13, top, 26, Math.max(6, bot - top));
      else {
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 13, top, 26, Math.max(6, bot - top));
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawBars(ctx: CanvasRenderingContext2D, f: OverlayFrame) {
    const n = this.bars.length;
    const left = 260;
    const right = 3620;
    const base = 2080;
    const bw = 130;
    const step = (right - left) / n;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(left - 60, 120);
    ctx.lineTo(left - 60, base);
    ctx.lineTo(right + 40, base);
    ctx.stroke();
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const grow = easeInOut(clamp(f.progress * 1.25 - i * 0.03));
      const hgt = this.bars[i] * (base - 200) * grow;
      const x = left + i * step + (step - bw) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(x, base - hgt, bw, hgt);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x, base - hgt, bw, 8);
      pts.push([x + bw / 2, base - this.bars[i] * (base - 200) * 0.82 - 240 + Math.sin(i * 1.9) * 120]);
    }
    // rising line chart with dots, drawing on, ending in an arrow
    const head = clamp((f.progress - 0.1) / 0.85) * (n - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let end = pts[0];
    for (let i = 1; i < n; i++) {
      const t = clamp(head - (i - 1));
      if (t <= 0) break;
      end = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
      ctx.lineTo(end[0], end[1]);
    }
    ctx.stroke();
    pts.forEach(([x, yy], i) => {
      if (i > head) return;
      ctx.beginPath();
      ctx.arc(x, yy, 14, 0, Math.PI * 2);
      ctx.fill();
    });
    if (head > 0.05) {
      const i = Math.min(n - 1, Math.floor(head) + 1);
      const prev = pts[Math.max(0, i - 1)];
      const ang = Math.atan2(pts[i][1] - prev[1], pts[i][0] - prev[0]);
      ctx.save();
      ctx.translate(end[0], end[1]);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.lineTo(-20, -24);
      ctx.lineTo(-20, 24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
