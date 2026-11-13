import type { Palette } from "../lib/palettes";
import { clamp, digits, epoch, rand, randInt, smooth } from "../lib/random";

// All layout is authored in a 768 x 432 "design space" (the reference's
// native grid) and scaled up uniformly to the composition size (3840 x 2160).
export const DESIGN_W = 768;
export const DESIGN_H = 432;

type Ctx = CanvasRenderingContext2D;

const FONT = "Rajdhani";
const MONO = "ShareTechMono";

const setFont = (ctx: Ctx, size: number, weight = 600, family = FONT) => {
  ctx.font = `${weight} ${size}px ${family}`;
};

const text = (
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 600,
  align: CanvasTextAlign = "left",
  family = FONT,
) => {
  setFont(ctx, size, weight, family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
};

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const strokeRect = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lw = 0.5,
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
};

const dot = (ctx: Ctx, x: number, y: number, r: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const triangle = (ctx: Ctx, x: number, y: number, s: number, color: string) => {
  // Right-angled triangle with the right angle at bottom-right (x, y).
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x, y - s);
  ctx.closePath();
  ctx.fill();
};

/** A row of tiny "data" words, like the reference's micro-captions. */
const microRow = (
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  id: number,
  frame: number,
  p: Palette,
  opts: { size?: number; bright?: number; rate?: [number, number]; mono?: boolean } = {},
) => {
  const size = opts.size ?? 3.4;
  const bright = opts.bright ?? 0.35;
  const [a, b] = opts.rate ?? [20, 80];
  let cx = x;
  let i = 0;
  setFont(ctx, size, 700, opts.mono ? MONO : FONT);
  ctx.textAlign = "left";
  while (cx < x + width - 4) {
    const len = 2 + randInt(5, id, i, 1);
    const ep = epoch(frame, id * 31 + i, a, b);
    const isWord = rand(id, i, 3) < 0.35;
    const s = isWord
      ? ["DATA", "SYS", "CODE", "RATE", "SECT", "NODE", "SEQ", "REF", "FEED"][randInt(9, id, i, 4)]
      : digits(len, id, i, ep);
    ctx.fillStyle = rand(id, i, 5) < bright ? p.text : p.dim;
    ctx.fillText(s, cx, y);
    cx += ctx.measureText(s).width + 2.4 + rand(id, i, 6) * 3;
    i++;
  }
};

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------
const drawBackground = (ctx: Ctx, p: Palette) => {
  rect(ctx, 0, 0, DESIGN_W, DESIGN_H, p.bg);
  // faint dotted grid like a monitor HUD backplate
  ctx.fillStyle = p.grid;
  for (let gx = 4; gx < DESIGN_W; gx += 8) {
    for (let gy = 4; gy < DESIGN_H; gy += 8) {
      ctx.fillRect(gx - 0.35, gy - 0.05, 0.7, 0.1);
      ctx.fillRect(gx - 0.05, gy - 0.35, 0.1, 0.7);
    }
  }
};

const drawVignette = (ctx: Ctx, p: Palette) => {
  const g = ctx.createRadialGradient(
    DESIGN_W / 2,
    DESIGN_H / 2,
    DESIGN_H * 0.35,
    DESIGN_W / 2,
    DESIGN_H / 2,
    DESIGN_W * 0.62,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, p.vignette);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
};

// ---------------------------------------------------------------------------
// Left column
// ---------------------------------------------------------------------------
const animatedBar = (frame: number, id: number, min: number, max: number) => {
  // Bar eases between random targets every ~1-2 seconds.
  const period = 30 + randInt(30, id, 1);
  const phase = randInt(period, id, 2);
  const e = Math.floor((frame + phase) / period);
  const t = ((frame + phase) % period) / period;
  const a = min + rand(id, e) * (max - min);
  const b = min + rand(id, e + 1) * (max - min);
  return a + (b - a) * smooth(t / 0.35);
};

/** Fast, wide-swinging value (gauges): new target every ~0.4-0.7 s. */
const fastBar = (frame: number, id: number, min: number, max: number) => {
  const period = 12 + randInt(9, id, 1);
  const phase = randInt(period, id, 2);
  const e = Math.floor((frame + phase) / period);
  const t = ((frame + phase) % period) / period;
  const a = min + rand(id, e) * (max - min);
  const b = min + rand(id, e + 1) * (max - min);
  return a + (b - a) * smooth(t / 0.6);
};

