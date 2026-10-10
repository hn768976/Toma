import React, { useCallback } from "react";
import { Canvas2D, DrawFn } from "./Canvas2D";
import { GlowVersion } from "./colourways";
import { LOOP } from "./constants";
import { finishPass } from "./finish";
import { TAU, clamp } from "./rng";

/**
 * Look 1: Glow Gradient. Soft colour blobs drifting on closed paths over a very
 * dark base, plus a thin hot light line along the bottom (and a fainter one at
 * the top). Everything is a whole number of cycles per 600 frames.
 */

type Slot = {
  x: number; y: number; // centre, fraction of frame (width / height)
  ax: number; ay: number; // path amplitudes, fraction of frame
  fx: number; fy: number; // path cycles per loop (integers)
  px: number; py: number; // path phases (cycles)
  r: number; // radius as a fraction of frame width
  ratio: number; // ellipse stretch (x radius / y radius)
  rot: number; rotAmp: number; rotCycles: number; // rotation (radians)
  breathe: number; // size cycles per loop
  pulse: number; // brightness cycles per loop
  ph: number;
  gain: number; // peak brightness (0..1.5)
};

// Hand-placed layout: cyan lower-left, violet/magenta across the middle, deep
// blue along the top. Some slots swing past the frame edges and come back.
export const BLOB_SLOTS: Slot[] = [
  // cyan, rising from the bottom edge, left of centre
  { x: 0.3, y: 1.0, ax: 0.08, ay: 0.03, fx: 1, fy: 2, px: 0.0, py: 0.1, r: 0.32, ratio: 1.8, rot: 0.0, rotAmp: 0.06, rotCycles: 1, breathe: 2, pulse: 3, ph: 0.0, gain: 0.62 },
  // azure / royal blue: the left end of the bottom sweep
  { x: 0.16, y: 1.02, ax: 0.1, ay: 0.03, fx: 1, fy: 1, px: 0.3, py: 0.7, r: 0.34, ratio: 1.9, rot: 0.0, rotAmp: 0.06, rotCycles: 1, breathe: 3, pulse: 2, ph: 0.2, gain: 0.85 },
  // violet: blends cyan into pink
  { x: 0.46, y: 1.0, ax: 0.1, ay: 0.03, fx: 2, fy: 1, px: 0.6, py: 0.2, r: 0.26, ratio: 1.7, rot: 0.0, rotAmp: 0.05, rotCycles: 1, breathe: 2, pulse: 3, ph: 0.45, gain: 0.7 },
  // magenta: hot pink, right of centre
  { x: 0.6, y: 1.0, ax: 0.1, ay: 0.04, fx: 1, fy: 2, px: 0.1, py: 0.5, r: 0.2, ratio: 1.7, rot: 0.0, rotAmp: 0.05, rotCycles: 1, breathe: 3, pulse: 2, ph: 0.7, gain: 0.78 },
  // deep blue wash, upper right (swings off the top edge and back)
  { x: 0.8, y: 0.22, ax: 0.18, ay: 0.12, fx: 1, fy: 1, px: 0.8, py: 0.35, r: 0.5, ratio: 1.6, rot: 0.1, rotAmp: 0.12, rotCycles: 1, breathe: 2, pulse: 3, ph: 0.15, gain: 0.42 },
  // deep blue wash, left edge, drifts off the frame and returns
  { x: 0.0, y: 0.58, ax: 0.1, ay: 0.14, fx: 1, fy: 1, px: 0.4, py: 0.9, r: 0.32, ratio: 1.5, rot: 0.0, rotAmp: 0.4, rotCycles: 1, breathe: 3, pulse: 2, ph: 0.85, gain: 0.8 },
  // faint extra tint (kept very low)
  { x: 0.92, y: 0.65, ax: 0.1, ay: 0.12, fx: 2, fy: 1, px: 0.25, py: 0.6, r: 0.22, ratio: 1.5, rot: 0.5, rotAmp: 0.3, rotCycles: 1, breathe: 2, pulse: 3, ph: 0.55, gain: 0.05 },
  { x: 0.12, y: 0.12, ax: 0.14, ay: 0.12, fx: 1, fy: 2, px: 0.9, py: 0.15, r: 0.22, ratio: 1.8, rot: 0.2, rotAmp: 0.3, rotCycles: 1, breathe: 3, pulse: 2, ph: 0.35, gain: 0.07 },
  // dim magenta, bottom right: fades the sweep out into dark maroon
  { x: 0.86, y: 1.0, ax: 0.06, ay: 0.04, fx: 1, fy: 3, px: 0.5, py: 0.0, r: 0.3, ratio: 2.2, rot: 0.0, rotAmp: 0.1, rotCycles: 1, breathe: 2, pulse: 3, ph: 0.95, gain: 0.42 },
];

