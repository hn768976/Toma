// Hand-made brush module on Canvas 2D (stands in for p5.brush, which needs
// WebGL). All randomness comes from a seeded Rand passed in by the caller.
//
//  sprayStroke  - spray paint: blurred mist + soft-edged freehand core +
//                 lighter inner pass + overspray speckle
//  markerStroke - chisel/marker: crisp freehand body with dry, broken ends
//  penStroke    - thin pen line (perfect-freehand, light pressure variation)
//  splat        - paint splat: blob with radial spikes and droplets
//  drip         - a running paint drip with a bead at the end
//  inkFill      - flat ink fill with dry-brush streaks (used by Ink Figure)

import { getStroke } from "perfect-freehand";
import { mix, rgba } from "./color";
import type { Pt } from "./math";
import { catmull, smoothPath } from "./path";
import type { Rand } from "./rng";

export const jitterPts = (pts: Pt[], r: Rand, amp: number): Pt[] =>
  pts.map(([x, y]) => [x + r.range(-amp, amp), y + r.range(-amp, amp)] as Pt);

export const fillOutline = (ctx: CanvasRenderingContext2D, outline: number[][]) => {
  if (outline.length < 3) return;
  ctx.beginPath();
  smoothPath(ctx, outline, true);
  ctx.fill();
};

export const freehand = (
  pts: Pt[],
  size: number,
  opts: { thinning?: number; taperStart?: number; taperEnd?: number; pressure?: number[]; jagged?: boolean } = {},
) => {
  const input = opts.pressure ? pts.map((p, i) => [p[0], p[1], opts.pressure![i]]) : pts;
  return getStroke(input, {
    size,
    thinning: opts.thinning ?? 0.3,
    smoothing: opts.jagged ? 0.05 : 0.55,
    streamline: opts.jagged ? 0.0 : 0.35,
    simulatePressure: !opts.pressure,
    start: { taper: opts.taperStart ?? 0, cap: true },
    end: { taper: opts.taperEnd ?? 0, cap: true },
    last: true,
  });
};

