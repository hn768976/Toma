// Procedural birch + spruce silhouettes along the bottom-left, drawn once
// into a mask canvas (white = tree) at backing resolution.
import { mulberry32, range, Rng } from "../../lib/rand";

const branch = (ctx: CanvasRenderingContext2D, r: Rng, x: number, y: number, ang: number, len: number, w: number, depth: number) => {
  if (depth <= 0 || len < 3 || w < 0.35) return;
  const segs = 4;
  let cx = x, cy = y, a = ang;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const pts: [number, number, number][] = [];
  for (let s = 0; s < segs; s++) {
    a += range(r, -0.22, 0.22);
    cx += Math.cos(a) * (len / segs);
    cy += Math.sin(a) * (len / segs);
    ctx.lineTo(cx, cy);
    pts.push([cx, cy, a]);
  }
  ctx.stroke();
  const kids = depth > 4 ? 3 : 2 + (r() < 0.5 ? 1 : 0);
  for (let k = 0; k < kids; k++) {
    const p = pts[Math.min(segs - 1, 1 + Math.floor(r() * (segs - 1)))];
    const side = k % 2 === 0 ? -1 : 1;
    // birch twigs droop slightly; upper kids aim upward
    const na = p[2] + side * range(r, 0.25, 0.75) + (depth < 3 ? range(r, -0.2, 0.5) : 0);
    branch(ctx, r, p[0], p[1], na, len * range(r, 0.55, 0.78), w * 0.62, depth - 1);
  }
};

const spruce = (ctx: CanvasRenderingContext2D, r: Rng, x: number, base: number, h: number) => {
  const w = h * 0.2;
  ctx.beginPath();
  ctx.moveTo(x, base - h);
  const tiers = 26;
  for (let i = 1; i <= tiers; i++) {
    const t = i / tiers;
    const yy = base - h + t * h;
    const ww = w * Math.pow(t, 0.9) * range(r, 0.75, 1.15);
    ctx.lineTo(x + ww, yy - h * 0.012);
    ctx.lineTo(x + ww * 0.35, yy);
  }
  for (let i = tiers; i >= 1; i--) {
    const t = i / tiers;
    const yy = base - h + t * h;
    const ww = w * Math.pow(t, 0.9) * range(r, 0.75, 1.15);
    ctx.lineTo(x - ww * 0.35, yy);
    ctx.lineTo(x - ww, yy - h * 0.012);
  }
  ctx.closePath();
  ctx.fill();
};

/** Mask canvas sized to the backing store; drawn in design units (3840x2160). */
export const drawTreeline = (W: number, H: number, res: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(W * res);
  c.height = Math.round(H * res);
  const ctx = c.getContext("2d")!;
  ctx.scale(res, res);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const r = mulberry32(90210);
  // Ground mound under the trees
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) {
    const left = Math.max(0, 1 - x / (W * 0.42));
    const yy = H - 30 - left * 90 - Math.sin(x * 0.004) * 14 - (x > W * 0.8 ? (x - W * 0.8) * 0.12 : 0);
    ctx.lineTo(x, yy);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  // Birches: bare, fine crowns (as in the reference, bottom-left)
  const birches = [
    [260, 2160, 900, 15],
    [470, 2150, 760, 12],
    [690, 2140, 640, 10],
    [880, 2150, 520, 9],
    [120, 2170, 620, 10],
    [1040, 2160, 380, 7],
  ];
  for (const [x, y, h, w] of birches) {
    branch(ctx, r, x, y, -Math.PI / 2 + range(r, -0.08, 0.08), h * 0.42, w, 8);
  }
  // Small spruce tops along the right horizon
  for (let i = 0; i < 14; i++) {
    const x = 2900 + i * 70 + range(r, -20, 20);
    spruce(ctx, r, x, H - 20 - (x - 2900) * 0.08, range(r, 70, 170));
  }
  for (let i = 0; i < 10; i++) {
    const x = 1150 + i * 85 + range(r, -20, 20);
    spruce(ctx, r, x, H - 30, range(r, 40, 110));
  }
  return c;
};