// ---- sprites -------------------------------------------------------------

const SPRITE = 512;
const spriteCache = new Map<string, HTMLCanvasElement>();

const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * A 512 px soft radial sprite, opaque, with RGB = colour * profile. Drawn
 * scaled with additive blending. The profile is a smooth bell that reaches
 * exactly zero at the sprite edge (no visible disc outline).
 */
const getSprite = (hex: string): HTMLCanvasElement => {
  const hit = spriteCache.get(hex);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(SPRITE, SPRITE);
  const [cr, cg, cb] = hexRgb(hex);
  const g1 = Math.exp(-4.2);
  for (let y = 0; y < SPRITE; y++) {
    for (let x = 0; x < SPRITE; x++) {
      const dx = (x + 0.5) / (SPRITE / 2) - 1;
      const dy = (y + 0.5) / (SPRITE / 2) - 1;
      const r2 = dx * dx + dy * dy;
      const bell = r2 >= 1 ? 0 : (Math.exp(-4.2 * r2) - g1) / (1 - g1);
      // Mix in a slow shoulder so the falloff has a long soft tail.
      const tail = r2 >= 1 ? 0 : Math.pow(1 - r2, 3);
      const v = 0.88 * bell + 0.12 * tail;
      const i = (y * SPRITE + x) * 4;
      img.data[i] = cr * v;
      img.data[i + 1] = cg * v;
      img.data[i + 2] = cb * v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  spriteCache.set(hex, c);
  return c;
};

// ---- light line ------------------------------------------------------------

const lineStrip = document.createElement("canvas");
const lineGlow = document.createElement("canvas");

const drawLine = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  k: number,
  f: number,
  v: GlowVersion,
  top: boolean,
) => {
  const t = f / LOOP;
  const [cFar, cHot, cNearBase] = v.line;
  const cNear = top ? mix(cFar, cHot, 0.45) : cNearBase; // the top band has no pink
  const strength = top ? 0.75 : 1;
  const slide = top ? -0.26 : 0.3; // slide amplitude (fraction of width)
  const hot = 0.5 + slide * Math.sin(TAU * (t + (top ? 0.2 : 0)));
  const pulse = 0.88 + 0.12 * Math.sin(TAU * (2 * t + (top ? 0.4 : 0.1)));

  // Horizontal colour strip: blue -> white -> pink, hot centre slides.
  const sw = Math.max(2, Math.round(w));
  const gh = Math.max(4, Math.round(420 * k));
  if (lineStrip.width !== sw || lineStrip.height !== 1) {
    lineStrip.width = sw;
    lineStrip.height = 1;
  }
  const sctx = lineStrip.getContext("2d")!;
  const grad = sctx.createLinearGradient(0, 0, sw, 0);
  const stop = (p: number, col: string, a: number) =>
    grad.addColorStop(clamp(p, 0, 1), rgba(col, a));
  stop(0, cFar, 0.35);
  stop(hot - 0.42, cFar, 0.7);
  stop(hot - 0.17, mix(cFar, cHot, 0.55), 0.95);
  stop(hot, cHot, 1);
  stop(hot + 0.14, mix(cNear, cHot, 0.35), 0.95);
  stop(hot + 0.4, cNear, 0.7);
  stop(1, cNear, 0.3);
  sctx.clearRect(0, 0, sw, 1);
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, sw, 1);

  // Soft glow above the line: the strip, faded vertically.
  if (lineGlow.width !== sw || lineGlow.height !== gh) {
    lineGlow.width = sw;
    lineGlow.height = gh;
  }
  const gctx = lineGlow.getContext("2d")!;
  gctx.globalCompositeOperation = "source-over";
  gctx.clearRect(0, 0, sw, gh);
  gctx.imageSmoothingEnabled = true;
  gctx.drawImage(lineStrip, 0, 0, sw, gh);
  gctx.globalCompositeOperation = "destination-in";
  const vg = gctx.createLinearGradient(0, 0, 0, gh);
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = i / N; // 0 = far from the line, 1 = at the line
    const a = Math.pow(Math.exp(-4.5 * (1 - u)) * u, 1) * (1 - Math.pow(1 - u, 8)) ;
    vg.addColorStop(u, `rgba(0,0,0,${(a * 1.0 * strength * pulse).toFixed(4)})`);
  }
  gctx.fillStyle = vg;
  gctx.fillRect(0, 0, sw, gh);

  const yLine = top ? h * 0.006 : h * 0.994;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (top) {
    ctx.translate(0, yLine * 2);
    ctx.scale(1, -1);
  }
  ctx.drawImage(lineGlow, 0, yLine - gh, w, gh);
  // Thin hot core: ~3 px at 4K (2 px for the faint top line).
  const coreH = Math.max(1, (top ? 2 : 3.5) * k);
  ctx.globalAlpha = clamp(strength * pulse, 0, 1);
  ctx.drawImage(lineStrip, 0, yLine - coreH / 2, w, coreH);
  // And a tighter, brighter bloom right around it.
  ctx.globalAlpha = 0.6 * strength * pulse;
  ctx.drawImage(lineStrip, 0, yLine - coreH * 5, w, coreH * 10);
  ctx.globalAlpha = 0.3 * strength * pulse;
  ctx.drawImage(lineStrip, 0, yLine - coreH * 12, w, coreH * 24);
  ctx.restore();
};

