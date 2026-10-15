// Prebaked bright-field microscope sprites. Each sprite is drawn on an opaque
// cell whose neutral value means "transmission 1.0" (T is stored as T/1.25 so
// faint bright halos above 1.0 survive). Every sprite is baked at three focus
// levels (sharp, soft, very soft) by blurring the whole cell.
import { mulberry32, range, Rng } from "../../lib/rand";

export const T_SCALE = 1.25;
const NEUTRAL = Math.round(255 / T_SCALE); // 204
export const BLUR_LEVELS = [0, 5, 12, 36]; // design px: sharp, slightly soft, soft, very soft

export type Kind = "diatom" | "algae" | "cluster" | "needle" | "fibre" | "debris" | "speck" | "bubble";
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
  const style = r();
  const L = s * range(r, 0.55, 0.8);
  // plump ovals, slender rods, or boat-shaped pennates
  const girdle = style >= 0.6 && style < 0.72; // girdle (side) view: a rounded rectangle
  const W = L * (style < 0.35 ? range(r, 0.4, 0.52) : style < 0.6 ? range(r, 0.14, 0.2) : girdle ? range(r, 0.3, 0.45) : range(r, 0.24, 0.34));
  const p = style < 0.35 ? range(r, 0.45, 0.6) : range(r, 0.5, 0.9);
  const cap = style > 0.75 ? range(r, 2, 4) : range(r, 0, 1);
  let path = diatomPath(L, W, p, cap);
  if (girdle) {
    path = new Path2D();
    path.roundRect(-L / 2, -W / 2, L, W, W * 0.28);
  }
  // broad bright halo (bright-field phase halo)
  ctx.save();
  ctx.filter = `blur(${s * 0.02}px)`;
  ctx.lineWidth = s * 0.06;
  ctx.strokeStyle = tcol(1.16);
  ctx.stroke(path);
  ctx.restore();
  // blue-violet fringe just outside the wall
  // chromatic fringes: blue on one side, yellow on the other
  ctx.lineWidth = s * 0.016;
  ctx.strokeStyle = tcol(1.05, [0.85, 0.92, 1.15]);
  ctx.save();
  ctx.translate(-s * 0.008, -s * 0.01);
  ctx.scale(1.03, 1.08);
  ctx.stroke(path);
  ctx.restore();
  ctx.strokeStyle = tcol(1.05, [1.12, 1.05, 0.8]);
  ctx.save();
  ctx.translate(s * 0.008, s * 0.01);
  ctx.scale(1.03, 1.08);
  ctx.stroke(path);
  ctx.restore();
  // pale glassy body
  ctx.fillStyle = tcol(range(r, 0.9, 0.98), [1.0, 1.0, 0.97]);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  // golden-brown protoplast / chloroplast mass
  if (r() < 0.85) {
    const tint: [number, number, number] = [1.0, range(r, 0.86, 0.92), range(r, 0.58, 0.7)]; // golden-brown
    ctx.filter = `blur(${s * 0.012}px)`;
    ctx.fillStyle = tcol(range(r, 0.28, 0.45), tint);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(range(r, -L * 0.04, L * 0.04), (side * W) / 6, L * range(r, 0.26, 0.36), W * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    // green chloroplast bands in some cells
    if (r() < 0.5) {
      ctx.fillStyle = tcol(range(r, 0.7, 0.8), [0.8, 1.0, 0.45]);
      ctx.fillRect(-L * 0.3, -W * 0.3, L * 0.6, W * 0.08);
      ctx.fillRect(-L * 0.3, W * 0.22, L * 0.6, W * 0.08);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = tcol(range(r, 0.45, 0.7), tint);
      ctx.beginPath();
      ctx.arc(range(r, -L * 0.3, L * 0.3), range(r, -W * 0.28, W * 0.28), s * range(r, 0.006, 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // glassy bright middle
  ctx.save();
  ctx.filter = `blur(${s * 0.015}px)`;
  ctx.fillStyle = tcol(1.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, L * 0.3, W * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // fine cross striae
  ctx.strokeStyle = tcol(0.76);
  ctx.lineWidth = Math.max(0.8, s * 0.008);
  const step = s * 0.026;
  for (let x = -L / 2; x < L / 2; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, -W / 2);
    ctx.lineTo(x + (x / L) * W * 0.15, -W * 0.08);
    ctx.moveTo(x, W / 2);
    ctx.lineTo(x + (x / L) * W * 0.15, W * 0.08);
    ctx.stroke();
  }
  // raphe and central nodule
  ctx.strokeStyle = tcol(0.7);
  ctx.lineWidth = Math.max(0.8, s * 0.006);
  ctx.beginPath();
  ctx.moveTo(-L * 0.44, 0);
  ctx.lineTo(L * 0.44, 0);
  ctx.stroke();
  ctx.restore();
  // frustule wall: grey with a warm inner edge
  ctx.lineWidth = s * 0.014;
  ctx.strokeStyle = tcol(0.5, [1.0, 0.97, 0.9]);
  ctx.stroke(path);
};

// ------------------------------------------------------------- algae
const greenCell = (ctx: CanvasRenderingContext2D, r: Rng, x: number, y: number, rad: number) => {
  ctx.fillStyle = tcol(1.1);
  ctx.beginPath();
  ctx.arc(x, y, rad * 1.18, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
  // #9AC83A as transmission tint
  g.addColorStop(0, tcol(range(r, 1.0, 1.08), [0.95, 1.0, 0.4]));
  g.addColorStop(0.65, tcol(range(r, 0.88, 0.96), [0.85, 0.92, 0.38]));
  g.addColorStop(1, tcol(0.6, [0.7, 0.72, 0.3]));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
};
const drawAlgae = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => greenCell(ctx, r, 0, 0, s * range(r, 0.3, 0.4));
const drawCluster = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const n = 2 + Math.floor(r() * 5);
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
  const w = s * range(r, 0.007, 0.01);
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
  ctx.restore();
};
const drawFibre = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  // a pale spray of fine filaments fanning from one end
  const n = 7 + Math.floor(r() * 6);
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI * 0.75 + range(r, -0.35, 0.35);
    const len = s * range(r, 0.45, 0.9);
    ctx.strokeStyle = tcol(range(r, 0.6, 0.78));
    ctx.lineWidth = s * range(r, 0.003, 0.007);
    ctx.beginPath();
    let x = s * 0.4, y = s * 0.4, a = ang;
    ctx.moveTo(x, y);
    for (let t = 0; t < len; t += s * 0.04) {
      a += range(r, -0.18, 0.18);
      x += Math.cos(a) * s * 0.04;
      y += Math.sin(a) * s * 0.04;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};
const drawBubble = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const R = s * range(r, 0.25, 0.4);
  // air bubble: thick dark ring, bright centre, crisp edges
  ctx.fillStyle = tcol(1.12);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = s * 0.18;
  ctx.strokeStyle = tcol(0.5);
  ctx.stroke();
  ctx.lineWidth = s * 0.03;
  ctx.strokeStyle = tcol(1.12);
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.18, 0, Math.PI * 2);
  ctx.stroke();
};

// ------------------------------------------------------------- debris
const drawDebris = (ctx: CanvasRenderingContext2D, r: Rng, s: number) => {
  const n = 160;
  const R = s * 0.32;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.6) * R * (0.7 + 0.3 * Math.sin(a * 3 + 1));
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85;
    const tint: [number, number, number] = r() < 0.6 ? [0.9, 0.92, 0.45] : [0.85, 0.82, 0.5];
    ctx.fillStyle = tcol(range(r, 0.72, 0.92), tint);
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
  ctx.fillStyle = tcol(range(r, 0.45, 0.72));
  ctx.beginPath();
  ctx.arc(0, 0, s * range(r, 0.1, 0.18), 0, Math.PI * 2);
  ctx.fill();
};

export const SPRITES: SpriteDef[] = [
  ...Array.from({ length: 12 }, () => ({ kind: "diatom" as const, size: 300, draw: drawDiatom })),
  ...Array.from({ length: 3 }, () => ({ kind: "algae" as const, size: 48, draw: drawAlgae })),
  ...Array.from({ length: 3 }, () => ({ kind: "cluster" as const, size: 100, draw: drawCluster })),
  ...Array.from({ length: 1 }, () => ({ kind: "needle" as const, size: 480, draw: drawNeedle })),
  ...Array.from({ length: 2 }, () => ({ kind: "fibre" as const, size: 640, draw: drawFibre })),
  ...Array.from({ length: 4 }, () => ({ kind: "debris" as const, size: 440, draw: drawDebris })),
  ...Array.from({ length: 2 }, () => ({ kind: "speck" as const, size: 48, draw: drawSpeck })),
  ...Array.from({ length: 2 }, () => ({ kind: "bubble" as const, size: 90, draw: drawBubble })),
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
