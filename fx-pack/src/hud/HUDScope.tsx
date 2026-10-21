import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { Canvas2D, Draw2D } from "../lib/Canvas2D";
import { useFont } from "../lib/useFont";
import { hash01, loopNoise, mulberry32, TAU } from "../lib/random";
import { HUD } from "./palette";

const W = 3840;
const H = 2160;
const LOOP = 600;
const FONT = "Share Tech Mono";

const rand = mulberry32(0x5c0be);

// --- bar stack (left edge): ~30 bars, each on its own whole-cycle rhythm ---
const BARS = Array.from({ length: 30 }, () => ({
  base: 22 + rand() * 30,
  amp: 10 + rand() * 45,
  thick: 0.45 + rand() * 0.35,
  dx: rand() < 0.25 ? 8 + rand() * 10 : 0,
  k: 1 + Math.floor(rand() * 6),
  ph: rand() * TAU,
  k2: 3 + Math.floor(rand() * 9),
  ph2: rand() * TAU,
}));

// --- drifting squares with 2-character tags --------------------------------
const TAG_CHARS = "ABCDEFHKLMNPRTXZ";
const SQUARES = Array.from({ length: 4 }, (_, i) => ({
  x: [0.085, 0.18, 0.47, 0.88][i] * W + (rand() - 0.5) * 60,
  y: [0.52, 0.085, 0.95, 0.9][i] * H + (rand() - 0.5) * 60,
  rx: 40 + rand() * 90,
  ry: 30 + rand() * 70,
  k: 1 + Math.floor(rand() * 2),
  ph: rand() * TAU,
  tag: TAG_CHARS[Math.floor(rand() * 16)] + String(Math.floor(rand() * 10)),
}));

// --- sine curve: two large humps, sliding and breathing --------------------
const breathe = loopNoise(mulberry32(77), 2);
const sineY = (u: number, phase: number) => {
  const b = breathe(phase);
  const g = (c: number, w: number) => Math.exp(-Math.pow((u - c) / w, 2));
  const drift = 0.03 * Math.sin(TAU * phase); // slow sideways slide (one cycle per loop)
  return (
    0.565 * H +
    0.11 * H * g(0.11 + drift, 0.1) -                     // deep left trough
    0.07 * H * (1 - 0.3 * b) * g(0.27 + drift, 0.07) -    // small hump
    0.33 * H * (1 + 0.12 * b) * g(0.585 + drift, 0.105) +  // big hump, mid-frame
    0.12 * H * g(1.0 + drift, 0.12) +                     // falls away to the right
    0.012 * H * Math.sin(TAU * (3 * u - 2 * phase))       // slight unevenness
  );
};

// --- dial ---------------------------------------------------------------------
const DIAL = { x: 0.793 * W, y: 0.632 * H, r: 0.15 * H };

const drawGrid = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = HUD.grid;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 1; i < 12; i++) {
    const x = Math.round((W * i) / 12) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let j = 1; j < 7; j++) {
    const y = Math.round((H * j) / 7) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
};

const drawRuler = (ctx: CanvasRenderingContext2D, frame: number) => {
  ctx.strokeStyle = HUD.ruler;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 34);
  ctx.lineTo(W - 60, 34);
  for (let x = 80; x < W - 60; x += 40) {
    const major = (x - 80) % 640 === 0;
    ctx.moveTo(x, 34);
    ctx.lineTo(x, major ? 50 : 40);
  }
  ctx.stroke();
  ctx.fillStyle = HUD.tag;
  ctx.font = `24px "${FONT}"`;
  ctx.textAlign = "center";
  for (let i = 1; i < 6; i++) {
    if (i === 3) continue; // under the label box
    const x = (W * i) / 6;
    const v = 14 * i + Math.floor(hash01(i, Math.floor(frame / 30) % 20) * 3);
    ctx.fillText(String(v).padStart(2, "0"), x, 74);
  }
  ctx.textAlign = "left";
};

const drawLabelBox = (ctx: CanvasRenderingContext2D) => {
  const w = 400;
  const h = 34;
  const x = W / 2 - w / 2;
  const y = 26;
  ctx.fillStyle = HUD.boxFill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = HUD.boxEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = HUD.boxText;
  ctx.font = `28px "${FONT}"`;
  ctx.textAlign = "center";
  ctx.fillText("UNIT 14 / 58", W / 2, y + 25);
  ctx.textAlign = "left";
};

const drawReadout = (ctx: CanvasRenderingContext2D, frame: number) => {
  const step = Math.floor(frame / 6) % 100;
  const p = 14 + Math.floor(hash01(step, 31) * 4);
  const v = 1.058 + Math.floor(hash01(step, 32) * 40) / 1000;
  ctx.fillStyle = HUD.violet;
  ctx.font = `46px "${FONT}"`;
  ctx.fillText(`P${p}`, 3555, 66);
  ctx.fillStyle = HUD.violetDim;
  ctx.font = `26px "${FONT}"`;
  ctx.fillText(`+${v.toFixed(3)}k`, 3558, 100);
};