const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  const h = (x: number) => Math.round(x).toString(16).padStart(2, "0");
  return `#${h(ar + (br - ar) * t)}${h(ag + (bg - ag) * t)}${h(ab + (bb - ab) * t)}`;
};

// ---- frame -------------------------------------------------------------------

const GRAIN = 0.02;

export const makeGlowDraw =
  (v: GlowVersion): DrawFn =>
  (ctx, frame, w, h, k) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const t = f / LOOP;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, v.base[0]);
    bg.addColorStop(1, v.base[1]);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    BLOB_SLOTS.forEach((s, i) => {
      const cx = (s.x + s.ax * Math.sin(TAU * (s.fx * t + s.px))) * w;
      const cy = (s.y + s.ay * Math.sin(TAU * (s.fy * t + s.py))) * h;
      const size = 1 + 0.25 * Math.sin(TAU * (s.breathe * t + s.ph));
      const lum = 1 + 0.25 * Math.sin(TAU * (s.pulse * t + s.ph + 0.33));
      const rad = s.r * w * size;
      const rot = s.rot + s.rotAmp * Math.sin(TAU * (s.rotCycles * t + s.ph));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(1, 1 / s.ratio);
      ctx.globalAlpha = clamp(s.gain * lum, 0, 1);
      const sprite = getSprite(v.blobs[i % v.blobs.length]);
      ctx.drawImage(sprite, -rad, -rad, rad * 2, rad * 2);
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    drawLine(ctx, w, h, k, f, v, false);
    drawLine(ctx, w, h, k, f, v, true);

    ctx.globalCompositeOperation = "source-over";
    finishPass(ctx, w, h, f, { grain: GRAIN });
  };

export const GlowGradient: React.FC<{ version: GlowVersion }> = ({ version }) => {
  const draw = useCallback(makeGlowDraw(version), [version]);
  return <Canvas2D draw={draw} />;
};
