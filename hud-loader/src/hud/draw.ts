import { random } from "remotion";
import {
  fadeIn,
  fillAt,
  flickerOn,
  labelBlink,
  lineReveal,
  markerX,
  percentAt,
} from "./timeline";

/**
 * The HUD is authored in "reference pixels": the coordinate space of the 768x432
 * reference clip. A layer canvas covers the region REGION.x..x+w, y..y+h of that space
 * and is drawn at `density` device pixels per reference pixel (5 => 3840 px wide frame).
 */
export const REGION = { x: 240, y: 172, w: 290, h: 80 };
export const FONT_FAMILY = "HudOrbitron";

export type HudLayer = "back" | "mid" | "front";
export type HudPalette = {
  core: string; // brightest strokes / fills
  main: string; // standard neon strokes
  dim: string; // secondary line work
  faint: string; // tick rulers, outlines
  bandFrom: string; // slanted band gradient start
  bandTo: string;
};

export const CYAN: HudPalette = {
  core: "#a6f7ff",
  main: "#46d9ea",
  dim: "rgba(58, 186, 202, 0.62)",
  faint: "rgba(52, 160, 176, 0.62)",
  bandFrom: "rgba(16, 70, 82, 0)",
  bandTo: "rgba(52, 190, 206, 0.7)",
};

// Bar geometry (reference px)
const BAR_X0 = 275.2;
const BAR_X1 = 497.6;
const BAR_TOP = 205.0;
const BAR_BOT = 213.4;
const FILL_TOP = 207.7;
const FILL_BOT = 211.7;
const BAR_CX = (BAR_X0 + BAR_X1) / 2;

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
  ctx.lineTo(x + rr, y + h);
  ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + rr);
  ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
  ctx.closePath();
};

const polyline = (ctx: CanvasRenderingContext2D, pts: number[][]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
};

const poly = (ctx: CanvasRenderingContext2D, pts: number[][]) => {
  polyline(ctx, pts);
  ctx.closePath();
};

/** Clip everything to the left of the reveal edge (line work "draws on"). */
const withReveal = (
  ctx: CanvasRenderingContext2D,
  x: number,
  fn: () => void,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(REGION.x - 20, REGION.y - 20, x - REGION.x + 20, REGION.h + 40);
  ctx.clip();
  fn();
  ctx.restore();
};

const ticks = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  y: number,
  seed: string,
  color: string,
) => {
  ctx.fillStyle = color;
  let i = 0;
  for (let x = x0; x <= x1; x += 1.3) {
    const major = i % 4 === 0;
    const h = major ? 1.5 : 0.7 + 0.6 * random(`${seed}-${i}`);
    ctx.fillRect(x, y - h / 2, 0.42, h);
    i++;
  }
  ctx.fillRect(x0, y - 0.12, x1 - x0, 0.24);
};

const triangle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  tipY: number,
  w: number,
) => {
  poly(ctx, [
    [x - w / 2, baseY],
    [x + w / 2, baseY],
    [x, tipY],
  ]);
  ctx.fill();
};

let capCache: Record<string, number> = {};
/** Font size in reference px giving the requested cap height. */
const fontForCap = (ctx: CanvasRenderingContext2D, cap: number) => {
  const key = String(cap);
  if (!capCache[key]) {
    ctx.save();
    ctx.font = `700 100px ${FONT_FAMILY}`;
    const m = ctx.measureText("H");
    ctx.restore();
    const capPer100 = m.actualBoundingBoxAscent || 72;
    capCache[key] = (cap * 100) / capPer100;
  }
  return capCache[key];
};
export const resetFontCache = () => {
  capCache = {};
};

