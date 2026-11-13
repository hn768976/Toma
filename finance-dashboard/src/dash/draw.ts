import { clamp, hash, mulberry32 } from "../engine/random";
import type { DashPalette } from "./palette";

/**
 * Canvas 2D painters for every dashboard card. Each painter is pure: it only
 * depends on (palette, time, seed), so frames are deterministic.
 */

type Ctx = CanvasRenderingContext2D;

const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

export const roundRect = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
};

/** Frosted dark-glass card background + hairline border. */
export const glassCard = (c: Ctx, p: DashPalette, W: number, H: number, r = 40) => {
  const inset = 6;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.panelTop);
  g.addColorStop(1, p.panelBottom);
  roundRect(c, inset, inset, W - inset * 2, H - inset * 2, r);
  c.fillStyle = g;
  c.fill();
  // soft inner sheen at the top
  const sh = c.createLinearGradient(0, 0, 0, H * 0.35);
  sh.addColorStop(0, p.panelGlow);
  sh.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = sh;
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = p.panelBorder;
  c.stroke();
};

const text = (
  c: Ctx,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
) => {
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.fillText(s, x, y);
};

const fmt = (n: number, d = 0) => n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Gently ticking number: changes a few times per second, deterministic. */
const tick = (seed: number, t: number, base: number, spread: number, rate = 2.2) =>
  base + Math.floor(hash(seed, Math.floor(t * rate + hash(seed) * 3)) * spread);

const statusDots = (c: Ctx, p: DashPalette, x: number, y: number, r: number, vertical = false) => {
  p.statusDots.forEach((col, i) => {
    c.beginPath();
    c.arc(vertical ? x : x + i * r * 3, vertical ? y + i * r * 3 : y, r, 0, Math.PI * 2);
    c.fillStyle = col;
    c.fill();
  });
};

// ---------------------------------------------------------------------------
// Main "Market Analysis" card (donut + legend + bars + copy)
// ---------------------------------------------------------------------------
export const MAIN_W = 2048;
export const MAIN_H = 860;

