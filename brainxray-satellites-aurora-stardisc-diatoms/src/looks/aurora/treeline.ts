// Procedural birch + spruce silhouettes along the bottom, drawn once into a
// mask canvas at backing resolution: R = ground, G = trees.
import { mulberry32, range, Rng } from "../../lib/rand";

const branch = (ctx: CanvasRenderingContext2D, r: Rng, x: number, y: number, ang: number, len: number, w: number, depth: number) => {
  if (depth <= 0 || len < 2.5) return;
  const segs = 5;
  let cx = x, cy = y, a = ang;
  const pts: [number, number, number][] = [];
  for (let s = 0; s < segs; s++) {
    a += range(r, -0.25, 0.25);
    const nx = cx + Math.cos(a) * (len / segs);
    const ny = cy + Math.sin(a) * (len / segs);
    // taper along the branch
    ctx.lineWidth = Math.max(0.5, w * (1 - (s / segs) * 0.45));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    cx = nx;
    cy = ny;
    pts.push([cx, cy, a]);
  }
  const kids = depth > 5 ? 3 : 2 + (r() < 0.6 ? 1 : 0);
  for (let k = 0; k < kids; k++) {
    const p = pts[Math.min(segs - 1, 1 + Math.floor(r() * (segs - 1)))];
    const side = k % 2 === 0 ? -1 : 1;
    const na = p[2] + side * range(r, 0.25, 0.8) + (depth < 4 ? range(r, -0.3, 0.45) : 0);
    branch(ctx, r, p[0], p[1], na, len * range(r, 0.55, 0.8), w * 0.6, depth - 1);
  }
};

// Ragged spruce: uneven tiers of drooping branches, a thin leader, a lean.
const spruce = (ctx: CanvasRenderingContext2D, r: Rng, x: number, base: number, h: number) => {
  const lean = range(r, -0.04, 0.04);
  const W = h * range(r, 0.16, 0.24);
  ctx.lineWidth = Math.max(1, h * 0.02);
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x + lean * h, base - h);
  ctx.stroke();
  const tiers = Math.floor(range(r, 18, 30));
  for (let i = 1; i < tiers; i++) {
    const t = i / tiers;
    if (r() < 0.12) continue; // gaps
    const yy = base - h + t * h;
    const cx = x + lean * h * (1 - t);
    for (const side of [-1, 1]) {
      const len = W * Math.pow(t, 0.85) * range(r, 0.45, 1.25);
      ctx.lineWidth = Math.max(0.8, h * 0.012 * range(r, 0.6, 1.4));
      ctx.beginPath();
      ctx.moveTo(cx, yy);
      ctx.quadraticCurveTo(cx + side * len * 0.6, yy - h * 0.01, cx + side * len, yy + h * range(r, 0.01, 0.04));
      ctx.stroke();
      // needles clump
      ctx.beginPath();
      ctx.ellipse(cx + side * len * 0.55, yy + h * 0.008, len * 0.5, h * 0.013, side * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** Mask canvas sized to the backing store; drawn in design units (3840x2160). */
export const drawTreeline = (W: number, H: number, res: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(W * res);
  c.height = Math.round(H * res);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(res, res);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const r = mulberry32(90210);
  // Ground: an uneven horizon (red channel)
  ctx.fillStyle = "#f00";
  ctx.beginPath();
  ctx.moveTo(0, H);
  let y = H - 120;
  for (let x = 0; x <= W; x += 24) {
    const left = Math.max(0, 1 - x / (W * 0.45));
    y += range(r, -3, 3);
    const target = H - 30 - left * 95 - Math.sin(x * 0.0021) * 18 - Math.sin(x * 0.0097) * 6 - (x > W * 0.78 ? (x - W * 0.78) * 0.1 : 0);
    y += (target - y) * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  // Trees (green channel), drawn over the ground
  ctx.fillStyle = "#0f0";
  ctx.strokeStyle = "#0f0";
  const birches = [
    [300, 2160, 1000, 20],
    [560, 2150, 860, 16],
    [800, 2140, 700, 13],
    [1000, 2150, 520, 10],
    [100, 2170, 760, 14],
    [1200, 2160, 380, 8],
    [1380, 2150, 260, 6],
  ];
  for (const [x, yy, h, w] of birches) {
    branch(ctx, r, x, yy, -Math.PI / 2 + range(r, -0.08, 0.08), h * 0.4, w, 7);
  }
  // A couple of small dark tree tips in the bottom-right corner
  void spruce;
  // a faint dark blob of tree tops in the bottom-right corner
  ctx.beginPath();
  ctx.ellipse(3330, H + 10, 190, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
};