const strokeCenter = (ctx: CanvasRenderingContext2D, pts: Pt[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
};

export const sprayStroke = (
  ctx: CanvasRenderingContext2D,
  ctrl: Pt[],
  o: { width: number; color: string; r: Rand; s: number; mist?: number; speckle?: number; light?: string },
) => {
  const pts = catmull(ctrl, 10);
  if (pts.length < 2) return;
  const w = o.width;
  // thin overspray mist (kept low so it reads as paint, not glow)
  ctx.save();
  ctx.filter = `blur(${Math.max(0.5, w * 0.18 * o.s)}px)`;
  ctx.globalAlpha = o.mist ?? 0.1;
  ctx.strokeStyle = o.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = w * 1.15;
  strokeCenter(ctx, pts);
  ctx.stroke();
  ctx.restore();
  // opaque core
  ctx.fillStyle = o.color;
  fillOutline(ctx, freehand(pts, w, { thinning: 0.4, taperStart: w * 1.2, taperEnd: w * 2.2 }));
  bristles(ctx, pts, w, o.color, o.r);
  // speckle + splash along the edges
  const n = Math.round((pts.length / 10) * 22 * (o.speckle ?? 1));
  ctx.fillStyle = o.color;
  for (let i = 0; i < n; i++) {
    const p = pts[o.r.int(0, pts.length)];
    const a = o.r.range(0, Math.PI * 2);
    const dd = w * (0.5 + Math.abs(o.r.gauss()) * 0.55);
    const rad = o.r.range(1.5, 5) * (o.r.chance(0.1) ? 2.5 : 1);
    ctx.globalAlpha = o.r.range(0.7, 1);
    ctx.beginPath();
    ctx.arc(p[0] + Math.cos(a) * dd, p[1] + Math.sin(a) * dd, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// Dry-brush texture: lighter and darker streaks running along the stroke,
// plus ragged bristle hairs past the edges.
export const bristles = (ctx: CanvasRenderingContext2D, pts: Pt[], w: number, color: string, r: Rand) => {
  const n = pts.length;
  if (n < 3) return;
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L] as Pt;
  });
  const lines = Math.max(4, Math.round(w / 9));
  ctx.lineCap = "round";
  for (let k = 0; k < lines; k++) {
    const off = r.range(-0.48, 0.48) * w;
    const i0 = r.int(0, Math.max(1, n - 4));
    const i1 = Math.min(n, i0 + r.int(4, Math.max(5, n)));
    const edge = Math.abs(off) > w * 0.36;
    ctx.strokeStyle = r.chance(0.5) ? mix(color, "#FFFFFF", 0.3) : mix(color, "#000000", 0.25);
    ctx.globalAlpha = edge ? 0.0 : r.range(0.25, 0.55);
    ctx.lineWidth = r.range(1.5, Math.max(2, w * 0.06));
    ctx.beginPath();
    for (let i = i0; i < i1; i++) {
      const x = pts[i][0] + normals[i][0] * off;
      const y = pts[i][1] + normals[i][1] * off;
      if (i === i0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // ragged hairs along both edges
  ctx.strokeStyle = color;
  ctx.globalAlpha = 1;
  const hairs = Math.round(n * 0.8);
  for (let k = 0; k < hairs; k++) {
    const i = r.int(0, n - 2);
    const side = r.sign();
    const off = side * w * r.range(0.42, 0.62);
    const L = r.int(2, 6);
    ctx.lineWidth = r.range(1.2, 3.5);
    ctx.beginPath();
    for (let j = i; j < Math.min(n, i + L); j++) {
      const x = pts[j][0] + normals[j][0] * off;
      const y = pts[j][1] + normals[j][1] * off;
      if (j === i) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

// Big opaque paint mass with rough dry-brush edges (background colour areas).
export const paintMass = (
  ctx: CanvasRenderingContext2D,
  ctrl: Pt[],
  o: { width: number; color: string; r: Rand; s: number; alpha?: number },
) => {
  const pts = catmull(ctrl, 8);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color;
  fillOutline(ctx, freehand(pts, o.width, { thinning: 0.35, taperStart: o.width * 0.6, taperEnd: o.width * 0.8 }));
  bristles(ctx, pts, o.width * 0.8, o.color, o.r);
  // dry-brush hairs fanning out of the ends
  const n = 0;
  ctx.strokeStyle = o.color;
  for (const end of [0, pts.length - 1]) {
    const p = pts[end];
    const q = pts[end === 0 ? Math.min(3, pts.length - 1) : Math.max(0, pts.length - 4)];
    const a = Math.atan2(p[1] - q[1], p[0] - q[0]);
    for (let k = 0; k < n; k++) {
      const off = o.r.range(-0.4, 0.4) * o.width;
      const L = o.r.range(0.2, 0.9) * o.width;
      const x0 = p[0] - Math.sin(a) * off;
      const y0 = p[1] + Math.cos(a) * off;
      ctx.lineWidth = o.r.range(2, 7);
      ctx.beginPath();
      ctx.moveTo(x0 - Math.cos(a) * 20, y0 - Math.sin(a) * 20);
      ctx.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L);
      ctx.stroke();
    }
  }
  ctx.restore();
};

export const markerStroke = (
  ctx: CanvasRenderingContext2D,
  ctrl: Pt[],
  o: { width: number; color: string; r: Rand; dry?: boolean },
) => {
  const pts = catmull(ctrl, 8);
  if (pts.length < 2) return;
  const w = o.width;
  ctx.fillStyle = o.color;
  fillOutline(ctx, freehand(pts, w, { thinning: 0.15, taperStart: w * 0.3, taperEnd: w * 0.5 }));
  if (o.dry !== false) {
    // dry, broken tail: a few thin parallel bristle lines past the end
    const n = pts.length;
    const tail = pts.slice(Math.max(0, n - 10));
    const ex = tail[tail.length - 1][0] - tail[0][0];
    const ey = tail[tail.length - 1][1] - tail[0][1];
    const L = Math.hypot(ex, ey) || 1;
    const nx = -ey / L;
    const ny = ex / L;
    ctx.strokeStyle = o.color;
    ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      const off = (k / 3 - 0.5) * w * 0.8;
      const ext = o.r.range(0.2, 0.8) * w * 2;
      ctx.lineWidth = o.r.range(1.5, w * 0.12);
      ctx.beginPath();
      const p0 = tail[0];
      const p1 = tail[tail.length - 1];
      ctx.moveTo(p0[0] + nx * off, p0[1] + ny * off);
      ctx.lineTo(p1[0] + nx * off + (ex / L) * ext, p1[1] + ny * off + (ey / L) * ext);
      ctx.stroke();
    }
  }
};

export const penStroke = (
  ctx: CanvasRenderingContext2D,
  ctrl: Pt[],
  o: { width: number; color: string; smooth?: boolean },
) => {
  const pts = o.smooth === false ? ctrl : catmull(ctrl, 8);
  if (pts.length < 2) return;
  ctx.fillStyle = o.color;
  fillOutline(ctx, freehand(pts, o.width, { thinning: 0.45, taperStart: o.width * 3, taperEnd: o.width * 4 }));
};

export const splat = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  r: Rand,
) => {
  ctx.fillStyle = color;
  const n = r.int(10, 18);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(-0.15, 0.15);
    const rad = size * (r.chance(0.35) ? r.range(0.9, 1.6) : r.range(0.45, 0.75));
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
  }
  ctx.beginPath();
  smoothPath(ctx, pts, true);
  ctx.fill();
  const m = r.int(5, 14);
  for (let i = 0; i < m; i++) {
    const a = r.range(0, Math.PI * 2);
    const dd = size * r.range(1.2, 3.2);
    const rad = size * r.range(0.04, 0.16);
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * dd, y + Math.sin(a) * dd, rad, rad * r.range(0.6, 1.2), a, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const drip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  w: number,
  color: string,
  wob = 0,
) => {
  if (len <= 1) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  // slightly tapered run, wider at top
  ctx.moveTo(x - w * 0.6, y);
  ctx.quadraticCurveTo(x - w * 0.45 + wob * 2.5, y + len * 0.5, x - w * 0.35 + wob * 0.6, y + len);
  ctx.lineTo(x + w * 0.35 + wob * 0.6, y + len);
  ctx.quadraticCurveTo(x + w * 0.45 + wob * 2.5, y + len * 0.5, x + w * 0.6, y);
  ctx.closePath();
  ctx.fill();
  const bead = 0.45 + ((Math.abs(wob) * 7.3) % 1) * 0.45; // varied bead size per drip
  if (Math.abs(wob) > 1) {
    ctx.beginPath();
    ctx.ellipse(x + wob * 0.6, y + len, w * bead, w * (bead + 0.18), 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

// Soft mist cloud (background colour washes).
export const mistCloud = (
  ctx: CanvasRenderingContext2D,
  ctrl: Pt[],
  o: { width: number; color: string; r: Rand; s: number; alpha?: number },
) => {
  const pts = catmull(ctrl, 8);
  ctx.save();
  ctx.filter = `blur(${Math.max(0.5, o.width * 0.22 * o.s)}px)`;
  ctx.globalAlpha = o.alpha ?? 0.9;
  ctx.strokeStyle = o.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = o.width;
  strokeCenter(ctx, pts);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = (o.alpha ?? 0.9) * 0.9;
  ctx.filter = `blur(${Math.max(0.5, o.width * 0.05 * o.s)}px)`;
  ctx.fillStyle = o.color;
  fillOutline(ctx, freehand(pts, o.width * 0.75, { thinning: 0.4, taperStart: o.width, taperEnd: o.width }));
  ctx.restore();
  ctx.fillStyle = o.color;
  const n = Math.round(pts.length * 6);
  for (let i = 0; i < n; i++) {
    const p = pts[o.r.int(0, pts.length)];
    const a = o.r.range(0, Math.PI * 2);
    const dd = o.width * (0.5 + Math.abs(o.r.gauss()) * 0.35);
    ctx.globalAlpha = o.r.range(0.4, 0.95);
    ctx.beginPath();
    ctx.arc(p[0] + Math.cos(a) * dd, p[1] + Math.sin(a) * dd, o.r.range(1.5, 6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

// Flat ink fill clipped to a path, with fine dry-brush streaks in `streak`
// colour running roughly along `angle`.
export const inkFill = (
  ctx: CanvasRenderingContext2D,
  clip: Path2D,
  bbox: [number, number, number, number],
  o: { color: string; streak: string; r: Rand; angle: number; count: number; len: [number, number]; width: [number, number]; alpha?: number },
) => {
  ctx.save();
  ctx.clip(clip);
  ctx.fillStyle = o.color;
  ctx.fillRect(bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]);
  ctx.fillStyle = o.streak;
  for (let i = 0; i < o.count; i++) {
    const x = o.r.range(bbox[0], bbox[2]);
    const y = o.r.range(bbox[1], bbox[3]);
    const L = o.r.range(o.len[0], o.len[1]);
    const a = o.angle + o.r.range(-0.25, 0.25);
    const bend = o.r.range(-0.15, 0.15) * L;
    const pts: Pt[] = [
      [x, y],
      [x + (Math.cos(a) * L) / 2 - (Math.sin(a) * bend) / 2, y + (Math.sin(a) * L) / 2 + (Math.cos(a) * bend) / 2],
      [x + Math.cos(a) * L, y + Math.sin(a) * L],
    ];
    ctx.globalAlpha = (o.alpha ?? 0.9) * o.r.range(0.55, 1);
    fillOutline(ctx, freehand(catmull(pts, 6), o.r.range(o.width[0], o.width[1]), { thinning: 0.7, taperStart: L * 0.5, taperEnd: L * 0.5 }));
  }
  ctx.restore();
};

export { rgba };
