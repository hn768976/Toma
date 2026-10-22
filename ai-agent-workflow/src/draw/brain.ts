import type { V2 } from "../layout";
import type { Palette } from "../theme";
import { clamp01, mixHex, rgba } from "../util";

// The "AI brain" emblem and the HUD rings around it, drawn with Canvas 2D.
// Brain coordinates are normalised to [-1, 1] (y down).

type Ctx = CanvasRenderingContext2D;

const catmull = (pts: V2[], steps = 10): V2[] => {
  const out: V2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const mirror = (pts: V2[]): V2[] => pts.map(([x, y]) => [-x, y]);

const OUTLINE_L: V2[] = catmull([
  [-0.05, -0.62],
  [-0.2, -0.8],
  [-0.44, -0.84],
  [-0.62, -0.74],
  [-0.82, -0.64],
  [-0.93, -0.42],
  [-0.99, -0.17],
  [-0.92, 0.06],
  [-0.99, 0.3],
  [-0.87, 0.53],
  [-0.67, 0.63],
  [-0.5, 0.8],
  [-0.26, 0.82],
  [-0.06, 0.7],
]);

const FOLDS_L: V2[][] = [
  catmull([[-0.62, -0.74], [-0.6, -0.56], [-0.74, -0.44]], 8),
  catmull([[-0.92, 0.06], [-0.76, 0.1], [-0.7, 0.24]], 8),
  catmull([[-0.67, 0.63], [-0.64, 0.46], [-0.74, 0.38]], 8),
  catmull([[-0.26, -0.82], [-0.3, -0.68]], 4),
];

// Circuit traces radiating from the chip; the last point gets a pad.
const TRACES_L: V2[][] = [
  [[-0.2, -0.1], [-0.42, -0.1], [-0.56, -0.26]],
  [[-0.2, 0.04], [-0.5, 0.04], [-0.62, -0.08], [-0.8, -0.08]],
  [[-0.2, 0.14], [-0.38, 0.32], [-0.62, 0.32]],
  [[-0.11, -0.2], [-0.11, -0.38], [-0.3, -0.56]],
  [[-0.11, 0.2], [-0.11, 0.42], [-0.32, 0.62]],
  [[-0.42, -0.1], [-0.42, -0.36]],
  [[-0.5, 0.04], [-0.62, 0.16], [-0.82, 0.16]],
];

const TRACES_C: V2[][] = [
  [[0, -0.2], [0, -0.56]],
  [[0, 0.2], [0, 0.6]],
];

type Stroke = { pts: V2[]; pad: boolean; delay: number };

const STROKES: Stroke[] = [
  ...[OUTLINE_L, mirror(OUTLINE_L)].map((pts) => ({ pts, pad: false, delay: 0.1 })),
  ...[...FOLDS_L, ...FOLDS_L.map(mirror)].map((pts) => ({ pts, pad: false, delay: 0.35 })),
  ...[...TRACES_L, ...TRACES_L.map(mirror), ...TRACES_C].map((pts, i) => ({
    pts,
    pad: true,
    delay: 0.05 + (i % 7) * 0.05,
  })),
];

const lengthOf = (pts: V2[]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};
const LENGTHS = STROKES.map((s) => lengthOf(s.pts));

/** Draws the brain emblem into a square of side `size`, centred. p = draw-on progress. */
export const drawBrain = (ctx: Ctx, size: number, pal: Palette, p: number, pulse: number) => {
  const u = size * 0.42;
  const c = size / 2;
  const lineCol = mixHex(pal.core, pal.primary, 0.25);
  ctx.save();
  ctx.translate(c, c);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = lineCol;
  ctx.fillStyle = lineCol;
  ctx.lineWidth = u * 0.05;
  ctx.shadowColor = pal.primary;
  ctx.shadowBlur = u * 0.12;

  STROKES.forEach((s, i) => {
    const local = clamp01((p - s.delay) / 0.55);
    if (local <= 0) return;
    const len = LENGTHS[i] * u;
    ctx.setLineDash([len * local, len + 1]);
    ctx.beginPath();
    s.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x * u, y * u) : ctx.moveTo(x * u, y * u)));
    ctx.stroke();
    if (s.pad && local > 0.98) {
      const [x, y] = s.pts[s.pts.length - 1];
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x * u, y * u, u * 0.045, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.setLineDash([]);

  // Processor chip in the middle.
  const chipP = clamp01(p / 0.25);
  if (chipP > 0) {
    const h = u * 0.25 * (0.6 + 0.4 * chipP);
    ctx.globalAlpha = chipP;
    ctx.shadowBlur = u * (0.3 + 0.15 * pulse);
    ctx.shadowColor = pal.primary;
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.roundRect(-h, -h, h * 2, h * 2, u * 0.03);
    ctx.fill();
    ctx.shadowBlur = u * 0.06;
    ctx.fillStyle = rgba(pal.primary, 0.9);
    ctx.beginPath();
    ctx.roundRect(-h * 0.55, -h * 0.55, h * 1.1, h * 1.1, u * 0.02);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};

/**
 * HUD rings behind the brain. `size` is the canvas side; ring radii are
 * expressed as fractions of it so the plane can be any physical size.
 */
export const drawRings = (
  ctx: Ctx,
  size: number,
  pal: Palette,
  p: number,
  t: number,
  pulse: number,
) => {
  const c = size / 2;
  const R = size / 2; // outermost radius
  const ring = (r: number, a0: number, sweep: number) => {
    ctx.beginPath();
    ctx.arc(c, c, r, a0, a0 + sweep);
    ctx.stroke();
  };
  const sweep = (delay: number) => clamp01((p - delay) / 0.6) * Math.PI * 2;

  ctx.save();
  ctx.lineCap = "butt";

  // Dark well behind the brain.
  const wellP = clamp01(p / 0.4);
  if (wellP > 0) {
    const g = ctx.createRadialGradient(c, c, 0, c, c, R * 0.64);
    g.addColorStop(0, rgba(pal.bgEdge, 0.55 * wellP));
    g.addColorStop(0.7, rgba(pal.bgEdge, 0.4 * wellP));
    g.addColorStop(0.92, rgba(pal.primary, 0.18 * wellP));
    g.addColorStop(1, rgba(pal.primary, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, R * 0.64, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner bright rim.
  ctx.shadowColor = pal.primary;
  ctx.shadowBlur = R * 0.05;
  ctx.strokeStyle = rgba(pal.primary, 0.95);
  ctx.lineWidth = R * 0.016;
  ring(R * 0.6, -Math.PI / 2, sweep(0.05));

  // Thick gradient band.
  const conic = ctx.createConicGradient(-Math.PI * 0.75 + t * 0.15, c, c);
  conic.addColorStop(0, pal.primary);
  conic.addColorStop(0.3, pal.primary);
  conic.addColorStop(0.5, mixHex(pal.primary, pal.secondary, 0.6));
  conic.addColorStop(0.62, pal.secondary);
  conic.addColorStop(0.78, mixHex(pal.primary, pal.secondary, 0.3));
  conic.addColorStop(1, pal.primary);
  ctx.strokeStyle = conic;
  ctx.shadowColor = pal.secondary;
  ctx.shadowBlur = R * 0.06;
  ctx.globalAlpha = 0.6 + 0.15 * pulse;
  ctx.lineWidth = R * 0.07;
  ring(R * 0.71, -Math.PI / 2, sweep(0.12));
  ctx.globalAlpha = 1;

  // Thin dim ring + bright travelling arcs.
  ctx.shadowBlur = R * 0.02;
  ctx.shadowColor = pal.primary;
  ctx.strokeStyle = rgba(pal.primary, 0.35);
  ctx.lineWidth = R * 0.008;
  ring(R * 0.81, Math.PI * 0.2, sweep(0.2));
  ctx.strokeStyle = rgba(pal.primary, 0.9);
  ctx.lineWidth = R * 0.018;
  const arcsP = clamp01((p - 0.4) / 0.4);
  for (let k = 0; k < 3; k++) {
    const a = t * 0.9 + (k * Math.PI * 2) / 3;
    ring(R * 0.81, a, 0.45 * arcsP);
  }

  // Tick marks.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(pal.primary, 0.4);
  ctx.lineWidth = R * 0.006;
  const ticks = 90;
  const tickP = clamp01((p - 0.3) / 0.6);
  for (let i = 0; i < ticks * tickP; i++) {
    const a = (i / ticks) * Math.PI * 2 - t * 0.2;
    const r0 = R * 0.875;
    const r1 = R * (i % 5 === 0 ? 0.91 : 0.895);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Outer broken ring.
  ctx.strokeStyle = rgba(pal.primary, 0.55);
  ctx.shadowBlur = R * 0.02;
  ctx.lineWidth = R * 0.01;
  const outerP = clamp01((p - 0.25) / 0.6);
  for (let k = 0; k < 4; k++) {
    const a = -t * 0.35 + k * (Math.PI / 2);
    ring(R * 0.97, a, (Math.PI / 2 - 0.25) * outerP);
  }
  // Highlight segment on the purple side.
  ctx.strokeStyle = rgba(pal.secondary, 0.9);
  ctx.shadowColor = pal.secondary;
  ctx.lineWidth = R * 0.02;
  ring(R * 0.97, Math.PI * 0.05 - t * 0.35, Math.PI * 0.4 * outerP);

  ctx.restore();
};
