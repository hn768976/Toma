import { INTER } from "../../lib/fonts";
import { TAU, mod } from "../../lib/loop";
import type { FinanceDepthPalette } from "../../versions";
import { LOOP, NumberSpec, PlaneSpec } from "./planes";

// Canvas drawing for one plane at one frame. Everything is a function of
// (spec, frame): no state is carried between frames.

const ROLL = 10; // frames for a digit roll

const wave = (f: number, cyc: number, ph: number) => Math.sin(TAU * ((f * cyc) / LOOP + ph));

/** Draw a number with per-digit rolling between the previous and current value. */
const drawNumber = (ctx: CanvasRenderingContext2D, n: NumberSpec, frame: number, color: string) => {
  const t = frame + n.offset;
  const slots = n.values.length;
  const k = mod(Math.floor(t / n.period), slots);
  const prev = n.values[mod(k - 1, slots)];
  const cur = n.values[k];
  const u = mod(t, n.period);
  const roll = u < ROLL ? u / ROLL : 1;
  const e = 1 - Math.pow(1 - roll, 3);
  ctx.font = `${n.weight} ${n.size}px ${INTER}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.globalAlpha = n.alpha;
  const cell = ctx.measureText("0").width;
  const dotW = ctx.measureText(".").width;
  const h = n.size * 0.78;
  let x = n.x;
  const len = Math.max(cur.length, prev.length);
  const curP = cur.padStart(len, " ");
  const prevP = prev.padStart(len, " ");
  for (let i = 0; i < len; i++) {
    const c = curP[i];
    const p = prevP[i];
    const w = c === "." ? dotW : cell;
    if (c === p || e >= 1) {
      if (c !== " ") ctx.fillText(c, x + (w - ctx.measureText(c).width) / 2, n.y);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, n.y - h - n.size * 0.08, w + 4, h + n.size * 0.16);
      ctx.clip();
      const dy = e * n.size * 0.95;
      if (p !== " ") ctx.fillText(p, x + (w - ctx.measureText(p).width) / 2, n.y - dy);
      if (c !== " ") ctx.fillText(c, x + (w - ctx.measureText(c).width) / 2, n.y - dy + n.size * 0.95);
      ctx.restore();
    }
    x += w;
  }
  ctx.globalAlpha = 1;
};

const drawCandles = (ctx: CanvasRenderingContext2D, p: PlaneSpec, frame: number, pal: FinanceDepthPalette) => {
  const c = p.candles!;
  const left = 40;
  const right = p.designW - 40;
  const top = 60;
  const bottom = p.designH - 40;
  const step = (right - left) / c.count;
  const bw = Math.max(5, step * 0.32);
  const Y = (v: number) => bottom - v * (bottom - top);
  for (let i = 0; i < c.count; i++) {
    const mid = c.base[i] + c.amp[i] * wave(frame, c.cyc[i], c.ph[i]);
    const half = (c.body[i] * (0.65 + 0.35 * wave(frame, c.bodyCyc[i], c.ph[i] + 0.37))) / 2;
    const o = mid - half;
    const cl = mid + half;
    const x = left + (i + 0.5) * step;
    ctx.strokeStyle = pal.main;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, Y(cl + c.wickUp[i]));
    ctx.lineTo(x, Y(o - c.wickDn[i]));
    ctx.stroke();
    ctx.fillStyle = c.dark[i] ? pal.dark : pal.main;
    ctx.globalAlpha = c.dark[i] ? 1 : 0.9;
    ctx.fillRect(x - bw / 2, Y(cl), bw, Math.max(3, Y(o) - Y(cl)));
  }
  ctx.globalAlpha = 1;
};

const drawLines = (ctx: CanvasRenderingContext2D, p: PlaneSpec, frame: number, pal: FinanceDepthPalette) => {
  const left = 30;
  const right = p.designW - 30;
  const top = 40;
  const bottom = p.designH - 30;
  for (const l of p.lines) {
    ctx.strokeStyle = l.tone === "main" ? pal.main : l.tone === "up" ? pal.up : pal.down;
    ctx.globalAlpha = l.alpha;
    ctx.lineWidth = l.width;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    l.points.forEach((v, j) => {
      const y = v + l.amp * wave(frame, l.cyc[j], l.ph[j]);
      const x = left + (j / (l.points.length - 1)) * (right - left);
      const yy = bottom - y * (bottom - top);
      if (j === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

let dotPattern: { canvas: HTMLCanvasElement; spacing: number } | null = null;
const getDotPattern = (spacing: number) => {
  if (!dotPattern || dotPattern.spacing !== spacing) {
    const s = Math.max(2, Math.round(spacing));
    const c = document.createElement("canvas");
    c.width = s;
    c.height = s;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.37, 0, TAU);
    g.fill();
    dotPattern = { canvas: c, spacing };
  }
  return dotPattern.canvas;
};

/**
 * Draw the plane's content (unblurred) into `ctx`, at `scale` design->texture.
 * The canvas is first filled with exact black.
 */
export const drawPlaneContent = (
  ctx: CanvasRenderingContext2D,
  p: PlaneSpec,
  frame: number,
  pal: FinanceDepthPalette,
  scale: number,
  pad: number,
) => {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(scale, 0, 0, scale, pad, pad);

  if (p.kind === "big") {
    // dot-matrix numbers: the text is masked by a grid of round dots
    const spacingTex = 15 * scale;
    drawNumber(ctx, p.numbers[0], frame, pal.main);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (spacingTex >= 3) {
      const pat = ctx.createPattern(getDotPattern(spacingTex), "repeat")!;
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    } else {
      // dots below 3 px: same average coverage as a flat fill
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgb(110,110,110)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    return;
  }
  if (p.kind === "chart") {
    drawCandles(ctx, p, frame, pal);
    drawLines(ctx, p, frame, pal);
  }
  for (const n of p.numbers) drawNumber(ctx, n, frame, pal.main);
};