const drawLeftColumn = (ctx: Ctx, f: number, p: Palette) => {
  ctx.textBaseline = "alphabetic";
  text(ctx, "DATA SEQUENCE ANALYSIS", 8, 16.4, 13.2, p.text, 600);
  // two rows of tiny numbers under the title
  for (let r = 0; r < 2; r++) {
    microRow(ctx, 8, 24.5 + r * 5.6, 140, 100 + r, f, p, { size: 4.2, bright: 0.6 });
  }

  // steel-blue progress bars
  const barY = [43.7, 52, 60.3, 68.7];
  barY.forEach((y, i) => {
    const w = animatedBar(f, 200 + i, 40, 100);
    rect(ctx, 9, y - 0.9, 100, 1.8, "rgba(255,255,255,0.05)");
    rect(ctx, 9, y - 0.9, w, 1.8, p.bar);
    if (i === 1) dot(ctx, 121, y, 0.6, p.dim);
    text(ctx, digits(5, 210 + i, epoch(f, 210 + i, 6, 18)), 127, y + 1.4, 4.2, p.text, 700);
    text(ctx, digits(5, 220 + i, epoch(f, 220 + i, 10, 30)), 141, y + 1.4, 4.2, p.dim, 700);
  });

  // three blue tag chips
  const tags = ["ACV", "DCS", "V-CH"];
  tags.forEach((t, i) => {
    const x = 9 + i * 42.5;
    rect(ctx, x, 78.5, 27, 5.6, p.bar);
    ctx.globalAlpha = 0.9;
    text(ctx, `${t} : ${digits(3, 300 + i, epoch(f, 300 + i, 8, 20))}`, x + 1.5, 82.9, 5, p.bg, 700);
    ctx.globalAlpha = 1;
    triangle(ctx, x + 31, 85, 3, p.accent);
    microRow(ctx, x + 6, 89.3, 24, 310 + i, f, p, { size: 2.6, bright: 0.2 });
  });

  // sliders with orange knobs
  for (let i = 0; i < 5; i++) {
    const y = 100 + i * 8.33;
    const w = animatedBar(f, 400 + i, 30, 95);
    rect(ctx, 10, y - 0.3, 95, 0.6, p.faint);
    rect(ctx, 10, y - 0.3, w, 0.6, p.dim);
    for (let k = 0; k < 8; k++) rect(ctx, 14 + k * 12, y - 1, 0.4, 2, p.faint);
    dot(ctx, 10, y, 1.35, p.accent);
    text(ctx, digits(5, 410 + i, epoch(f, 410 + i, 8, 24)), 127, y + 1.4, 4.2, p.dim, 700);
    text(ctx, digits(5, 420 + i, epoch(f, 420 + i, 12, 40)), 141, y + 1.4, 4.2, p.dim, 700);
  }

  // DATA ANALYSIS
  text(ctx, "DATA ANALYSIS", 9, 150, 6.8, p.text, 600);
  dot(ctx, 65, 148.2, 0.9, p.accent);
  for (let k = 0; k < 9; k++) rect(ctx, 72 + k * 9, 148, 0.5, 0.5, p.faint);
  for (let r = 0; r < 3; r++) microRow(ctx, 9, 158 + r * 6, 120, 500 + r, f, p, { size: 3.3 });

  // barcode strip with flickering teal ticks
  const barcode = (y: number, id: number, x0: number, x1: number) => {
    triangle(ctx, x0 + 4, y + 2, 4, p.accent);
    rect(ctx, x0 + 5, y - 1.2, x1 - x0 - 5, 2.6, "rgba(255,255,255,0.06)");
    const ep = epoch(f, id, 3, 6);
    for (let k = 0; k < 34; k++) {
      if (rand(id, k, ep) < 0.45) continue;
      const x = x0 + 7 + k * ((x1 - x0 - 9) / 34);
      const w = 0.5 + rand(id, k, ep, 1) * 2.2;
      ctx.globalAlpha = 0.35 + rand(id, k, ep, 2) * 0.65;
      rect(ctx, x, y - 1, w, 2.2, rand(id, k, 9) < 0.7 ? p.accent2 : p.text);
    }
    ctx.globalAlpha = 1;
  };
  barcode(183.5, 600, 9, 150);

  text(ctx, "CORE DATA - 04", 9, 199.8, 6.8, p.text, 600);
  dot(ctx, 63, 197.8, 0.9, p.accent);
  rect(ctx, 66, 197.6, 71, 0.4, p.faint);
  for (let r = 0; r < 4; r++) microRow(ctx, 9, 207 + r * 5.6, 120, 650 + r, f, p, { size: 3.3 });
  barcode(231.6, 700, 9, 150);

  // DATA PROCESSING file icons: each counts 0 -> 100, then the next one starts.
  const ICON_FRAMES = 118;
  const active = Math.min(4, Math.floor((f + 4) / ICON_FRAMES));
  for (let i = 0; i <= active; i++) {
    // slot 0 is the icon currently counting; finished icons sit to its right
    const x = 9 + (active - i) * 19.8;
    const y = 248;
    const local = f + 4 - i * ICON_FRAMES;
    const value = i < active ? 100 : Math.min(100, 4 + Math.floor(clamp(local / (ICON_FRAMES - 6)) * 96));
    const done = value >= 100;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, y, 16, 20);
    ctx.strokeStyle = p.text;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 11, y);
    ctx.lineTo(x + 16, y + 5);
    ctx.lineTo(x + 16, y + 20);
    ctx.lineTo(x, y + 20);
    ctx.closePath();
    ctx.stroke();
    // folded corner
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(x + 11, y);
    ctx.lineTo(x + 16, y + 5);
    ctx.lineTo(x + 11, y + 5);
    ctx.closePath();
    ctx.fill();
    text(ctx, "CODE", x + 1.5, y + 3.6, 2.6, p.text, 700);
    rect(ctx, x + 1.5, y + 5, 6, 0.5, p.accent);
    rect(ctx, x + 1.5, y + 6.5, 4, 0.5, p.dim);
    rect(ctx, x + 1.2, y + 10.5, 1.1, 8, done ? p.bar : p.accent);
    text(ctx, String(value), x + 2.8, y + 18.4, value >= 100 ? 9 : 10.5, done ? p.text : p.accent, 500);
  }
  const labelX = 9 + (active + 1) * 19.8 + 2;
  text(ctx, "DATA PROCESSING", labelX, 256, 4.1, p.text, 700);
  dot(ctx, labelX + 34, 254.8, 0.7, p.accent);
  microRow(ctx, labelX, 261.5, 52, 760, f, p, { size: 2.6, bright: 0.2 });
  microRow(ctx, labelX, 265.5, 52, 761, f, p, { size: 2.6, bright: 0.2 });

  // orange progress lines
  rect(ctx, 9, 279.6, animatedBar(f, 780, 95, 114), 0.6, p.accent);
  rect(ctx, 9, 284.6, animatedBar(f, 781, 55, 105), 0.6, p.accent);
  text(ctx, digits(5, 782, epoch(f, 782, 8, 20)), 127, 281, 4.2, p.text, 700);
  text(ctx, digits(5, 783, epoch(f, 783, 8, 20)), 141, 281, 4.2, p.dim, 700);
  text(ctx, digits(5, 784, epoch(f, 784, 8, 20)), 133, 286.5, 4.2, p.text, 700);

  // glitch rows
  for (let r = 0; r < 5; r++) {
    const y = 295 + r * 9.3;
    text(ctx, digits(5, 800 + r, epoch(f, 800 + r, 15, 40)), 9, y + 1.4, 3.6, p.dim, 700);
    text(ctx, digits(5, 810 + r, epoch(f, 810 + r, 15, 40)), 21, y + 1.4, 3.6, p.dim, 700);
    dot(ctx, 35, y, 0.9, r === 2 ? p.text : p.accent);
    rect(ctx, 39, y - 0.2, 112, 0.4, p.faint);
    const ep = epoch(f, 820 + r, 2, 4);
    for (let k = 0; k < 26; k++) {
      if (rand(820 + r, k, ep) < 0.5) continue;
      const x = 40 + rand(820 + r, k, ep, 1) * 108;
      const w = 0.6 + rand(820 + r, k, ep, 2) * 3.4;
      const h = 0.8 + rand(820 + r, k, ep, 3) * 2.2;
      ctx.globalAlpha = 0.3 + rand(820 + r, k, ep, 4) * 0.7;
      rect(ctx, x, y - h / 2, w, h, rand(820 + r, k, 5) < 0.75 ? p.accent2 : p.text);
    }
    ctx.globalAlpha = 1;
  }

  text(ctx, "ENCODING DATA FEED", 9, 345.6, 6.8, p.text, 600);
  microRow(ctx, 9, 351, 90, 870, f, p, { size: 3.1 });
  rect(ctx, 9, 353, animatedBar(f, 871, 40, 55), 0.5, p.dim);
  rect(ctx, 9, 357.6, animatedBar(f, 872, 80, 100), 0.5, p.dim);
  rect(ctx, 9, 362.2, animatedBar(f, 873, 95, 115), 0.5, p.dim);
  text(ctx, "SEQUENCE", 9, 368.5, 2.6, p.faint, 700);

  // mini tables
  const tables = [
    { x: 9, w: 24, cols: 5, chip: true },
    { x: 37, w: 13, cols: 3, chip: false },
    { x: 57, w: 24, cols: 5, chip: true },
    { x: 85, w: 9, cols: 2, chip: false },
    { x: 97, w: 24, cols: 5, chip: true },
    { x: 128, w: 24, cols: 5, chip: true },
  ];
  tables.forEach((t, ti) => {
    if (t.chip) {
      rect(ctx, t.x, 375.6, t.w, 3.4, p.chip);
      text(ctx, "DATA ANALYSIS", t.x + 1, 378.2, 2.4, p.text, 700);
    } else {
      text(ctx, "DATA", t.x, 378.2, 2.4, p.dim, 700);
    }
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < t.cols; c++) {
        const ep = epoch(f, 900 + ti * 100 + r * 10 + c, 20, 90);
        const v = randInt(10, 900 + ti, r, c, ep);
        const bright = rand(901 + ti, r, c, ep) < 0.3;
        text(ctx, String(v), t.x + 1 + c * 4.7, 385 + r * 4.6, 3.2, bright ? p.text : p.dim, 700);
      }
    }
    // occasional outline highlight
    const ep = epoch(f, 990 + ti, 12, 30);
    const rr = randInt(8, 990 + ti, ep);
    if (rand(991 + ti, ep) < 0.6) strokeRect(ctx, t.x, 382 + rr * 4.6, t.w, 3.8, p.dim, 0.35);
  });
};