export const drawMainCard = (c: Ctx, p: DashPalette, t: number) => {
  const W = MAIN_W;
  const H = MAIN_H;
  c.clearRect(0, 0, W, H);
  glassCard(c, p, W, H, 44);
  statusDots(c, p, 64, 70, 11, true);

  // faint measurement grid around the donut
  c.strokeStyle = p.textFaint;
  c.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 140 + i * 72;
    c.globalAlpha = 0.35;
    c.beginPath();
    c.moveTo(96, y);
    c.lineTo(110, y);
    c.stroke();
  }
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 4; j++) {
      c.globalAlpha = 0.25 * hash(i, j, 4);
      c.fillStyle = p.textDim;
      c.fillRect(150 + i * 22, 690 + j * 18, 6, 6);
    }
  }
  c.globalAlpha = 1;

  // ---- donut (animated build) ----
  const cx = 430;
  const cy = 420;
  const R = 268;
  const r = 150;
  const segs: [number, number, number][] = [
    [0, 0.03 + 0.4 * easeOut(t / 1.15), 0],
    [0.43, 0.43 + 0.27 * easeOut((t - 0.95) / 1.2), 1],
    [0.7, 0.7 + 0.045 * easeOut((t - 1.9) / 0.6), 2],
  ];
  c.save();
  c.shadowColor = p.donutGlow;
  c.shadowBlur = 30;
  for (const [a0, a1, ci] of segs) {
    if (a1 <= a0 + 0.001) continue;
    const s0 = -Math.PI / 2 + a0 * Math.PI * 2;
    const s1 = -Math.PI / 2 + a1 * Math.PI * 2;
    c.beginPath();
    c.arc(cx, cy, R, s0, s1);
    c.arc(cx, cy, r, s1, s0, true);
    c.closePath();
    const g = c.createRadialGradient(cx, cy, r, cx, cy, R);
    g.addColorStop(0, p.donut[ci]);
    g.addColorStop(1, p.donut[ci]);
    c.fillStyle = g;
    c.fill();
  }
  c.restore();
  // inner hairline ring
  c.strokeStyle = p.textFaint;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(cx, cy, r - 18, 0, Math.PI * 2);
  c.stroke();

  // ---- legend ----
  const labels = ["U 10Y+", "E 6+", "G 10Y+", "J 10Y Yd+", "U 10Y+", "I 10Y+"];
  const subs = ["U S BONDS 10 YR", "E B BONDS 10 YR", "G G BONDS 10 YR", "J G BONDS 10 YR", "U K BONDS 10 YR", "I T BONDS 10 YR"];
  labels.forEach((lab, i) => {
    const y = 150 + i * 112;
    c.fillStyle = p.legend[i];
    c.fillRect(780, y - 30, 34, 34);
    text(c, lab, 838, y - 4, "600 34px Montserrat", p.text);
    text(c, subs[i], 838, y + 34, "500 21px Inter", p.textFaint);
  });

  // divider
  c.fillStyle = p.textFaint;
  c.fillRect(1105, 80, 3, 700);

  // ---- bar chart ----
  const grow = easeOut((t + 0.6) / 1.6);
  const bars: [number, string][] = [
    [0.78, p.barLight],
    [0.98, p.barStrong],
    [0.96, p.barStrong],
    [0.0, ""],
    [0.62, p.barLight],
    [0.9, p.barStrong],
    [0.74, p.barStrong],
  ];
  let by = 120;
  for (const [len, col] of bars) {
    if (len === 0) {
      by += 24;
      continue;
    }
    const wob = 1 + 0.02 * Math.sin(t * 2.1 + by);
    const L = 700 * len * grow * wob;
    c.fillStyle = col;
    roundRect(c, 1150, by, L, 20, 6);
    c.fill();
    c.beginPath();
    c.arc(1150 + L + 12, by + 10, 9, 0, Math.PI * 2);
    c.fillStyle = p.barDot;
    c.fill();
    by += 40;
  }
  // numbers row
  const ny = by + 46;
  c.fillStyle = p.barDot;
  c.fillRect(1150, ny - 24, 24, 24);
  text(c, `${tick(1, t, 45500, 60)}  ${tick(2, t, 53800, 60)}`, 1188, ny, "600 30px Inter", p.text);
  c.fillStyle = p.barDot;
  c.fillRect(1480, ny - 24, 24, 24);
  text(c, `43  244  ${tick(3, t, 787800, 99)}`, 1518, ny, "600 30px Inter", p.text);
  c.fillStyle = p.textFaint;
  c.fillRect(1150, ny + 40, 760, 3);

  // ---- Market Analysis copy ----
  c.fillStyle = p.barDot;
  c.fillRect(1150, ny + 104, 26, 26);
  text(c, "Market Analysis", 1196, ny + 130, "700 46px Montserrat", p.text);
  const copy = [
    "Strategic planning involves an analysis of the company's strategic",
    "initial situation prior to the formulation, evaluation and selection of",
    "market-oriented competitive position that contributes to the company's",
    "goals and marketing objectives. Strategic marketing built on strategic",
  ];
  copy.forEach((l, i) => text(c, l, 1150, ny + 182 + i * 36, "400 24px Inter", p.textDim));
};

// ---------------------------------------------------------------------------
// Tall "phone" cards
// ---------------------------------------------------------------------------
export const TALL_W = 1024;
export const TALL_H = 2360;
export const TALL_TITLES = [
  "Revenue Growth",
  "Marketing Activities",
  "Customer Acquisition",
  "Business Revenue",
  "Sales Forecast",
  "Market Summary",
  "Cash Flow",
];