const drawSine = (ctx: CanvasRenderingContext2D, phase: number) => {
  ctx.strokeStyle = HUD.sine;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.55;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let x = -10; x <= W + 10; x += 8) {
    const y = sineY(x / W, phase);
    if (x === -10) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const drawBars = (ctx: CanvasRenderingContext2D, frame: number, phase: number) => {
  const x0 = 90;
  const y0 = 0.31 * H;
  const gap = 0.38 * H / BARS.length;
  ctx.fillStyle = HUD.violet;
  BARS.forEach((b, i) => {
    const s = 0.5 + 0.5 * Math.sin(TAU * b.k * phase + b.ph);
    const s2 = 0.5 + 0.5 * Math.sin(TAU * b.k2 * phase + b.ph2);
    const len = b.base + b.amp * (0.65 * s + 0.35 * s2);
    // occasional step: quantised to 6px like a level meter
    const q = Math.round(len / 6) * 6;
    ctx.fillRect(x0 + b.dx, y0 + i * gap, q, gap * b.thick);
  });
  // tiny marker at the top of the stack
  ctx.fillRect(x0, y0 - gap * 1.2, 10, gap * 0.55);
  void frame;
};

const drawSquares = (ctx: CanvasRenderingContext2D, phase: number) => {
  ctx.font = `22px "${FONT}"`;
  for (const s of SQUARES) {
    const a = TAU * s.k * phase + s.ph;
    const x = s.x + s.rx * Math.cos(a);
    const y = s.y + s.ry * Math.sin(a);
    ctx.fillStyle = HUD.violet;
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = HUD.tag;
    ctx.fillText(s.tag, x + 4, y + 34);
  }
};

const drawDial = (ctx: CanvasRenderingContext2D, frame: number, phase: number) => {
  const { x, y, r } = DIAL;
  ctx.save();
  ctx.translate(x, y);
  // outer ring + 8 outward ticks, slowly rotating
  ctx.strokeStyle = HUD.violet;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  const rot = TAU * phase;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * TAU) / 8 + 0.2;
    ctx.strokeStyle = i === 2 ? HUD.white : HUD.violet;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6));
    ctx.lineTo(Math.cos(a) * (r + 40), Math.sin(a) * (r + 40));
    ctx.stroke();
  }
  // inner rings, counter-rotating
  const rot2 = -TAU * 2 * phase;
  ctx.strokeStyle = HUD.magenta;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, rot2, rot2 + TAU * 0.82);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, -rot2, -rot2 + TAU * 0.6);
  ctx.stroke();
  ctx.strokeStyle = HUD.violet;
  ctx.lineWidth = 4;
  ctx.setLineDash([60, 18, 14, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, rot2 * 0.5 + 1, rot2 * 0.5 + 1 + TAU * 0.42);
  ctx.stroke();
  ctx.strokeStyle = HUD.grey;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 22]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.68, -rot2, -rot2 + TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // extra thin concentric rings close to the outer ring
  ctx.strokeStyle = HUD.violetDim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.93, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = HUD.magenta;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.89, rot2 * 0.3, rot2 * 0.3 + TAU * 0.7);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // needle: 3 sweeps per loop
  const na = TAU * 3 * phase + 1.1;
  ctx.strokeStyle = HUD.white;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(na) * r * 0.74, Math.sin(na) * r * 0.74);
  ctx.stroke();
  // centre bar meter, flickering
  const pair = Math.floor(frame / 2) % 300;
  const cols = [HUD.white, HUD.teal, HUD.white, HUD.violet, HUD.pink];
  const xs = [-84, -44, 0, 40, 80];
  cols.forEach((c, i) => {
    if (i === 2) {
      // four-point sparkle
      ctx.fillStyle = HUD.white;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const a = (j * TAU) / 8;
        const rr = j % 2 === 0 ? 22 : 5;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (i === 1) {
      const h = 34 + 46 * hash01(pair, i, 9);
      ctx.fillStyle = c;
      ctx.fillRect(xs[i] - 12, -h / 2, 6, h);
      ctx.fillRect(xs[i] + 2, -h / 2 + 6, 6, h - 6);
      return;
    }
    const h = 34 + 46 * hash01(pair, i, 9);
    ctx.fillStyle = c;
    ctx.fillRect(xs[i] - (i === 1 || i === 3 ? 7 : 4), -h / 2, i === 1 || i === 3 ? 14 : 8, h);
  });
  // a couple of tiny tick labels around the dial
  ctx.fillStyle = HUD.violetDim;
  ctx.font = `22px "${FONT}"`;
  ctx.fillText("31", r + 30, -r * 0.55);
  ctx.fillText("07", r * 0.95, r * 0.3);
  ctx.restore();
};

let layer: HTMLCanvasElement | null = null;

/** Draw the HUD sharp, then add a soft blurred copy on top for the bloom. */
const drawHUD: Draw2D = (ctx, frame, size) => {
  const { bw, bh, k } = size;
  if (!layer || layer.width !== bw || layer.height !== bh) {
    layer = document.createElement("canvas");
    layer.width = bw;
    layer.height = bh;
  }
  const lc = layer.getContext("2d")!;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, bw, bh);
  lc.setTransform(k, 0, 0, k, 0, 0);
  drawLayer(lc, frame);
  drawGrid(ctx);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${(3 * k).toFixed(2)}px)`; // overall softness
  ctx.globalAlpha = 0.8;
  ctx.drawImage(layer, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.95;
  ctx.filter = `blur(${(12 * k).toFixed(2)}px)`; // bloom
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
};

const drawLayer = (ctx: CanvasRenderingContext2D, frame: number) => {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const phase = f / LOOP;
  drawRuler(ctx, f);
  drawSine(ctx, phase);
  drawBars(ctx, f, phase);
  drawSquares(ctx, phase);
  drawDial(ctx, f, phase);
  drawLabelBox(ctx);
  drawReadout(ctx, f);
};

export const HUDScope_Violet: React.FC = () => {
  const ready = useFont(FONT, "fonts/ShareTechMono-Regular.woff2");
  const draw = useCallback<Draw2D>((c, f, s) => drawHUD(c, f, s), []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Canvas2D draw={draw} ready={ready} />
    </AbsoluteFill>
  );
};
