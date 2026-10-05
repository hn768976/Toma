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
  g.addColorStop(0, 'rgba(110,190,225,0.9)');
  g.addColorStop(0.5, 'rgba(150,210,235,0.85)');
  g.addColorStop(1, 'rgba(200,235,250,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  // screen tiles: darker navy panels and bright cyan/white light patches
  for (let i = 0; i < 30; i++) {
    const x = rng() * LW;
    const y = rng() * LH * 0.8;
    const tw = 160 + rng() * 520;
    const th = 90 + rng() * 300;
    ctx.fillStyle = rng() < 0.45 ? `rgba(10,40,75,${0.25 + rng() * 0.3})` : `rgba(200,240,255,${0.12 + rng() * 0.25})`;
    ctx.fillRect(x, y, tw, th);
  }
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
  // haze: blown-out light patches upper right / centre
  for (const [hx, hy, hr] of [[2900, 250, 900], [1900, 150, 700]]) {
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, 'rgba(255,255,255,0.75)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  }
  // white bar chart, left-middle
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 16; i++) {
    const bh = 90 + Math.abs(Math.sin(i * 1.9)) * 160 + i * 6;
    ctx.fillRect(40 + i * 46, 1180 - bh, 30, bh);
  }
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.26)';
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
  g.addColorStop(0, 'rgba(235,120,40,0.95)');
  g.addColorStop(0.35, 'rgba(220,140,90,0.85)');
  g.addColorStop(0.6, 'rgba(70,140,190,0.85)');
  g.addColorStop(1, 'rgba(40,120,200,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  // soft warm/cool light blobs
  const rng = mulberry32(0xca5d);
  const bokeh = ['rgba(255,200,90,0.6)', 'rgba(255,150,120,0.5)', 'rgba(120,220,170,0.45)', 'rgba(110,200,255,0.5)', 'rgba(255,230,140,0.55)'];
  for (let i = 0; i < 34; i++) {
    const x = rng() * LW;
    const y = rng() * LH;
    const r = 90 + rng() * 300;
    const warm = x < LW * 0.45;
    const col = warm ? bokeh[rng() < 0.5 ? 0 : rng() < 0.5 ? 1 : 4] : bokeh[rng() < 0.3 ? 2 : 3];
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, y < LH * 0.3 && x > LW * 0.3 && x < LW * 0.6 ? bokeh[2] : col);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // faint world-map shape
  if (land) {
    ctx.save();
    ctx.translate(250, 160);
    ctx.fillStyle = 'rgba(150,215,255,0.28)';
    tracePolygons(ctx, land, 3400, 1700, [-170, 190, -60, 85]);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(220,245,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  ctx.filter = `blur(${6 * s}px)`;
  ctx.drawImage(c, 0, 0, LW, LH);
  ctx.filter = 'none';
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (let x = 0; x < LW; x += 330) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LH);
    ctx.stroke();
  }
  for (let y = 30; y < LH; y += 340) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LW, y);
    ctx.stroke();
  }
  // a second, static candle band along the top (background screen)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  let v = 0.5;
  for (let i = 0; i < 90; i++) {
    const x = i * 44;
    const o = v;
    v = Math.min(0.95, Math.max(0.05, v + (rng() - 0.48) * 0.12));
    const top = 60 + (1 - Math.max(o, v)) * 700;
    const bot = 60 + (1 - Math.min(o, v)) * 700;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, top - 40 * rng());
    ctx.lineTo(x, bot + 40 * rng());
    ctx.stroke();
    ctx.fillRect(x - 9, top, 18, Math.max(5, bot - top));
  }
  // dense field of tall thin bars forming jagged ridges across the upper frame
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  let ridge = 0.5;
  for (let x = 0; x < LW; x += 11) {
    ridge = Math.min(1, Math.max(0.1, ridge + (rng() - 0.5) * 0.14));
    const top = 120 + (1 - ridge) * 700;
    const len = 120 + rng() * 380;
    ctx.fillRect(x, top, 4, len);
  }
  // volume bars along the bottom
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 90; i++) {
    const hgt = 40 + rng() * 200;
    ctx.fillRect(i * 44 - 10, LH - hgt, 20, hgt);
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
  g.addColorStop(0, 'rgba(120,170,210,0.9)');
  g.addColorStop(1, 'rgba(60,110,160,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  // abstract glass towers with window grids (double exposure)
  for (let i = 0; i < 12; i++) {
    const bw = 220 + rng() * 420;
    const x = -100 + rng() * LW;
    const top = rng() * LH * 0.5;
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,45,80' : '200,230,250'},${0.18 + rng() * 0.22})`;
    ctx.fillRect(x, top, bw, LH - top);
    ctx.strokeStyle = 'rgba(230,245,255,0.28)';
    ctx.lineWidth = 3;
    for (let wy = top + 30; wy < LH; wy += 46) {
      ctx.beginPath();
      ctx.moveTo(x, wy);
      ctx.lineTo(x + bw, wy);
      ctx.stroke();
    }
    for (let wx = x + 40; wx < x + bw; wx += 60) {
      ctx.beginPath();
      ctx.moveTo(wx, top);
      ctx.lineTo(wx, LH);
      ctx.stroke();
    }
  }
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
  ctx.filter = `blur(${5 * s}px)`;
  ctx.drawImage(c, 0, 0, LW, LH);
  ctx.filter = 'none';
  // full-frame grid
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let x = 0; x < LW; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LH);
    ctx.stroke();
  }
  for (let y = 0; y < LH; y += 160) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LW, y);
    ctx.stroke();
  }
  // secondary line graph with dot markers, upper left
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  const sec = [[1050, 470], [1250, 600], [1500, 380], [1700, 450], [1950, 300]];
  sec.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
  for (const [x, y] of sec) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
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
    for (let i = 0; i < 110; i++) {
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
    ctx.font = '500 40px "JetBrains Mono"';
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
      // invented index codes, not prices
      // invented 6-digit node codes (no currency, no decimals: not prices)
      if (i >= 3) ctx.fillText(String(100000 + ((i * 7919 * 37) % 899999)), p.x - 70, p.y - 56);
      ctx.globalAlpha = 1;
    });
    // second, lower line with nodes
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i > head + 0.01) return;
      const y = p.y + 260 + Math.sin(i * 1.3) * 40;
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    });
    ctx.stroke();
    pts.forEach((p, i) => {
      if (i > head) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 260 + Math.sin(i * 1.3) * 40, 14, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // up arrows behind the middle stacks
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    [0.35, 0.55, 0.7].forEach((k, i) => {
      const a = smoothstep(0.2 + i * 0.2, 0.4 + i * 0.2, f.progress);
      if (a <= 0) return;
      const idx = Math.min(pts.length - 1, Math.round(k * n));
      ctx.globalAlpha = a * 0.8;
      arrow(ctx, pts[idx].x - 140, pts[idx].y - 260 - a * 60, 110);
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
    const y = (v: number) => LH * 0.72 - v * LH * 0.62;
    for (let i = 0; i < n; i++) {
      const a = clamp(shown - i);
      if (a <= 0) break;
      const c = this.candles[i];
      const x = x0 + i * step;
      ctx.globalAlpha = 0.95 * a;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y(c.hi));
      ctx.lineTo(x, y(c.lo));
      ctx.stroke();
      const top = y(Math.max(c.o, c.c));
      const bot = y(Math.min(c.o, c.c));
      if (c.c >= c.o) ctx.fillRect(x - 9, top, 18, Math.max(8, bot - top));
      else {
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 9, top, 18, Math.max(8, bot - top));
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
      const bg = ctx.createLinearGradient(0, base - hgt, 0, base);
      bg.addColorStop(0, 'rgba(255,255,255,0.75)');
      bg.addColorStop(1, 'rgba(255,255,255,0.4)');
      ctx.fillStyle = bg;
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