const areaChart = (
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  seed: number,
  t: number,
  grow = 1,
) => {
  const rng = mulberry32(seed);
  const n = 46;
  const pts: number[] = [];
  let v = 0.15;
  for (let i = 0; i < n; i++) {
    v += (rng() - 0.38) * 0.09;
    v = clamp(v, 0.05, 0.95);
    pts.push(v + 0.025 * Math.sin(t * 3 + i * 0.7) * (i / n));
  }
  const reveal = Math.max(2, Math.floor(n * grow));
  c.beginPath();
  c.moveTo(x, y + h);
  for (let i = 0; i < reveal; i++) c.lineTo(x + (i / (n - 1)) * w, y + h - pts[i] * h);
  c.lineTo(x + ((reveal - 1) / (n - 1)) * w, y + h);
  c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, color);
  g.addColorStop(0.7, color);
  g.addColorStop(1, "rgba(0,0,0,0.15)");
  c.globalAlpha = 0.92;
  c.fillStyle = g;
  c.fill();
  c.globalAlpha = 1;
  c.beginPath();
  for (let i = 0; i < reveal; i++) {
    const px = x + (i / (n - 1)) * w;
    const py = y + h - pts[i] * h;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.strokeStyle = color;
  c.lineWidth = 4;
  c.stroke();
};

export const drawTallCard = (c: Ctx, p: DashPalette, t: number, idx: number) => {
  const W = TALL_W;
  const H = TALL_H;
  c.clearRect(0, 0, W, H);
  glassCard(c, p, W, H, 48);
  text(c, TALL_TITLES[idx % TALL_TITLES.length], 64, 112, "600 52px Montserrat", p.text);
  statusDots(c, p, 860, 92, 11);

  // horizontal bars
  const widths = [0.8, 0.72, 0.62, 0.56, 0.78, 0.5].map((w, i) => w * (0.9 + 0.2 * hash(idx, i)));
  widths.forEach((w, i) => {
    const L = (W - 140) * Math.min(w, 1) * (1 + 0.015 * Math.sin(t * 1.7 + i + idx));
    roundRect(c, 64, 180 + i * 58, L, 30, 8);
    c.fillStyle = p.tallBar;
    c.globalAlpha = 0.85 - i * 0.05;
    c.fill();
    c.globalAlpha = 1;
  });

  // data rows
  let y = 590;
  for (let row = 0; row < 3; row++) {
    text(c, `MONEY A-0${row + 1}+`, 64, y, "600 30px Inter", p.text);
    text(c, `${(tick(idx * 10 + row, t, 9000, 999, 1.3) / 100).toFixed(2)}`, W - 300, y, "600 30px Inter", p.text);
    text(c, "U S BONDS 10 YR", 64, y + 36, "500 20px Inter", p.textFaint);
    const neg = hash(idx, row) > 0.4;
    text(c, fmt(tick(idx * 20 + row, t, 1200, 900, 1.1)), W - 120, y + 2, "600 30px Inter", neg ? p.negative : p.text, "right");
    y += 108;
  }
  // teal highlight strip
  c.fillStyle = p.strip;
  roundRect(c, 50, y - 20, W - 100, 74, 10);
  c.fill();
  text(c, "MONEY A-04+", 80, y + 28, "700 28px Inter", p.stripText);
  text(c, fmt(tick(idx + 70, t, 5400, 300, 1.6)), W - 90, y + 28, "700 28px Inter", p.stripText, "right");
  y += 140;
  for (let row = 0; row < 3; row++) {
    text(c, `MONEY B-0${row + 1}+`, 64, y, "600 28px Inter", p.text);
    text(c, fmt(tick(idx * 30 + row, t, 1800, 700, 0.9)), W - 120, y, "600 28px Inter", hash(idx, row, 3) > 0.5 ? p.negative : p.text, "right");
    text(c, "G G BONDS 10 YR", 64, y + 34, "500 20px Inter", p.textFaint);
    y += 96;
  }
  // summary + area chart
  text(c, "Market Summary", 64, y + 40, "600 36px Montserrat", p.textDim);
  areaChart(c, 64, y + 80, W - 128, 380, p.areas[idx % p.areas.length], 100 + idx, t);
  y += 520;
  c.fillStyle = p.strip;
  roundRect(c, 50, y, W - 100, 64, 10);
  c.fill();
  text(c, "TOTAL", 80, y + 44, "700 28px Inter", p.stripText);
  y += 120;
  for (let row = 0; row < 3; row++) {
    c.fillStyle = p.textFaint;
    c.fillRect(64, y + row * 54, (W - 128) * (0.4 + 0.5 * hash(idx, row, 9)), 14);
  }
};

