/**
 * Look 2 — Rising Arrows. Canvas 2D, redrawn from scratch every frame.
 *
 * Loop: every element moves up by exactly `cycles` wrap-heights over the
 * 600-frame loop (cyc() is integer maths), band pulses and flicker use whole
 * cycles / frame-indexed hashes that repeat every 600 frames.
 */
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { hexToRgb, mixRgb, rgba, type RGB } from "../lib/color";
import { smoothstep } from "../lib/ease";
import { applyGrain2D } from "../lib/grain2d";
import { cyc, loopFrame, loopSin } from "../lib/loop";
import { hash01, makeRng } from "../lib/random";
import { canvasDpr, sizeCanvas, useScratchCanvases } from "../lib/useCanvas2D";
import type { RisingArrowsProps } from "../versions";

const LOOP = 600;
// Layout is authored in a 3840x2160 space and scaled to the composition.
const W = 3840;
const H = 2160;

type Kind = "arrow" | "chevrons" | "dots";
type Item = {
  kind: Kind;
  layer: 0 | 1 | 2;
  x: number;
  size: number;
  tail: number;
  cycles: number;
  range: number;
  phase: number;
  bright: number;
  count: number;
  dots: number;
  centreLine: boolean;
  seed: number;
};

type Band = {
  x: number;
  w: number;
  alpha: number;
  cycles: number;
  phase: number;
  edge: -1 | 0 | 1;
  top: number;
  dark: boolean;
};

// ------------------------------------------------------------------ layout
const LAYERS = [
  // back: small, dim, slow
  { n: 30, size: [110, 180], tail: [2.2, 4.0], margin: 900, cycles: 2, bright: [0.25, 0.42] },
  // mid
  { n: 14, size: [300, 460], tail: [1.8, 3.0], margin: 1900, cycles: 2, bright: [0.6, 0.85] },
  // front: big, bright, slightly blurred
  { n: 7, size: [560, 760], tail: [1.4, 2.4], margin: 2600, cycles: 2, bright: [0.85, 1.0] },
] as const;

const buildItems = (): Item[] => {
  const rng = makeRng(0xa77e0);
  const items: Item[] = [];
  LAYERS.forEach((L, layer) => {
    const range = H + 2 * L.margin;
    for (let i = 0; i < L.n; i++) {
      // stratified x so a layer covers the width evenly
      const spread = layer === 0 ? 1 : 0.72;
      const x = W / 2 + (((i + rng.range(0.15, 0.85)) / L.n) - 0.5) * (W + 200) * spread;
      const r = rng.next();
      const kind: Kind = r < 0.52 ? "arrow" : r < 0.86 ? "chevrons" : "dots";
      const size = rng.range(L.size[0], L.size[1]);
      items.push({
        kind,
        layer: layer as 0 | 1 | 2,
        x,
        size,
        tail: size * rng.range(L.tail[0], L.tail[1]),
        cycles: L.cycles,
        range,
        // golden-ratio spread of phases avoids rows of arrows lining up
        phase: (i * 0.618034 + rng.range(0, 0.3) + layer * 0.37) % 1,
        bright: rng.range(L.bright[0], L.bright[1]),
        count: rng.int(3, 4),
        dots: rng.chance(0.45) ? rng.int(5, 12) : 0,
        centreLine: false,
        seed: rng.int(1, 1e9),
      });
    }
  });
  return items;
};
const ITEMS = buildItems();

const buildBands = (): Band[] => {
  const rng = makeRng(0xba4d);
  const bands: Band[] = [];
  for (let i = 0; i < 14; i++) {
    const dark = i % 4 === 3;
    bands.push({
      dark,
      x: W * 0.12 + rng.range(0, W * 0.8),
      w: rng.pick([90, 240, 320, 420, 520, 640]) * rng.range(0.85, 1.15),
      alpha: dark ? rng.range(0.25, 0.45) : rng.range(0.18, 0.38),
      cycles: rng.int(1, 3),
      phase: rng.next(),
      edge: rng.pick([-1, 1, 1, 0]) as -1 | 0 | 1,
      top: rng.range(-0.2, 0.35),
    });
  }
  return bands;
};
const BANDS = buildBands();