// ---------------------------------------------------------------------------
// Header / counter
// ---------------------------------------------------------------------------
const COUNTER_GROUPS = [3, 4, 1, 3];
const COUNTER_DIGITS = 11;

/**
 * Counter state at frame f: starts from a random number, then roughly every
 * 2-3 frames one digit steps (+1 mostly, sometimes a random jump), like the
 * reference's decoding readout.
 */
const counterDigits = (f: number): number[] => {
  const d = Array.from({ length: COUNTER_DIGITS }, (_, i) => randInt(10, 1200, i));
  let t = 0;
  for (let k = 0; ; k++) {
    t += 2 + randInt(2, 1201, k);
    if (t > f) break;
    const i = randInt(COUNTER_DIGITS, 1202, k);
    d[i] = rand(1203, k) < 0.75 ? (d[i] + 1) % 10 : randInt(10, 1204, k);
  }
  return d;
};

const drawCounterDigit = (ctx: Ctx, d: number, cx: number, baseline: number, color: string) => {
  ctx.fillStyle = color;
  if (d === 1) {
    // squarish techno "1": a plain vertical stroke (no flag), as in the reference
    ctx.fillRect(cx - 1.25, baseline - 20.6, 2.5, 20.6);
    return;
  }
  setFont(ctx, 31, 500);
  ctx.fillText(String(d), cx, baseline);
};