// ---------------------------------------------------------------------------
// Lower "Revenue Growth" card with a big area chart
// ---------------------------------------------------------------------------
export const REV_W = 2048;
export const REV_H = 900;

export const drawRevenueCard = (c: Ctx, p: DashPalette, t: number) => {
  const W = REV_W;
  const H = REV_H;
  c.clearRect(0, 0, W, H);
  glassCard(c, p, W, H, 44);
  text(c, "Revenue Growth", 90, 130, "700 52px Montserrat", p.textDim);
  c.strokeStyle = p.textFaint;
  c.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(90, 220 + i * 100);
    c.lineTo(W - 90, 220 + i * 100);
    c.stroke();
  }
  c.globalAlpha = 1;
  // short red trend line on the left
  c.strokeStyle = p.revenueLine;
  c.lineWidth = 10;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(220, 560);
  c.quadraticCurveTo(330, 470, 470, 450);
  c.stroke();
  // big blue area rising to the right
  const rng = mulberry32(77);
  const n = 80;
  const x0 = 900;
  const w = W - 980;
  const pts: number[] = [];
  let v = 0.1;
  for (let i = 0; i < n; i++) {
    v += (rng() - 0.3) * 0.035;
    v = clamp(v, 0.04, 0.95);
    pts.push(v);
  }
  const grow = easeOut((t + 1.5) / 3);
  c.beginPath();
  c.moveTo(x0, H - 60);
  for (let i = 0; i < n; i++) c.lineTo(x0 + (i / (n - 1)) * w, H - 60 - pts[i] * 620 * grow);
  c.lineTo(x0 + w, H - 60);
  c.closePath();
  const g = c.createLinearGradient(0, 200, 0, H);
  g.addColorStop(0, p.revenueArea[1]);
  g.addColorStop(1, p.revenueArea[0]);
  c.fillStyle = g;
  c.fill();
};

// ---------------------------------------------------------------------------
// Large background card with a violet price line
// ---------------------------------------------------------------------------
export const BACK_W = 3072;
export const BACK_H = 1100;

export const drawBackCard = (c: Ctx, p: DashPalette, t: number) => {
  const W = BACK_W;
  const H = BACK_H;
  c.clearRect(0, 0, W, H);
  glassCard(c, p, W, H, 60);
  c.globalAlpha = 0.8;
  text(c, "Portfolio Overview", 110, 140, "600 48px Montserrat", p.textDim);
  c.globalAlpha = 1;
  // candlestick-style violet price chart with a thin trend line
  const rng = mulberry32(5);
  let v = 0.5;
  const n = 120;
  const step = (W - 200) / n;
  const pts: number[] = [];
  c.shadowColor = p.lineChart;
  c.shadowBlur = 14;
  for (let i = 0; i < n; i++) {
    const open = v;
    v = clamp(v + (rng() - 0.5) * 0.12, 0.08, 0.92);
    const close = v;
    const hi = Math.max(open, close) + rng() * 0.08;
    const lo = Math.min(open, close) - rng() * 0.08;
    const px = 100 + i * step + step / 2;
    const y = (q: number) => 200 + (1 - q) * 780 + 6 * Math.sin(t * 2 + i);
    c.strokeStyle = p.lineChart;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(px, y(hi));
    c.lineTo(px, y(lo));
    c.stroke();
    c.fillStyle = p.lineChart;
    c.globalAlpha = close >= open ? 1 : 0.55;
    c.fillRect(px - step * 0.32, y(Math.max(open, close)), step * 0.64, Math.max(4, Math.abs(close - open) * 780));
    c.globalAlpha = 1;
    pts.push(y((open + close) / 2));
  }
  c.beginPath();
  pts.forEach((py, i) => (i === 0 ? c.moveTo(100 + step / 2, py) : c.lineTo(100 + i * step + step / 2, py)));
  c.lineWidth = 3;
  c.stroke();
  c.shadowBlur = 0;
  // small scale labels
  for (let i = 0; i < 7; i++) {
    text(c, fmt(tick(200 + i, t, 1000 + i * 300, 50, 0.7)), W - 90, 280 + i * 100, "500 22px Inter", p.textFaint, "right");
  }
};

