// Prebaked bright-field microscope sprites. Each sprite is drawn on an opaque
// cell whose neutral value means "transmission 1.0" (T is stored as T/1.25 so
// faint bright halos above 1.0 survive). Every sprite is baked at three focus
// levels (sharp, soft, very soft) by blurring the whole cell.
import { mulberry32, range, Rng } from "../../lib/rand";

export const T_SCALE = 1.25;
const NEUTRAL = Math.round(255 / T_SCALE); // 204
export const BLUR_LEVELS = [0, 10, 26]; // design px

export type Kind = "diatom" | "algae" | "cluster" | "needle" | "fibre" | "debris" | "speck";
export type SpriteDef = { kind: Kind; size: number; draw: (ctx: CanvasRenderingContext2D, r: Rng, s: number) => void };
export type AtlasEntry = { kind: Kind; size: number; uv: [number, number, number, number][] }; // per blur level

const tcol = (t: number, tint: [number, number, number] = [1, 1, 1]) => {
  const c = tint.map((k) => Math.max(0, Math.min(255, Math.round((t * k * 255) / T_SCALE))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// ------------------------------------------------------------- diatoms
const diatomPath = (L: number, W: number, p: number, cap: number) => {
  const path = new Path2D();
  const N = 64;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const x = -L / 2 + (L * i) / N;
    const u = Math.min(1, Math.abs((2 * x) / L));
    const w = (W / 2) * Math.pow(Math.max(0, 1 - Math.pow(u, 2 + cap)), p);
    pts.push([x, -w]);
  }
  for (let i = N; i >= 0; i--) {
    const x = -L / 2 + (L * i) / N;
    const u = Math.min(1, Math.abs((2 * x) / L));
    const w = (W / 2) * Math.pow(Math.max(0, 1 - Math.pow(u, 2 + cap)), p);
    pts.push([x, w]);
  }
  path.moveTo(pts[0][0], pts[0][1]);
  for (const q of pts) path.lineTo(q[0], q[1]);
  path.closePath();
  return path;
};

const drawDiatom = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const L = s * range(r, 0.62, 0.8);
  const W = L * range(r, 0.26, 0.42);
  const p = range(r, 0.42, 0.75); // 0.5 rounded ... 1 pointed
  const cap = range(r, 0, 1.2);
  const path = diatomPath(L, W, p, cap);
  // bright halo just outside (phase/Becke line in bright field)
  ctx.lineWidth = s * 0.03;
  ctx.strokeStyle = tcol(1.08);
  ctx.stroke(path);
  // pale inner body
  ctx.fillStyle = tcol(range(r, 0.86, 0.94), [0.98, 1.0, 0.97]);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  // dark protoplast mass filling much of the cell (as seen in bright field)
  if (r() < 0.75) {
    ctx.fillStyle = tcol(range(r, 0.42, 0.6), [0.95, 0.97, 0.88]);
    ctx.beginPath();
    ctx.ellipse(range(r, -L * 0.04, L * 0.04), 0, L * range(r, 0.26, 0.36), W * range(r, 0.24, 0.33), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // chloroplasts: golden-green plates along the girdle in many cells
  if (r() < 0.5) {
    const tint: [number, number, number] = [range(r, 0.85, 0.95), range(r, 0.9, 1.0), range(r, 0.45, 0.65)];
    ctx.fillStyle = tcol(range(r, 0.72, 0.85), tint);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(range(r, -L * 0.05, L * 0.05), (side * W) / 5, L * range(r, 0.3, 0.4), W * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // granules
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = tcol(range(r, 0.55, 0.75), tint);
      ctx.beginPath();
      ctx.arc(range(r, -L * 0.3, L * 0.3), range(r, -W * 0.28, W * 0.28), s * range(r, 0.01, 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // fine cross striae
  ctx.strokeStyle = tcol(0.8);
  ctx.lineWidth = Math.max(0.6, s * 0.006);
  const step = s * 0.022;
  for (let x = -L / 2; x < L / 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, -W / 2);
    ctx.lineTo(x + (x / L) * W * 0.15, -W * 0.06);
    ctx.moveTo(x, W / 2);
    ctx.lineTo(x + (x / L) * W * 0.15, W * 0.06);
    ctx.stroke();
  }
  // raphe and central nodule
  ctx.strokeStyle = tcol(0.62);
  ctx.lineWidth = Math.max(0.8, s * 0.008);
  ctx.beginPath();
  ctx.moveTo(-L * 0.44, 0);
  ctx.lineTo(L * 0.44, 0);
  ctx.stroke();
  ctx.fillStyle = tcol(0.7);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.02, W * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // dark outline (frustule wall), doubled
  ctx.lineWidth = s * 0.018;
  ctx.strokeStyle = tcol(0.42, [0.95, 1, 0.95]);
  ctx.stroke(path);
  ctx.lineWidth = s * 0.008;
  ctx.strokeStyle = tcol(0.6);
  ctx.save();
  ctx.scale(0.93, 0.8);
  ctx.stroke(path);
  ctx.restore();
};

// ------------------------------------------------------------- algae
const greenCell = (ctx: CanvasRenderingContext2D, r: Rng, x: number, y: number, rad: number) => {
  ctx.fillStyle = tcol(1.1);
  ctx.beginPath();
  ctx.arc(x, y, rad * 1.18, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
  // #9AC83A as transmission tint
  g.addColorStop(0, tcol(range(r, 1.0, 1.08), [0.95, 1.0, 0.3]));
  g.addColorStop(0.7, tcol(range(r, 0.85, 0.95), [0.78, 0.85, 0.2]));
  g.addColorStop(1, tcol(0.5, [0.6, 0.65, 0.3]));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
};
const drawAlgae = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => greenCell(ctx, r, 0, 0, s * range(r, 0.3, 0.4));
const drawCluster = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const n = 2 + Math.floor(r() * 4);
  const rad = s * 0.12;
  let x = -rad * 1.2, y = 0;
  for (let i = 0; i < n; i++) {
    greenCell(ctx, r, x, y, rad * range(r, 0.85, 1.1));
    const a = range(r, -1.2, 1.2);
    x += Math.cos(a) * rad * 1.9;
    y += Math.sin(a) * rad * 1.9;
  }
};

// ------------------------------------------------------------- rods
const drawNeedle = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const L = s * 0.9;
  const w = s * range(r, 0.012, 0.02);
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = tcol(1.08);
  ctx.fillRect(-L / 2 - 2, -w * 1.8, L + 4, w * 3.6);
  ctx.beginPath();
  ctx.moveTo(-L / 2, 0);
  ctx.lineTo(-L / 2 + L * 0.08, -w);
  ctx.lineTo(L / 2 - L * 0.08, -w * 0.8);
  ctx.lineTo(L / 2, 0);
  ctx.lineTo(L / 2 - L * 0.08, w * 0.8);
  ctx.lineTo(-L / 2 + L * 0.08, w);
  ctx.closePath();
  ctx.fillStyle = tcol(0.45);
  ctx.fill();
  ctx.fillStyle = tcol(0.85);
  ctx.fillRect(-L * 0.4, -w * 0.25, L * 0.8, w * 0.5);
  ctx.restore();
};
const drawFibre = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  ctx.save();
  ctx.rotate(-Math.PI / 4 + range(r, -0.2, 0.2));
  for (let k = 0; k < 5; k++) {
    ctx.strokeStyle = tcol(range(r, 0.55, 0.8));
    ctx.lineWidth = s * range(r, 0.004, 0.009);
    ctx.beginPath();
    let x = -s * 0.45, y = range(r, -s * 0.06, s * 0.06);
    ctx.moveTo(x, y);
    while (x < s * 0.45) {
      x += s * 0.05;
      y += range(r, -s * 0.012, s * 0.012);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

// ------------------------------------------------------------- debris
const drawDebris = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const n = 160;
  const R = s * 0.32;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.6) * R * (0.7 + 0.3 * Math.sin(a * 3 + 1));
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85;
    const tint: [number, number, number] = r() < 0.6 ? [0.95, 0.95, 0.55] : [0.9, 0.82, 0.6];
    ctx.fillStyle = tcol(range(r, 0.72, 0.95), tint);
    ctx.beginPath();
    ctx.arc(x, y, s * range(r, 0.012, 0.035), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = tcol(range(r, 0.35, 0.6), [0.9, 0.85, 0.6]);
    ctx.beginPath();
    ctx.arc(range(r, -R, R) * 0.8, range(r, -R, R) * 0.7, s * range(r, 0.006, 0.014), 0, Math.PI * 2);
    ctx.fill();
  }
};
const drawSpeck = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  ctx.fillStyle = tcol(1.08);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tcol(range(r, 0.25, 0.5));
  ctx.beginPath();
  ctx.arc(0, 0, s * range(r, 0.12, 0.2), 0, Math.PI * 2);
  ctx.fill();
};

export const SPRITES: SpriteDef[] = [
  ...Array.from({ length: 12 }, () => ({ kind: "diatom" as const, size: 250, draw: drawDiatom })),
  ...Array.from({ length: 3 }, () => ({ kind: "algae" as const, size: 48, draw: drawAlgae })),
  ...Array.from({ length: 3 }, () => ({ kind: "cluster" as const, size: 100, draw: drawCluster })),
  ...Array.from({ length: 2 }, () => ({ kind: "needle" as const, size: 640, draw: drawNeedle })),
  ...Array.from({ length: 2 }, () => ({ kind: "fibre" as const, size: 640, draw: drawFibre })),
  ...Array.from({ length: 4 }, () => ({ kind: "debris" as const, size: 640, draw: drawDebris })),
  ...Array.from({ length: 2 }, () => ({ kind: "speck" as const, size: 48, draw: drawSpeck })),
];

/** Shelf-pack every sprite x blur level into one canvas at backing resolution. */
export const bakeAtlas = (res: number) => {
  const r = mulberry32(1879);
  const pad = BLUR_LEVELS[BLUR_LEVELS.length - 1] * 2.2;
  const cells: { def: SpriteDef; blur: number; w: number }[] = [];
  for (const def of SPRITES) for (const b of BLUR_LEVELS) cells.push({ def, blur: b, w: Math.ceil((def.size + 2 * pad) * res) });
  const ATLAS_W = Math.ceil(4600 * res);
  let x = 0, y = 0, rowH = 0;
  const placed: { x: number; y: number; w: number }[] = [];
  const order = cells.map((_, i) => i).sort((a, b) => cells[b].w - cells[a].w);
  for (const i of order) {
    const c = cells[i];
    if (x + c.w > ATLAS_W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    placed[i] = { x, y, w: c.w };
    x += c.w;
    rowH = Math.max(rowH, c.w);
  }
  const ATLAS_H = y + rowH;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = `rgb(${NEUTRAL},${NEUTRAL},${NEUTRAL})`;
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);
  // draw each sprite once (sharp) into a scratch cell, then copy with blur
  const entries: AtlasEntry[] = [];
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d")!;
  SPRITES.forEach((def, si) => {
    const w = Math.ceil((def.size + 2 * pad) * res);
    scratch.width = w;
    scratch.height = w;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = `rgb(${NEUTRAL},${NEUTRAL},${NEUTRAL})`;
    sctx.fillRect(0, 0, w, w);
    sctx.setTransform(res, 0, 0, res, w / 2, w / 2);
    sctx.lineJoin = "round";
    sctx.lineCap = "round";
    def.draw(sctx, mulberry32(9000 + si * 77 + Math.floor(r() * 0)), def.size);
    const uv: [number, number, number, number][] = [];
    BLUR_LEVELS.forEach((b, bi) => {
      const p = placed[si * BLUR_LEVELS.length + bi];
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y, p.w, p.w);
      ctx.clip();
      ctx.filter = b > 0 ? `blur(${b * res}px)` : "none";
      ctx.drawImage(scratch, p.x, p.y);
      ctx.restore();
      uv.push([p.x / ATLAS_W, p.y / ATLAS_H, p.w / ATLAS_W, p.w / ATLAS_H]);
    });
    entries.push({ kind: def.kind, size: def.size + 2 * pad, uv });
  });
  return { canvas, entries };
};