const drawHeader = (ctx: Ctx, f: number, p: Palette) => {
  text(ctx, "Decoding DATA  :", 186, 14.5, 7.2, p.text, 500);
  text(ctx, digits(4, 1100, epoch(f, 1100, 2, 4)), 246, 14.5, 7.2, p.accent, 500);
  text(ctx, "ANALYSIS PROCESSING DATA", 186, 19.6, 2.8, p.dim, 700);
  microRow(ctx, 186, 23.5, 60, 1101, f, p, { size: 2.8, bright: 0.5 });
  dot(ctx, 187.5, 28.6, 0.8, p.accent);
  text(
    ctx,
    `${digits(9, 1102, epoch(f, 1102, 4, 8))} ${digits(3, 1103, epoch(f, 1103, 6, 12))} ${digits(6, 1104, epoch(f, 1104, 3, 6))}`,
    190.5,
    30.4,
    5,
    p.accent2,
    600,
  );

  // small orange tab + dim data table at the top
  rect(ctx, 282, 7.3, 20, 1.8, p.accent);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      microRow(ctx, 306 + c * 45, 9.2 + r * 4.6, 40, 1110 + r * 10 + c, f, p, {
        size: 2.4,
        bright: 0.1,
      });
    }
  }
  rect(ctx, 305, 26.5, 225, 0.6, p.faint);
  rect(ctx, 305, 26.5, animatedBar(f, 1150, 60, 200), 0.6, p.dim);

  // Big digit counter: each digit flips independently at irregular intervals.
  ctx.textAlign = "center";
  let x = 186;
  let idx = 0;
  const cd = counterDigits(f);
  COUNTER_GROUPS.forEach((n, g) => {
    for (let i = 0; i < n; i++) {
      const bw = 23.6;
      const bh = 28.5;
      rect(ctx, x, 44, bw, bh, "rgba(255,255,255,0.025)");
      strokeRect(ctx, x, 44, bw, bh, p.outline, 0.6);
      drawCounterDigit(ctx, cd[idx], x + bw / 2, 68.6, p.text);
      const lit = rand(1250 + idx, epoch(f, 1250 + idx, 10, 30)) < 0.75;
      rect(ctx, x + bw - 2.2, 44 + bh - 1.6, 2.8, 2.8, lit ? p.accent : p.accentDim);
      x += 28.3;
      idx++;
    }
    if (g < COUNTER_GROUPS.length - 1) {
      rect(ctx, x + 0.9, 57.6, 6.2, 1.5, p.text);
      x += 12.3;
    }
  });
  ctx.textAlign = "left";

  // top-right wave graph panel
  rect(ctx, 546, 7, 171, 24, p.panel);
  strokeRect(ctx, 546, 7, 171, 24, "rgba(255,255,255,0.06)", 0.4);
  for (let k = 0; k < 12; k++) rect(ctx, 548 + k * 14, 8.5, 9, 0.4, "rgba(255,255,255,0.08)");
  const phase = f / 30;
  for (let w = 0; w < 2; w++) {
    for (let k = 0; k <= 120; k++) {
      const xx = 550 + k * 1.35;
      const yy =
        19 + Math.sin(k * 0.085 + phase * (w ? 1.3 : 0.9) + w * 2.2) * 6 * (w ? 0.8 : 1);
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(k * 0.6 + w);
      rect(ctx, xx, yy, 0.55, 0.55, p.text);
    }
  }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 7; k++) {
    const kx = 560 + k * 22 + ((f * 0.4) % 22);
    const ky = 19 + Math.sin((kx - 550) / 1.35 * 0.085 + phase * 0.9) * 6;
    rect(ctx, kx - 1, ky - 1, 2, 2, p.text);
    text(ctx, digits(3, 1300 + k, epoch(f, 1300 + k, 6, 12)), kx + 2, ky - 1.5, 2.4, p.dim, 700);
  }
  rect(ctx, 719, 7, 39, 22, p.infoPanel);
  rect(ctx, 719, 7, 39, 3.2, p.infoHeader);
  text(ctx, "SYS 2  LOG 207", 720.5, 9.6, 2.4, p.bg, 700);
  microRow(ctx, 721, 15, 15, 1310, f, p, { size: 2.1 });
  microRow(ctx, 721, 19, 15, 1311, f, p, { size: 2.1 });
  microRow(ctx, 721, 23, 15, 1313, f, p, { size: 2.1 });
  text(ctx, `[${digits(2, 1312, epoch(f, 1312, 20, 40))}]`, 756.5, 21.5, 6.4, p.infoValue, 500, "right");

  // orange lines under the graph
  const l1 = animatedBar(f, 1320, 20, 40);
  const l2 = animatedBar(f, 1321, 50, 80);
  rect(ctx, 546, 49, 138, 0.55, p.accentDim);
  rect(ctx, 546, 49, l1, 0.55, p.accent);
  rect(ctx, 546, 53.4, 138, 0.55, p.accentDim);
  rect(ctx, 546, 53.4, l2, 0.55, p.accent);
  microRow(ctx, 546, 61, 70, 1330, f, p, { size: 2.6, bright: 0.6 });
  microRow(ctx, 546, 65.5, 70, 1331, f, p, { size: 2.6, bright: 0.6 });
};