// ----------------------------------------------------------------- drawing
const arrowPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s / 2, y + s * 0.78);
  ctx.lineTo(x - s / 2, y + s * 0.78);
  ctx.closePath();
};

const chevronPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  // ^-shaped chevron, apex at (x, y), arm thickness ~0.26 s
  const hw = s / 2;
  const drop = s * 0.36;
  const t = s * 0.24;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + hw, y + drop);
  ctx.lineTo(x + hw, y + drop + t);
  ctx.lineTo(x, y + t);
  ctx.lineTo(x - hw, y + drop + t);
  ctx.lineTo(x - hw, y + drop);
  ctx.closePath();
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  glow: CanvasRenderingContext2D | null,
  it: Item,
  y: number,
  a: number,
  col: RGB,
  hot: RGB,
) => {
  const s = it.size;
  const baseY = y + s * 0.78;
  const sw = s * 0.52;
  // shaft: translucent column fading downward
  const g = ctx.createLinearGradient(0, baseY, 0, baseY + it.tail);
  g.addColorStop(0, rgba(col, 0.38 * a));
  g.addColorStop(0.45, rgba(col, 0.12 * a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(it.x - sw / 2, baseY - 1, sw, it.tail);
  // shaft edges
  const ge = ctx.createLinearGradient(0, baseY, 0, baseY + it.tail * 0.8);
  ge.addColorStop(0, rgba(mixRgb(col, hot, 0.4), 0.8 * a));
  ge.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = ge;
  const lw = Math.max(2, s * 0.018);
  ctx.fillRect(it.x - sw / 2, baseY, lw, it.tail * 0.8);
  ctx.fillRect(it.x + sw / 2 - lw, baseY, lw, it.tail * 0.8);
  if (it.centreLine) {
    const gc = ctx.createLinearGradient(0, baseY, 0, baseY + it.tail * 0.6);
    gc.addColorStop(0, rgba(hot, 0.9 * a));
    gc.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gc;
    ctx.fillRect(it.x - lw * 0.6, baseY - s * 0.2, lw * 1.2, it.tail * 0.6);
  }
  // head: gradient fill bright at the tip, bright outline
  const gh = ctx.createLinearGradient(0, y, 0, baseY);
  gh.addColorStop(0, rgba(mixRgb(col, hot, 0.18), 0.85 * a));
  gh.addColorStop(1, rgba(col, 0.32 * a));
  ctx.fillStyle = gh;
  arrowPath(ctx, it.x, y, s);
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.016);
  ctx.strokeStyle = rgba(mixRgb(col, hot, 0.35), 0.95 * a);
  ctx.stroke();
  if (glow) {
    glow.fillStyle = rgba(col, 0.75 * a * it.bright);
    arrowPath(glow, it.x, y, s * 1.05);
    glow.fill();
    glow.fillStyle = rgba(col, 0.35 * a * it.bright);
    glow.fillRect(it.x - sw / 2, baseY, sw, it.tail * 0.35);
  }
};

const drawChevrons = (
  ctx: CanvasRenderingContext2D,
  glow: CanvasRenderingContext2D | null,
  it: Item,
  y: number,
  a: number,
  col: RGB,
  hot: RGB,
  flick: number,
) => {
  const s = it.size * 1.25;
  const gap = s * 0.42;
  for (let k = 0; k < it.count; k++) {
    const yy = y + k * gap;
    const ak = a * (1 - k * 0.22) * flick;
    chevronPath(ctx, it.x, yy, s);
    const g = ctx.createLinearGradient(0, yy, 0, yy + s * 0.6);
    g.addColorStop(0, rgba(mixRgb(col, hot, 0.15), 0.55 * ak));
    g.addColorStop(1, rgba(col, 0.22 * ak));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.012);
    ctx.strokeStyle = rgba(mixRgb(col, hot, 0.45), 0.75 * ak);
    ctx.stroke();
    if (glow && k === 0) {
      chevronPath(glow, it.x, yy, s);
      glow.fillStyle = rgba(col, 0.45 * ak * it.bright);
      glow.fill();
    }
  }
};

