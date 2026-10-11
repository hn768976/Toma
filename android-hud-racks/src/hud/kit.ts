// The shared blue fintech HUD kit (Looks 1 and 2). Every element draws
// into a Canvas-2D context in "4K pixels"; the caller scales the context
// to the texture's real resolution. All values shown are invented.

import {
  hash01,
  holdIndex,
  makeLoopWalk,
  randomCaps,
  randomDigits,
} from "../lib/random";

export const HUD = {
  line: "#CFE4FF",
  white: "#F4FAFF",
  up: "#3AF06A",
  down: "#FF3A2A",
};

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const orbitron = (px: number, w = 500) => `${w} ${px}px Orbitron`;
export const inter = (px: number, w = 400) => `${w} ${px}px Inter`;

type Ctx = CanvasRenderingContext2D;

export const triangle = (
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  dir: 1 | -1,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir > 0) {
    ctx.moveTo(x, y - s * 0.5);
    ctx.lineTo(x + s * 0.55, y + s * 0.45);
    ctx.lineTo(x - s * 0.55, y + s * 0.45);
  } else {
    ctx.moveTo(x, y + s * 0.5);
    ctx.lineTo(x + s * 0.55, y - s * 0.45);
    ctx.lineTo(x - s * 0.55, y - s * 0.45);
  }
  ctx.closePath();
  ctx.fill();
};

// "$ 243.67" with a stacked green up / red down pair; the active one is
// bright, the other dim.
export const priceReadout = (
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  value: string,
  dir: 1 | -1,
  arrowsLeft = true,
) => {
  ctx.font = orbitron(size, 500);
  ctx.textBaseline = "middle";
  const text = `$ ${value}`;
  const w = ctx.measureText(text).width;
  const ax = arrowsLeft ? x + size * 0.45 : x + w + size * 0.9;
  const tx = arrowsLeft ? x + size * 1.3 : x;
  triangle(ctx, ax, y - size * 0.42, size * 0.55, 1, rgba(HUD.up, dir > 0 ? 1 : 0.35));
  triangle(ctx, ax, y + size * 0.42, size * 0.55, -1, rgba(HUD.down, dir < 0 ? 1 : 0.35));
  ctx.fillStyle = HUD.white;
  ctx.fillText(text, tx, y);
};

export const roundRect = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Two-digit counter in a rounded rectangle.
export const numberBox = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  lw = 4,
) => {
  ctx.strokeStyle = HUD.white;
  ctx.lineWidth = lw;
  roundRect(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, h * 0.28);
  ctx.stroke();
  ctx.font = orbitron(h * 0.44, 500);
  ctx.fillStyle = HUD.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + h * 0.02);
  ctx.textAlign = "left";
};

export const textLines = (
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  lines: string[],
  color = HUD.white,
  font: "orbitron" | "inter" = "inter",
  lineGap = 1.35,
) => {
  ctx.font = font === "orbitron" ? orbitron(size, 500) : inter(size, 500);
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lineGap));
};

// A stack of thin horizontal bars; `values` are 0..1 fill amounts. Each bar
// is a dim track with a bright segmented fill.
export const barStack = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  barH: number,
  gap: number,
  values: number[],
  segments = 0,
) => {
  values.forEach((v, i) => {
    const by = y + i * (barH + gap);
    ctx.fillStyle = rgba(HUD.line, 0.22);
    ctx.fillRect(x, by, w, barH);
    ctx.fillStyle = HUD.white;
    if (segments > 0) {
      const sw = w / segments;
      const n = Math.round(v * segments);
      for (let s = 0; s < n; s++) ctx.fillRect(x + s * sw, by, sw * 0.72, barH);
    } else {
      ctx.fillRect(x, by, w * v, barH);
    }
  });
};

// Thin arc ring with a centre label; `spin` rotates the arc pattern.
export const ringGauge = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  label: string,
  spin: number,
  lw = 4,
) => {
  ctx.lineWidth = lw;
  ctx.strokeStyle = rgba(HUD.line, 0.35);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = HUD.white;
  ctx.lineWidth = lw * 1.8;
  for (let k = 0; k < 3; k++) {
    const a0 = spin + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + Math.PI * 0.42);
    ctx.stroke();
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = rgba(HUD.line, 0.6);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, spin * -1.5, spin * -1.5 + Math.PI * 1.3);
  ctx.stroke();
  ctx.font = orbitron(r * 0.55, 500);
  ctx.fillStyle = HUD.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + r * 0.03);
  ctx.textAlign = "left";
};