// ---------------------------------------------------------------------------
// Main number grid
// ---------------------------------------------------------------------------
type Col = { x: number; n: number; header: string; chip: boolean };
const COLS: Col[] = [
  { x: 186, n: 10, header: "DATA ANALYSIS : 001", chip: true },
  { x: 258, n: 5, header: "DATA : [ P3 ]", chip: false },
  { x: 298, n: 5, header: "DATA : [ P4 ]", chip: false },
  { x: 351, n: 10, header: "DATA ANALYSIS : 002", chip: true },
  { x: 422, n: 5, header: "DATA : [ P8 ]", chip: false },
  { x: 461, n: 10, header: "DATA ANALYSIS : 003", chip: true },
  { x: 546, n: 5, header: "DATA : [ P6 ]", chip: false },
  { x: 585, n: 5, header: "DATA : [ P5 ]", chip: false },
  { x: 626, n: 10, header: "DATA ANALYSIS : 004", chip: true },
];
const PITCH = 6.1;
const ROWS: number[] = [
  ...Array.from({ length: 14 }, (_, i) => 116 + i * 9.92),
  ...Array.from({ length: 6 }, (_, i) => 265 + i * 9.95),
  334,
  344,
];

const drawGrid = (ctx: Ctx, f: number, p: Palette) => {
  // headers
  COLS.forEach((c) => {
    const w = c.n * PITCH;
    if (c.chip) {
      rect(ctx, c.x - 1, 89.2, w + 2, 8, p.chip);
      text(ctx, c.header, c.x + 1.5, 95.3, 4.9, p.text, 700);
    } else {
      text(ctx, c.header, c.x, 95.3, 4.9, p.dim, 600);
    }
  });
  // column dividers
  rect(ctx, 339.6, 110, 0.5, 240, "rgba(255,255,255,0.12)");
  rect(ctx, 536.3, 110, 0.5, 240, "rgba(255,255,255,0.12)");

  // jumping highlight boxes (drawn under the digits)
  const outlines: [number, number, number, number][] = [];
  for (let b = 0; b < 26; b++) {
    const ep = epoch(f, 1500 + b, 2, 5);
    const ci = randInt(COLS.length, 1500 + b, ep, 1);
    const col = COLS[ci];
    const ri = randInt(ROWS.length, 1500 + b, ep, 2);
    const type = randInt(3, 1500 + b, 3); // stable type per box
    if (rand(1500 + b, ep, 4) < 0.15) continue; // sometimes hidden
    if (type === 0) {
      const span = Math.min(col.n, 2 + randInt(5, 1500 + b, ep, 5));
      const start = randInt(col.n - span + 1, 1500 + b, ep, 6);
      rect(ctx, col.x + start * PITCH - 1, ROWS[ri] - 4.2, span * PITCH + 0.6, 6, p.chip);
    } else if (type === 1) {
      const span = Math.min(col.n, 4 + randInt(5, 1500 + b, ep, 5));
      const start = randInt(col.n - span + 1, 1500 + b, ep, 6);
      outlines.push([col.x + start * PITCH - 1.2, ROWS[ri] - 4.6, span * PITCH + 1, 6.8]);
    } else {
      const rows = 4 + randInt(2, 1500 + b, ep, 5);
      const r0 = Math.min(ri, 13 - rows + 1);
      const start = randInt(col.n, 1500 + b, ep, 6);
      outlines.push([col.x + start * PITCH - 1.4, ROWS[Math.max(0, r0)] - 5, PITCH + 1.2, rows * 9.92 + 0.5]);
    }
  }

  // digits
  setFont(ctx, 5.7, 700);
  ctx.textAlign = "center";
  COLS.forEach((c, ci) => {
    ROWS.forEach((y, ri) => {
      for (let i = 0; i < c.n; i++) {
        const id = 2000 + ci * 1000 + ri * 20 + i;
        const ep = epoch(f, id, 14, 90);
        const v = randInt(10, id, ep);
        const cr = rand(id, Math.floor((i + randInt(3, ci, ri)) / 3), ep, 1);
        const cr2 = rand(id, ep, 2);
        ctx.fillStyle = cr < 0.2 ? p.accent : cr2 < 0.3 ? p.text : p.gridDim;
        ctx.fillText(String(v), c.x + i * PITCH + 2.2, y + 0.4);
      }
    });
  });
  ctx.textAlign = "left";
  outlines.forEach(([x, y, w, h]) => strokeRect(ctx, x, y, w, h, p.dim, 0.45));
};