const drawDots = (
  ctx: CanvasRenderingContext2D,
  glow: CanvasRenderingContext2D | null,
  x: number,
  y: number,
  n: number,
  r0: number,
  a: number,
  col: RGB,
  hot: RGB,
) => {
  const step = r0 * 4.2;
  for (let k = 0; k < n; k++) {
    const r = r0 * (1 - (k / n) * 0.55);
    const ak = a * (1 - k / (n + 1));
    ctx.fillStyle = rgba(k === 0 ? hot : mixRgb(col, hot, 0.35), ak);
    ctx.beginPath();
    ctx.arc(x, y + k * step, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (glow) {
    glow.fillStyle = rgba(col, a * 0.5);
    glow.beginPath();
    glow.arc(x, y, r0 * 2.2, 0, Math.PI * 2);
    glow.fill();
  }
};

/** Vertical position of an element's top, plus its edge fade. */
const placement = (it: Item, frame: number) => {
  const t = (cyc(frame, it.cycles, LOOP) + it.phase) % 1;
  const margin = (it.range - H) / 2;
  const y = H + margin - t * it.range - it.size * 0.4;
  // fade in over the lowest 18% of the frame, out over the top 22%
  const a = smoothstep(H * 1.02, H * 0.82, y + it.size * 0.4) * smoothstep(-it.size * 0.8, H * 0.22, y);
  return { y, a };
};

export const RisingArrows: React.FC<RisingArrowsProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layerCanvas, glowCanvas] = useScratchCanvases(2);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = canvasDpr(width);
    const pw = width * dpr;
    const ph = height * dpr;
    const k = (pw / W); // authored px -> device px
    const ctx = sizeCanvas(canvas, pw, ph);
    const lf = loopFrame(frame, LOOP);

    const top = hexToRgb(props.bgTop);
    const bot = hexToRgb(props.bgBottom);
    const band = hexToRgb(props.band);
    const col = hexToRgb(props.arrow);
    const hot = hexToRgb(props.arrowHot);

    ctx.setTransform(k, 0, 0, k, 0, 0);

    // --- background: vertical gradient, brighter centre column, dark sides
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, rgba(top, 1));
    bg.addColorStop(1, rgba(bot, 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const centre = ctx.createRadialGradient(W * 0.5, H * 0.95, 0, W * 0.5, H * 0.95, W * 0.6);
    centre.addColorStop(0, rgba(band, 0.32));
    centre.addColorStop(0.55, rgba(band, 0.06));
    centre.addColorStop(1, rgba(band, 0));
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = centre;
    ctx.fillRect(0, 0, W, H);

    // --- two wide glass slabs carrying most of the light (centre-left, right)
    for (const [sx, sw, sa, cyc0] of [[1450, 720, 0.34, 0.1], [3000, 500, 0.26, 0.55]] as const) {
      const pulse = 0.82 + 0.18 * loopSin(frame, 1, LOOP, cyc0);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(band, sa * 0.35 * pulse));
      g.addColorStop(0.6, rgba(band, sa * 0.8 * pulse));
      g.addColorStop(1, rgba(band, sa * pulse));
      ctx.fillStyle = g;
      ctx.fillRect(sx - sw / 2, 0, sw, H);
      ctx.fillStyle = rgba(mixRgb(band, hot, 0.35), sa * 0.9 * pulse);
      ctx.fillRect(sx + sw / 2 - 5, 0, 10, H);
    }
    // --- light bands
    for (const b of BANDS) {
      if (b.dark) {
        ctx.globalCompositeOperation = "source-over";
        const gd = ctx.createLinearGradient(0, 0, 0, H);
        gd.addColorStop(0, `rgba(0,3,20,${(b.alpha * 0.6).toFixed(3)})`);
        gd.addColorStop(1, `rgba(0,3,20,${b.alpha.toFixed(3)})`);
        ctx.fillStyle = gd;
        ctx.fillRect(b.x - b.w / 2, 0, b.w, H);
        ctx.globalCompositeOperation = "lighter";
        continue;
      }
      const pulse = 0.65 + 0.35 * loopSin(frame, b.cycles, LOOP, b.phase);
      const a = b.alpha * pulse;
      const g = ctx.createLinearGradient(0, H * b.top, 0, H);
      g.addColorStop(0, rgba(band, 0));
      g.addColorStop(0.35, rgba(band, a * 0.7));
      g.addColorStop(1, rgba(band, a));
      ctx.fillStyle = g;
      ctx.fillRect(b.x - b.w / 2, 0, b.w, H);
      if (b.edge !== 0) {
        const ex = b.x + (b.edge * b.w) / 2;
        const ge = ctx.createLinearGradient(0, H * b.top, 0, H);
        ge.addColorStop(0, rgba(band, 0));
        ge.addColorStop(1, rgba(mixRgb(band, hot, 0.3), a * 1.6));
        ctx.fillStyle = ge;
        ctx.fillRect(ex - 4, 0, 8, H);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    // darker outer edges
    const side = ctx.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, "rgba(0,2,14,0.9)");
    side.addColorStop(0.16, "rgba(0,2,14,0.35)");
    side.addColorStop(0.3, "rgba(0,2,14,0)");
    side.addColorStop(0.9, "rgba(0,2,14,0)");
    side.addColorStop(1, "rgba(0,2,14,0.45)");
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, W, H);

    // --- glow buffer at quarter resolution
    const gk = k / 4;
    const glow = sizeCanvas(glowCanvas, pw / 4, ph / 4);
    glow.setTransform(gk, 0, 0, gk, 0, 0);
    glow.globalCompositeOperation = "lighter";

    const drawItem = (c: CanvasRenderingContext2D, it: Item) => {
      const { y, a: fade } = placement(it, frame);
      if (fade <= 0.001) return;
      const a = fade * it.bright;
      const gl = it.layer > 0 ? glow : null;
      if (it.kind === "arrow") {
        drawArrow(c, gl, it, y, a, col, hot);
        if (it.dots) drawDots(c, gl, it.x, y + it.size * 0.78 + it.tail * 0.75, it.dots, it.size * 0.035, a * 0.8, col, hot);
      } else if (it.kind === "chevrons") {
        // occasional bright flicker, re-drawn per 3-frame step (200 steps per loop)
        const h = hash01(it.seed, Math.floor(lf / 3));
        const flick = h > 0.86 ? 1.45 : 0.85 + 0.15 * h;
        drawChevrons(c, gl, it, y, a, col, hot, flick);
      } else {
        drawDots(c, gl, it.x, y, it.dots || 9, Math.min(15, Math.max(5, it.size * 0.05)), a * 0.85, col, hot);
      }
    };

    // back + mid straight onto the main canvas
    ctx.globalCompositeOperation = "lighter";
    for (const it of ITEMS) if (it.layer < 2) drawItem(ctx, it);

    // front layer on its own canvas, composited with a slight blur
    const front = sizeCanvas(layerCanvas, pw, ph);
    front.setTransform(k, 0, 0, k, 0, 0);
    front.globalCompositeOperation = "lighter";
    for (const it of ITEMS) if (it.layer === 2) drawItem(front, it);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = `blur(${(4 * k).toFixed(2)}px)`;
    ctx.drawImage(layerCanvas, 0, 0);
    // soft glow: quarter-res buffer, upscaled and blurred twice (wide + tight)
    ctx.filter = `blur(${(36 * k).toFixed(2)}px)`;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(glowCanvas, 0, 0, pw, ph);
    ctx.filter = `blur(${(12 * k).toFixed(2)}px)`;
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glowCanvas, 0, 0, pw, ph);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";

    applyGrain2D(ctx, lf, 0.02);
  }, [frame, width, height, props, layerCanvas, glowCanvas]);

  return (
    <AbsoluteFill style={{ background: props.bgBottom }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};