// ---------------------------------------------------------------------------
// Left "system monitor" list floating in the background
// ---------------------------------------------------------------------------
export const LIST_W = 1024;
export const LIST_H = 2048;
export const drawSystemList = (c: Ctx, p: DashPalette, t: number) => {
  c.clearRect(0, 0, LIST_W, LIST_H);
  const items = [
    "Analyze Storage",
    "Pressure",
    "Swap File",
    "Protection",
    "Health",
    "Temperature",
    "Overclocking",
    "Cache",
    "Memory",
    "Disk I/O",
    "Network",
    "Threads",
  ];
  // top block of tiny numbers
  for (let r = 0; r < 6; r++) {
    for (let k = 0; k < 4; k++) {
      const col = k === 1 ? p.accentNum[0] : k === 3 ? p.accentNum[1] : p.textDim;
      text(c, String(tick(r * 9 + k, t, 10, 89, 1.5)), 40 + k * 140, 70 + r * 52, "600 30px Inter", col);
    }
  }
  items.forEach((it, i) => {
    const y = 420 + i * 128;
    // orange status dot + bright label, as in the reference
    c.fillStyle = i % 3 === 2 ? p.textDim : p.accentNum[0];
    c.fillRect(40, y - 22, 20, 20);
    text(c, it, 84, y, "600 40px Inter", p.text);
    c.fillStyle = p.textDim;
    c.fillRect(84, y + 28, 280 + 300 * hash(i, 2), 4);
    const pct = tick(i + 40, t, 10, 90, 0.8);
    text(c, `${pct}%`, 800, y, "600 30px Inter", i % 3 === 0 ? p.accentNum[0] : p.textFaint, "right");
    c.fillStyle = i % 4 === 1 ? p.accentNum[1] : p.textFaint;
    c.fillRect(840, y - 20, 22, 22);
  });
};

// ---------------------------------------------------------------------------
// Back wall: faint grid, dots and crosses (tileable)
// ---------------------------------------------------------------------------
export const drawWall = (c: Ctx, p: DashPalette) => {
  const W = c.canvas.width;
  const H = c.canvas.height;
  c.clearRect(0, 0, W, H);
  c.strokeStyle = p.gridLine;
  c.lineWidth = 2;
  for (let x = 0; x <= W; x += 128) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, H);
    c.stroke();
  }
  for (let y = 0; y <= H; y += 128) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y);
    c.stroke();
  }
  const rng = mulberry32(9);
  for (let i = 0; i < 900; i++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H);
    c.globalAlpha = 0.15 + 0.5 * rng();
    c.fillStyle = rng() > 0.92 ? p.accentNum[0] : p.textDim;
    const s = rng() > 0.8 ? 6 : 3;
    c.fillRect(x, y, s, s);
  }
  // small dense "data" blocks
  for (let b = 0; b < 26; b++) {
    const bx = Math.floor(rng() * (W - 200));
    const by = Math.floor(rng() * (H - 120));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 10; j++) {
        if (rng() > 0.6) continue;
        c.globalAlpha = 0.25 + 0.4 * rng();
        c.fillStyle = p.textDim;
        c.fillRect(bx + j * 18, by + i * 16, 10, 5);
      }
    }
  }
  c.globalAlpha = 1;
};