// ---------------------------------------------------------------------------
// Right column
// ---------------------------------------------------------------------------
const drawRightColumn = (ctx: Ctx, f: number, p: Palette) => {
  const lines: [number, number][] = [
    [715.7, 182],
    [720.7, 182],
    [725.7, 182],
  ];
  lines.forEach(([x, end], i) => {
    const h = fastBar(f, 1700 + i, 12, end - 89);
    rect(ctx, x - 0.45, 89, 0.9, end - 89, "rgba(255,255,255,0.08)");
    rect(ctx, x - 0.45, 89, 0.9, h, p.accent2);
  });
  // gauges
  [98, 123, 147, 172].forEach((y, i) => {
    const cx = 742;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(cx, y, 6.6, 0, Math.PI * 2);
    ctx.stroke();
    const v = fastBar(f, 1710 + i, 0.05, 0.95);
    ctx.strokeStyle = p.accent2;
    ctx.beginPath();
    ctx.arc(cx, y, 6.6, -Math.PI / 2 - v * Math.PI * 2, -Math.PI / 2);
    ctx.stroke();
    // value sits in the ring's lower-right gap, clear of the arc
    text(ctx, (v * 100).toFixed(2), 748.5, y + 8.2, 3.4, p.text, 700);
  });
  text(ctx, "DATA . ANALYSIS", 731, 187.5, 2.6, p.dim, 700);

  // dot matrix
  for (let r = 0; r < 29; r++) {
    if (r === 11 || r === 22) continue;
    for (let c = 0; c < 12; c++) {
      const ep = epoch(f, 1800 + r * 12 + c, 10, 60);
      const v = rand(1800 + r, c, ep);
      const color = v < 0.16 ? p.accent2 : v < 0.8 ? p.text : p.faint;
      rect(ctx, 713 + c * 4.3, 205 + r * 4.4, 1.3, 1.3, color);
    }
  }
  for (let b = 0; b < 3; b++) {
    const ep = epoch(f, 1900 + b, 15, 35);
    const r = randInt(29, 1900 + b, ep);
    const c = randInt(8, 1900 + b, ep, 1);
    rect(ctx, 712.2 + c * 4.3, 204.2 + r * 4.4, 4.3 * (2 + randInt(3, 1900 + b, ep, 2)), 2.6, p.chip);
  }
};