export const miniBars = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  values: number[],
  alpha = 1,
) => {
  const n = values.length;
  const bw = w / n;
  values.forEach((v, i) => {
    ctx.fillStyle = rgba(HUD.white, alpha * (0.55 + 0.45 * v));
    const bh = Math.max(2, h * v);
    ctx.fillRect(x + i * bw + bw * 0.18, y + h - bh, bw * 0.64, bh);
  });
};

export const circleButton = (
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
  lw = 5,
) => {
  ctx.lineWidth = lw;
  ctx.strokeStyle = HUD.white;
  ctx.fillStyle = HUD.white;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  if (filled) ctx.fill();
  else ctx.stroke();
};

export const grid = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  color: string,
  lw = 2,
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    const gx = Math.round(x + (w * c) / cols) + 0.5;
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
  }
  for (let r = 0; r <= rows; r++) {
    const gy = Math.round(y + (h * r) / rows) + 0.5;
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
  }
  ctx.stroke();
};

// Filler "code" text: random lower/upper-case groups, never real words.
export const fillerLine = (seed: number, i: number, words: number) => {
  const parts: string[] = [];
  for (let k = 0; k < words; k++) {
    const len = 3 + Math.floor(hash01(seed, i, k) * 7);
    let s = "";
    for (let c = 0; c < len; c++) {
      const ch = String.fromCharCode(97 + Math.floor(hash01(seed + 7, i * 31 + k, c) * 26));
      s += c === 0 && hash01(seed + 3, i, k) < 0.4 ? ch.toUpperCase() : ch;
    }
    parts.push(s);
  }
  const sep = hash01(seed + 11, i) < 0.3 ? "." : " ";
  return parts.join(sep) + (hash01(seed + 13, i) < 0.4 ? "();" : "");
};

export const fillerColumn = (
  ctx: Ctx,
  seed: number,
  x: number,
  y: number,
  size: number,
  lines: number,
  alpha: number,
) => {
  ctx.font = inter(size, 400);
  ctx.fillStyle = rgba(HUD.line, alpha);
  ctx.textBaseline = "top";
  for (let i = 0; i < lines; i++) {
    const indent = Math.floor(hash01(seed + 5, i) * 3) * size * 1.5;
    ctx.fillText(fillerLine(seed, i, 2 + Math.floor(hash01(seed, i) * 4)), x + indent, y + i * size * 1.45);
  }
};

// ---------------------------------------------------------------- values
// All periodic in the composition length.

// A price that wanders and returns to its start at the loop.
export const makePrice = (seed: number, base: number, swing: number) => {
  const walk = makeLoopWalk(seed, 24);
  return (frame: number, loop: number) => {
    const v = base + (walk(frame, loop) - 0.5) * swing;
    const prev = base + (walk(frame - 6, loop) - 0.5) * swing;
    return { text: v.toFixed(2), dir: (v >= prev ? 1 : -1) as 1 | -1 };
  };
};

// A two-digit counter on a hold-and-step schedule (hold divides loop).
export const counter2 = (seed: number, frame: number, hold: number, loop: number) =>
  String(10 + Math.floor(hash01(seed, holdIndex(frame, hold, loop)) * 90));

export const codeLine = (seed: number, frame: number, hold: number, loop: number) => {
  const i = holdIndex(frame, hold, loop);
  return {
    digits: `${randomDigits(seed, i, 4)} ${randomDigits(seed + 1, i, 5)} ${randomDigits(seed + 2, i, 4)}`,
    caps: `${randomCaps(seed, i, 5)} ${randomCaps(seed + 3, i, 4)}`,
  };
};

// Bar lengths: each bar its own closed random walk.
export const makeBars = (seed: number, n: number) => {
  const walks = Array.from({ length: n }, (_, i) => makeLoopWalk(seed * 97 + i, 10));
  return (frame: number, loop: number, lo = 0.15, hi = 1) =>
    walks.map((w) => lo + (hi - lo) * w(frame, loop));
};
