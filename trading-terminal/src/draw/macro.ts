import { blendRange, Clock, HISTORY, priceRange, Series, windowAt } from "../engine/data";
import { Version } from "../engine/versions";
import { alpha, C } from "../theme";
import { drawOscillator, fmt, makeXMap, tagClock } from "./chart";
import { hline, niceStep, Painter, Pt, Rect, strokePath, tag, text } from "./primitives";

/**
 * Indicator stack for the macro shot: candles + three averages, volume,
 * MACD row and a large oscillator, value tags in a right-hand column.
 */
export const drawMacroPanels = (p: Painter, v: Version, s: Series, clock: Clock, W: number, H: number) => {
  const { ctx } = p;
  const x0 = 30;
  const axisX = W - 560;
  const tagX = axisX + 30;
  const count = 230;
  const xmap = makeXMap(s, clock, x0, axisX, count, 1.2);
  const { win, slot } = xmap;
  const idx = (j: number) => win.start + j;
  const tc = tagClock(s, clock);
  const fs = 48;
  const ls = 3;
  void v;

  const rowA: Rect = { x: x0, y: 420, w: axisX - x0, h: 400 };
  const rowB: Rect = { x: x0, y: 828, w: axisX - x0, h: 80 };
  const rowC: Rect = { x: x0, y: 915, w: axisX - x0, h: 180 };
  const rowD: Rect = { x: x0, y: 1110, w: W - x0 - 30, h: 1000 };

  const clip = (r: Rect, fn: () => void) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    fn();
    ctx.restore();
  };
  for (const r of [rowA, rowB, rowC]) hline(p, x0, W - 30, r.y + r.h + 10, C.line, 2);

  // --- Row A: candles + averages
  const range = priceRange(s, clock, count + 1, 0.25);
  const yA = (val: number) => rowA.y + (1 - (val - range[0]) / (range[1] - range[0])) * rowA.h;
  const step = niceStep(range[1] - range[0], 4);
  for (let val = Math.ceil(range[0] / step) * step; val < range[1]; val += step) {
    const y = yA(val);
    if (y < rowA.y + 20 || y > rowA.y + rowA.h - 20) continue;
    hline(p, x0, axisX, y, C.grid, 1.5);
  }
  const pts = (arr: number[], y: (v: number) => number): Pt[] => arr.map((val, j) => [xmap.xOf(idx(j)), y(val)]);
  clip(rowA, () => {
    strokePath(p, pts(win.bandUp, yA), alpha(C.blue, 0.9), 2.6 * ls);
    strokePath(p, pts(win.bandLo, yA), alpha(C.blue, 0.9), 2.6 * ls);
    strokePath(p, pts(win.sma, yA), C.orange, 2.6 * ls);
    strokePath(p, pts(win.ema, yA), C.red, 2.2 * ls, { alpha: 0.9 });
    const bw = slot * 0.6;
    win.candles.forEach((c, j) => {
      const x = xmap.xOf(idx(j));
      const up = c.c >= c.o;
      ctx.fillStyle = up ? C.green : C.red;
      ctx.globalAlpha = p.glow ? 0.9 : 1;
      ctx.fillRect(x - 1.5, yA(c.h), 3, Math.max(1, yA(c.l) - yA(c.h)));
      const t = Math.min(yA(c.o), yA(c.c));
      ctx.fillRect(x - bw / 2, t, bw, Math.max(2, Math.abs(yA(c.o) - yA(c.c))));
      ctx.globalAlpha = 1;
    });
  });
  const aTags = [
    { v: tc.next.bandUp, pv: tc.prev.bandUp, col: C.blue },
    { v: tc.next.ema, pv: tc.prev.ema, col: C.red },
    { v: tc.next.sma, pv: tc.prev.sma, col: C.orange },
    { v: tc.next.bandLo, pv: tc.prev.bandLo, col: C.blue },
  ].sort((a, b) => b.v - a.v);
  let lastY = -Infinity;
  for (const t of aTags) {
    let y = Math.max(yA(t.v), lastY + fs * 1.55);
    y = Math.min(y, rowA.y + rowA.h - fs);
    lastY = y;
    tag(p, { x: tagX, y, prev: fmt(t.pv, 2), next: fmt(t.v, 2), prog: tc.prog, up: t.v >= t.pv, color: t.col, size: fs, minChars: 4 });
  }

  // --- Row B: volume
  let vmax = 0;
  for (const c of win.candles) vmax = Math.max(vmax, c.v);
  clip(rowB, () => {
    const bw = slot * 0.86;
    win.candles.forEach((c, j) => {
      const x = xmap.xOf(idx(j));
      const h = Math.pow(c.v / vmax, 2.2) * rowB.h * 0.9;
      ctx.fillStyle = alpha(c.c >= c.o ? C.green : C.red, p.glow ? 0.5 : 0.85);
      ctx.fillRect(x - bw / 2, rowB.y + rowB.h - h, bw, h);
    });
  });
  const volStr = (x: number) => `${(x * 4.1).toFixed(3)} M`;
  tag(p, { x: tagX, y: rowB.y + rowB.h * 0.6, prev: volStr(tc.prev.vol), next: volStr(tc.next.vol), prog: tc.prog, color: C.green, size: fs, minChars: 7 });
  text(p, fmt(Math.floor(range[0] * 10) / 10, 2), tagX + fs * 3.4, rowA.y + rowA.h + 4, fs * 0.95, C.textBright, { mono: true, align: "right" });

  // --- Row C: MACD lines + thin histogram
  const rangeC = blendRange(clock, (n) => {
    const w = windowAt(s, (HISTORY + n - HISTORY) * 15 + 14, count + 3);
    let m = 1e-9;
    for (let j = 0; j < w.macd.length; j++) m = Math.max(m, Math.abs(w.macd[j]), Math.abs(w.signal[j]));
    return [-m, m] as const;
  });
  const mC = rangeC[1] * 1.15;
  const yC = (val: number) => rowC.y + rowC.h / 2 - (val / mC) * rowC.h * 0.5;
  clip(rowC, () => {
    const bw = slot * 0.34;
    win.hist.forEach((val, j) => {
      const x = xmap.xOf(idx(j));
      const y = yC(val * 1.6);
      ctx.fillStyle = alpha(val >= 0 ? C.green : C.red, p.glow ? 0.6 : 0.9);
      ctx.fillRect(x - bw / 2, Math.min(y, yC(0)), bw, Math.abs(y - yC(0)));
    });
    // Broad mint ribbon (smoothed MACD envelope) under the thin lines.
    strokePath(p, pts(win.macd.map((m, j) => (m + win.signal[j]) / 2), yC), alpha(C.green, 0.35), 9 * ls, { glow: 0.4 });
    strokePath(p, pts(win.signal, yC), C.orange, 2.4 * ls);
    strokePath(p, pts(win.macd, yC), C.blue, 2.4 * ls);
  });
  const sc = 100 / (s.candles[HISTORY].o || 1);
  tag(p, { x: tagX, y: rowC.y + fs * 0.6, prev: fmt(tc.prev.signal * sc, 2), next: fmt(tc.next.signal * sc, 2), prog: tc.prog, color: C.orange, size: fs, minChars: 5 });
  tag(p, { x: tagX, y: rowC.y + fs * 2.25, prev: fmt(tc.prev.macd * sc, 2), next: fmt(tc.next.macd * sc, 2), prog: tc.prog, color: C.blue, size: fs, minChars: 5 });
  tag(p, { x: tagX, y: rowC.y + fs * 3.9, prev: fmt(tc.prev.hist * sc, 2), next: fmt(tc.next.hist * sc, 2), prog: tc.prog, color: tc.next.hist >= 0 ? C.green : C.red, size: fs, minChars: 5 });

  // --- Row D: large oscillator
  drawOscillator(p, s, clock, rowD, xmap, { axisW: W - 30 - axisX, fs: fs * 1.15, lineScale: 1.9, bandAlpha: 0.42, lo: 18, hi: 82, levels: [34, 66] });
};