/** Draw text with its left edge at x, baseline at y, horizontally stretched so `ref` spans refWidth. */
const stretchedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  ref: string,
  x: number,
  y: number,
  cap: number,
  refWidth: number,
  bold: number,
) => {
  const size = fontForCap(ctx, cap);
  ctx.font = `700 ${size}px ${FONT_FAMILY}`;
  const w = ctx.measureText(ref).width;
  const sx = refWidth / w;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  if (bold > 0) {
    ctx.lineWidth = bold;
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
};

/**
 * Draws the sharp (pre-glow) HUD for time t into ctx, which must already be
 * transformed into reference-px space. `layers` selects which depth layers to draw.
 */
export const drawHud = (
  ctx: CanvasRenderingContext2D,
  t: number,
  layers: HudLayer[],
  pal: HudPalette,
) => {
  const has = (l: HudLayer) => layers.includes(l);
  const reveal = BAR_X0 - 2 + (BAR_X1 - BAR_X0 + 4) * lineReveal(t - 0.04);
  const early = fadeIn(t, 0.08, 0.08); // first line work (ref frame 3)
  const rulers = fadeIn(t, 0.2, 0.14); // tick rulers (ref frame 6)
  const brackets = flickerOn(t, 0.44, "brackets"); // end brackets (ref frame 12)
  const swoosh = flickerOn(t, 0.42, "swoosh");
  const label = flickerOn(t, 0.34, "label") * labelBlink(t); // ref frame 9-12

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (has("back")) {
    ctx.globalAlpha = early;
    withReveal(ctx, reveal, () => {
      // top capsule outline
      roundRect(ctx, 275.4, 189.4, 75.6, 2.8, 1.4);
      ctx.fillStyle = "rgba(30, 110, 122, 0.25)";
      ctx.fill();
      ctx.strokeStyle = pal.faint;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // short bright segment under the capsule
      ctx.fillStyle = pal.main;
      poly(ctx, [
        [275.4, 193.5],
        [288.6, 193.5],
        [290.2, 194.9],
        [275.4, 194.9],
      ]);
      ctx.fill();
      // circuit line: runs right, kinks down into the bar's top edge
      ctx.strokeStyle = pal.dim;
      ctx.lineWidth = 0.42;
      polyline(ctx, [
        [290.2, 194.2],
        [357.2, 194.2],
        [369.4, 204.2],
        [BAR_X1 - 1, 204.2],
      ]);
      ctx.stroke();
      // bright segment under the bar (left)
      ctx.fillStyle = pal.main;
      poly(ctx, [
        [275.4, 214.6],
        [316.6, 214.6],
        [318.2, 215.8],
        [275.4, 215.8],
      ]);
      ctx.fill();
      // lower circuit line: from the bar, down the slant, along under the counter
      ctx.strokeStyle = pal.dim;
      polyline(ctx, [
        [396.2, BAR_BOT + 0.2],
        [419.6, 233.4],
        [BAR_X1 - 1, 233.4],
      ]);
      ctx.stroke();
    });

    ctx.globalAlpha = rulers;
    withReveal(ctx, reveal + 6, () => {
      ticks(ctx, 415.5, 497.5, 201.2, "rulerA", pal.faint);
      ticks(ctx, 275.4, 368.0, 220.0, "rulerB", pal.faint);
    });

    // end brackets  >=====<
    ctx.globalAlpha = brackets * 0.9;
    ctx.strokeStyle = pal.dim;
    ctx.lineWidth = 0.5;
    const bracket = (dir: 1 | -1) => {
      const x = (v: number) => BAR_CX + dir * (v - BAR_CX);
      polyline(ctx, [
        [x(260.4), 203.4],
        [x(265.4), 208.2],
        [x(271.0), 208.2],
      ]);
      ctx.stroke();
      polyline(ctx, [
        [x(260.4), 216.6],
        [x(265.4), 211.4],
        [x(271.0), 211.4],
      ]);
      ctx.stroke();
    };
    bracket(1);
    bracket(-1);
  }

  if (has("mid")) {
    ctx.globalAlpha = early;
    withReveal(ctx, reveal, () => {
      // bar track outline
      roundRect(ctx, BAR_X0, BAR_TOP, BAR_X1 - BAR_X0, BAR_BOT - BAR_TOP, 2.6);
      ctx.fillStyle = "rgba(18, 70, 80, 0.28)";
      ctx.fill();
      ctx.strokeStyle = pal.dim;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // inner thin track line
      ctx.strokeStyle = pal.faint;
      ctx.lineWidth = 0.35;
      roundRect(
        ctx,
        BAR_X0 + 1.1,
        FILL_TOP - 0.4,
        BAR_X1 - BAR_X0 - 2.2,
        FILL_BOT - FILL_TOP + 0.8,
        2,
      );
      ctx.stroke();
      // left end cap
      ctx.fillStyle = pal.main;
      roundRect(ctx, BAR_X0 + 1.1, FILL_TOP, 1.4, FILL_BOT - FILL_TOP, 0.7);
      ctx.fill();
    });

    // progress fill
    const f = fillAt(t);
    if (f > 0) {
      const w = (BAR_X1 - BAR_X0 - 2.4) * f;
      ctx.globalAlpha = 1;
      roundRect(ctx, BAR_X0 + 1.2, FILL_TOP, w, FILL_BOT - FILL_TOP, 1.9);
      ctx.fillStyle = pal.main;
      ctx.fill();
      roundRect(
        ctx,
        BAR_X0 + 1.6,
        FILL_TOP + 1.5,
        Math.max(0, w - 0.8),
        1.0,
        0.5,
      );
      ctx.fillStyle = pal.core;
      ctx.fill();
    }

    // swoosh blade after the label
    ctx.globalAlpha = swoosh;
    const g = ctx.createLinearGradient(358, 0, 412, 0);
    g.addColorStop(0, pal.main);
    g.addColorStop(0.4, pal.dim);
    g.addColorStop(1, "rgba(60, 200, 220, 0)");
    ctx.fillStyle = g;
    poly(ctx, [
      [358.6, 193.6],
      [399.0, 193.6],
      [411.0, 203.4],
      [370.6, 203.4],
    ]);
    ctx.fill();

    // slanted gradient band below the bar
    const g2 = ctx.createLinearGradient(392, 228, 414, 220);
    g2.addColorStop(0, pal.bandFrom);
    g2.addColorStop(1, pal.bandTo);
    ctx.fillStyle = g2;
    poly(ctx, [
      [384.5, BAR_BOT + 0.4],
      [395.6, BAR_BOT + 0.4],
      [418.4, 232.8],
      [403.0, 232.8],
    ]);
    ctx.fill();
  }

  if (has("front")) {
    // marker triangles
    ctx.globalAlpha = early;
    ctx.fillStyle = pal.main;
    triangle(ctx, markerX(t, "down", 438, 472, 0.36), 193.4, 197.0, 6.4);
    triangle(ctx, markerX(t + 0.17, "up", 286, 314, 0.44), 228.0, 224.4, 6.4);

    // LOADING...
    ctx.globalAlpha = label;
    ctx.fillStyle = pal.main;
    stretchedText(ctx, "LOADING...", "LOADING...", 275.6, 205.4, 7.0, 85.0, 0);

    // percentage counter
    const pct = percentAt(t);
    if (pct !== null) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.main;
      stretchedText(ctx, `${pct}%`, "68%", 430.4, 232.4, 14.6, 63.6, 0);
    }
  }
  ctx.globalAlpha = 1;
};
