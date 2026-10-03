// Finance backdrop drawn once into canvases (deterministic: seeded data only).
// Blurred Natural Earth world map, grid, white candlestick + line charts,
// made-up label rows, warm/cool light leaks. Plus a charts-only overlay used
// for the double-exposure layer over the coins.
import { drawLand } from "../lib/assets";
import { mulberry32 } from "../lib/random";
import type { CoinPalette } from "../versions";

type Polys = Parameters<typeof drawLand>[0];

const candles = (seed: number, n: number) => {
  const rnd = mulberry32(seed);
  let v = 0.5;
  const out: { o: number; c: number; h: number; l: number }[] = [];
  for (let i = 0; i < n; i++) {
    const o = v;
    v += (rnd() - 0.47) * 0.06 + Math.sin(i * 0.11) * 0.012;
    v = Math.min(0.9, Math.max(0.1, v));
    const c = v;
    out.push({ o, c, h: Math.max(o, c) + rnd() * 0.04, l: Math.min(o, c) - rnd() * 0.04 });
  }
  return out;
};

const drawCharts = (ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number) => {
  // Big candlestick chart across the upper half.
  ctx.save();
  const cs = candles(0xc0de, 190);
  const x0 = W * 0.0;
  const cw = W / cs.length;
  const top = H * 0.12;
  const hh = H * 0.6;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const x = x0 + i * cw + cw / 2;
    const y = (v: number) => top + (1 - v) * hh;
    ctx.globalAlpha = alpha * (c.c >= c.o ? 0.95 : 0.6);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 1.2, y(c.h), 2.4, y(c.l) - y(c.h));
    const yb = Math.min(y(c.o), y(c.c));
    ctx.fillRect(x - cw * 0.32, yb, cw * 0.64, Math.max(4, Math.abs(y(c.o) - y(c.c))));
  }
  // Second, smaller candle row lower down.
  const cs2 = candles(0xbeef, 90);
  for (let i = 0; i < cs2.length; i++) {
    const c = cs2[i];
    const x = W * 0.45 + i * (W * 0.55 / cs2.length);
    const y = (v: number) => H * 0.4 + (1 - v) * H * 0.35;
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillRect(x - 0.5, y(c.h), 1, y(c.l) - y(c.h));
    ctx.fillRect(x - 3, Math.min(y(c.o), y(c.c)), 6, Math.max(2, Math.abs(y(c.o) - y(c.c))));
  }
  // Thin line charts.
  const rnd = mulberry32(0x11e);
  for (let k = 0; k < 2; k++) {
    ctx.globalAlpha = alpha * (k === 0 ? 0.7 : 0.4);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = k === 0 ? 2.2 : 1.4;
    ctx.beginPath();
    let v = 0.5;
    for (let i = 0; i <= 80; i++) {
      v += (rnd() - 0.45) * 0.07;
      v = Math.min(0.95, Math.max(0.05, v));
      const x = (i / 80) * W;
      const y = H * (0.22 + 0.12 * k) + (1 - v) * H * 0.4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

export const makeBackdrop = (polys: Polys, palette: CoinPalette) => {
  const W = 2048;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  // Warm → cool base, light and low contrast.
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#b8743e");
  g.addColorStop(0.45, "#7f8590");
  g.addColorStop(1, "#3f7fa8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Light leaks.
  const leak = (x: number, y: number, r: number, col: string, a: number) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  };
  leak(W * 0.12, H * 0.45, W * 0.35, palette.leakWarm, 0.55);
  leak(W * 0.3, H * 0.95, W * 0.3, palette.leakWarm, 0.45);
  leak(W * 0.85, H * 0.3, W * 0.4, palette.leakCool, 0.5);
  leak(W * 0.6, H * 0.1, W * 0.25, "#ffffff", 0.18);
  // Blurred world map.
  const land = drawLand(polys, W, Math.round(W / 2), undefined, "#ffffff");
  ctx.save();
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.3;
  ctx.drawImage(land, -W * 0.05, -H * 0.1, W * 1.1, H * 1.1);
  ctx.restore();
  // Grid.
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += W / 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += H / 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  // Charts (slightly softened).
  ctx.save();
  ctx.filter = "blur(0.8px)";
  drawCharts(ctx, W, H, 1);
  ctx.restore();
  // Label row (made-up symbols and numbers).
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 22px "Inter"`;
  const labels = ["#ALPHA  1.2841", "#NOVA  0.9317", "#ORBIT  142.06", "#VEGA  1.0472", "#LUMEN  0.6618", "#DELTA  88.315"];
  labels.forEach((l, i) => ctx.fillText(l, 60 + i * (W / labels.length), 150));
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 168, W, 2);
  ctx.font = `400 16px "Inter"`;
  for (let i = 0; i < 12; i++) ctx.fillText(`${(1.1 + i * 0.0137).toFixed(4)}`, W - 90, 110 + i * 70);
  ctx.restore();
  // Overall soft focus.
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const o = out.getContext("2d")!;
  o.filter = "blur(2px)";
  o.drawImage(c, 0, 0);
  return out;
};

// Double-exposure layer that sits over the whole frame (coins included):
// full-frame grid, tall dense candlesticks, a ticker strip of made-up symbols,
// scattered small numbers and a warm light leak in the lower right.
export const makeChartOverlay = (palette: CoinPalette) => {
  const W = 2048;
  const H = 1152;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(0x0e71a7);
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += W / 21) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += H / 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  // Tall dense candlesticks across the upper two thirds.
  ctx.save();
  ctx.filter = "blur(1px)";
  ctx.fillStyle = "#ffffff";
  const cs = candles(0xfeed, 110);
  const cw = W / cs.length;
  cs.forEach((cd, i) => {
    const x = i * cw + cw / 2;
    const y = (v: number) => H * 0.14 + (1 - v) * H * 0.72;
    ctx.globalAlpha = 0.55 + 0.4 * rnd();
    ctx.fillRect(x - 1.5, y(cd.h + 0.1), 3, y(cd.l - 0.1) - y(cd.h + 0.1));
    ctx.fillRect(x - cw * 0.28, Math.min(y(cd.o), y(cd.c)) - 10, cw * 0.56, Math.abs(y(cd.o) - y(cd.c)) + 20);
  });
  ctx.restore();
  // Ticker strip (made-up symbols) and small scattered numbers.
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, 70, W, 54);
  ctx.globalAlpha = 0.75;
  ctx.font = `600 26px "Inter"`;
  ctx.globalAlpha = 0.9;
  const syms = ["#ALPHA", "#NOVA", "#ORBIT", "#VEGA", "#LUMEN", "#DELTA", "#KAPPA"];
  syms.forEach((s, i) => ctx.fillText(`${s}  ${(0.5 + rnd() * 2).toFixed(4)}`, 30 + i * (W / syms.length), 107));
  ctx.font = `400 18px "Inter"`;
  ctx.globalAlpha = 0.45;
  ctx.restore();
  // Warm light leak, lower right, and a softer one at the left.
  const leak = (x: number, y: number, r: number, col: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };
  leak(W * 0.97, H * 0.72, W * 0.3, "#FFC070", 1.0);
  leak(W * 0.02, H * 0.6, W * 0.25, palette.leakWarm, 0.5);
  return c;
};