// ---------------------------------------------------------------------------
// Bottom strip
// ---------------------------------------------------------------------------
const card = (ctx: Ctx, x: number, y: number, value: string, p: Palette, alpha = 1) => {
  ctx.globalAlpha = alpha;
  rect(ctx, x, y, 20.5, 21, p.card);
  rect(ctx, x - 1.3, y + 2, 0.6, 19, p.cardCorner);
  text(ctx, value, x + 19.2, y + 8.6, 9.5, p.text, 500, "right");
  text(ctx, "DCS - 062", x + 2, y + 12.6, 2.8, p.text, 700);
  rect(ctx, x + 2, y + 13.6, 9, 0.35, p.dim);
  text(ctx, "INDEX 0322", x + 2, y + 16.4, 2.2, p.dim, 700);
  triangle(ctx, x + 20.5, y + 21, 4, p.cardCorner);
  ctx.globalAlpha = 1;
};

const drawBottom = (ctx: Ctx, f: number, p: Palette) => {
  // text block + sliders
  for (let r = 0; r < 3; r++) microRow(ctx, 186, 377 + r * 5, 100, 2100 + r, f, p, { size: 3.1, bright: 0.45 });
  ["RANGE", "TRACK", "DEPTH", "SCAN"].forEach((label, i) => {
    const y = 395 + i * 7.5;
    text(ctx, label, 186, y + 1, 2.6, p.dim, 700);
    rect(ctx, 206, y - 0.25, 82, 0.5, p.faint);
    rect(ctx, 206, y - 0.25, animatedBar(f, 2110 + i, 40, 82), 0.5, p.dim);
    dot(ctx, 206, y, 1.25, p.accent);
  });
  const ep = epoch(f, 2120, 3, 6);
  rect(ctx, 186, 420, 102, 2.4, "rgba(255,255,255,0.06)");
  for (let k = 0; k < 30; k++) {
    if (rand(2120, k, ep) < 0.5) continue;
    ctx.globalAlpha = 0.4 + rand(2120, k, ep, 1) * 0.6;
    rect(ctx, 188 + k * 3.3, 420.3, 0.6 + rand(2120, k, ep, 2) * 2, 1.8, p.accent2);
  }
  ctx.globalAlpha = 1;

  // two stacked cards
  card(ctx, 305, 375, digits(2, 2130, epoch(f, 2130, 20, 45)), p);
  card(ctx, 305, 402, digits(2, 2131, epoch(f, 2131, 20, 45)), p);

  // SYS blocks
  [
    { x: 340, label: "SYS - 001 - SECTOR 08042" },
    { x: 419, label: "SYS - 002 - SECTOR 66317" },
    { x: 497, label: "SYS - 003 - SECTOR 17359" },
  ].forEach((s, i) => {
    dot(ctx, s.x + 0.8, 376.3, 0.85, p.accent2);
    text(ctx, s.label, s.x + 3, 377.6, 3, p.text, 700);
    for (let r = 0; r < 4; r++) {
      microRow(ctx, s.x + 5, 383 + r * 3.8, 58, 2200 + i * 10 + r, f, p, { size: 2.5, bright: 0.25 });
    }
    rect(ctx, s.x + 1, 380, 0.4, 20, p.accent2);
    text(ctx, "STANDBY . RECEIVE DATA", s.x + 5, 401, 2.2, p.accent2, 700);
  });
  [409, 416].forEach((y, i) => {
    rect(ctx, 342, y - 1.6, 13, 3.2, p.accent2);
    ctx.globalAlpha = 0.6;
    rect(ctx, 342, y - 1.6, 13, 3.2, p.panel);
    ctx.globalAlpha = 1;
    microRow(ctx, 358, y + 0.9, 50, 2240 + i, f, p, { size: 2.2 });
  });
  rect(ctx, 419, 407.6, 138, 0.6, p.accentDim);
  rect(ctx, 419, 407.6, animatedBar(f, 2250, 90, 136), 0.6, p.accent);
  rect(ctx, 419, 412.6, 138, 0.4, p.faint);
  microRow(ctx, 419, 418.5, 70, 2251, f, p, { size: 2.4, bright: 0.6 });
  microRow(ctx, 419, 423, 70, 2252, f, p, { size: 2.4, bright: 0.6 });

  // six cards build in right-to-left during the first ~0.8 s, then stay;
  // only their numbers keep changing.
  const xs = [577, 609.5, 642, 674.5, 707, 739.5];
  xs.forEach((x, i) => {
    const tIn = (5 - i) * 4 - 1;
    if (f < tIn) return;
    const fadeIn = clamp((f - tIn + 1) / 3);
    const value = digits(2, 2300 + i, epoch(f, 2300 + i, 4, 12));
    card(ctx, x, 375, value, p, fadeIn);
  });
  // dot tables under the cards
  for (let g = 0; g < 6; g++) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const ep2 = epoch(f, 2400 + g * 40 + r * 6 + c, 15, 60);
        const v = rand(2400 + g, r, c, ep2);
        rect(ctx, 577 + g * 31 + c * 4.2, 401 + r * 4.6, 1.2, 1.2, v < 0.75 ? p.text : p.faint);
      }
    }
    const ep3 = epoch(f, 2500 + g, 10, 30);
    if (rand(2500 + g, ep3) < 0.7) {
      const r = randInt(5, 2500 + g, ep3, 1);
      rect(ctx, 576 + g * 31, 400 + r * 4.6, 4.2 * (2 + randInt(4, 2500 + g, ep3, 2)), 2.8, p.chip);
    }
  }
};

// ---------------------------------------------------------------------------
export const drawHud = (ctx: Ctx, frame: number, p: Palette) => {
  ctx.textBaseline = "alphabetic";
  drawBackground(ctx, p);
  drawLeftColumn(ctx, frame, p);
  drawHeader(ctx, frame, p);
  drawGrid(ctx, frame, p);
  drawRightColumn(ctx, frame, p);
  drawBottom(ctx, frame, p);
  drawVignette(ctx, p);
};
