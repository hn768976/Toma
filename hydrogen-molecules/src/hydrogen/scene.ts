/**
 * 2.5D molecular world: real 3D positions + perspective projection, drawn
 * with Canvas 2D. Each molecule gets its own depth-of-field blur derived
 * from its distance to the focus plane (true per-object DOF), far molecules
 * fade into the haze and a zoom-blur pass reproduces the fast dolly-in.
 */
import {
  Vec3,
  add,
  clamp,
  cross,
  dot,
  easeInOutSine,
  easeOutCubic,
  lerp,
  mulberry32,
  norm,
  rotate,
  scale,
  smoothstep,
  sub,
} from "./math";
import type { Palette } from "./palette";
import { SpriteSet, pickSprite } from "./sprites";

export const ATOM_R = 0.5;
export const BOND = 1.2;

export type Molecule = {
  p0: Vec3;
  vel: Vec3;
  axis0: Vec3;
  spinAxis: Vec3;
  spin: number;
  phase: number;
  hero: boolean;
  scripted?: boolean;
};

export type Camera = {
  pos: Vec3;
  target: Vec3;
  roll: number;
  /** focus distance (world units) */
  focus: number;
  /** focal length as a fraction of frame width */
  focal: number;
  /** strength of the radial zoom-blur (fraction of frame) */
  zoomBlur: number;
  /** white-out overlay opacity */
  whiteout: number;
  /** background lattice zoom + parallax */
  bgZoom: number;
  bgShift: [number, number];
};

const randUnit = (rnd: () => number): Vec3 => {
  const z = rnd() * 2 - 1;
  const a = rnd() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), s * Math.sin(a), z];
};

export const buildWorld = (seed: number): Molecule[] => {
  const rnd = mulberry32(seed);
  const mols: Molecule[] = [];
  const push = (p: Vec3) => {
    mols.push({
      p0: p,
      vel: [(rnd() - 0.5) * 0.22, (rnd() - 0.5) * 0.16, (rnd() - 0.5) * 0.12],
      axis0: randUnit(rnd),
      spinAxis: randUnit(rnd),
      spin: (0.12 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1),
      phase: rnd() * Math.PI * 2,
      hero: false,
    });
  };
  // Hero molecule at the world origin.
  mols.push({
    p0: [0, 0, 0],
    vel: [0, 0, 0],
    axis0: [0, 1, 0],
    spinAxis: [0, 1, 0],
    spin: 0,
    phase: 0,
    hero: true,
  });
  // Main cloud surrounding the hero (also covers the orbit of version 2).
  let guard = 0;
  while (mols.length < 820 && guard++ < 100000) {
    const p: Vec3 = [(rnd() - 0.5) * 72, (rnd() - 0.5) * 44, -24 + Math.pow(rnd(), 1.35) * 86];
    // keep a clear pocket around the hero
    if (Math.hypot(p[0], p[1] * 1.1, p[2]) < 6.2) continue;
    // keep the final V1 sight-line in front of the camera clean
    if (p[2] < -1 && p[2] > -12 && Math.hypot(p[0] + 0.75, p[1]) < 1.6) continue;
    // no out-of-focus giants right in front of the settled V1 camera
    const rz = p[2] + 7.6;
    if (rz > -1.5 && rz < 6 && Math.abs(p[0] + 0.75) < 0.75 * Math.max(rz, 0) + 2.2 && Math.abs(p[1]) < 0.45 * Math.max(rz, 0) + 1.8) continue;
    // keep the dolly corridor clear so the approach reads like the reference
    if (p[2] < -7 && Math.hypot(p[0] + 0.75, p[1]) < 3.2) continue;
    push(p);
  }
  // Two scripted mid-ground molecules that drift in across the frame corners
  // late in the shot (as in the reference). p(t) = p0 + vel * t.
  const scripted: { start: Vec3; vel: Vec3; t0: number; axis: Vec3 }[] = [
    { start: [-0.75 + 3.75, 1.8, -1.2], vel: [-0.22, -0.03, 0], t0: 6.0, axis: norm([0.3, 1, 0.25]) },
    { start: [-0.75 - 3.9, -1.75, -1.0], vel: [0.36, 0.05, 0], t0: 10.2, axis: norm([0.6, 0.8, -0.3]) },
  ];
  for (const sc of scripted) {
    mols.push({
      p0: sub(sc.start, scale(sc.vel, sc.t0)),
      vel: sc.vel,
      axis0: sc.axis,
      spinAxis: norm([0.2, 0.1, 1]),
      spin: 0.18,
      phase: 0,
      hero: false,
      scripted: true,
    });
  }
  // Fly-through tube along the V1 dolly path (passes the lens at speed).
  for (let i = 0; i < 620; i++) {
    const z = -28 - Math.pow(rnd(), 1.25) * 380;
    const a = rnd() * Math.PI * 2;
    const r = 1.2 + Math.sqrt(rnd()) * 20;
    push([-0.75 + Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.9, z]);
  }
  return mols;
};

const T_TOTAL = 421 / 30;

/** Version 1 — fast dolly in from a white-out, settling on the hero. */
export const cameraV1 = (t: number): Camera => {
  const tau = 0.555;
  const fly = 381 * Math.exp(-t / tau);
  // keeps creeping in until ~10 s, then eases back slightly (hero size curve of the reference)
  const settle = 1.3 - 1.75 * smoothstep(2.5, 10.2, t) + 0.75 * smoothstep(10.2, 14.0, t);
  const dist = 7.75 + fly + settle;
  const speed = (381 / tau) * Math.exp(-t / tau);
  const swayX = 0.1 * Math.sin(t * 0.55 + 0.4);
  const swayY = 0.07 * Math.sin(t * 0.43 + 1.3);
  const pos: Vec3 = [-0.75 + swayX, 0.07 + swayY, -dist];
  const target: Vec3 = [pos[0] + 0.012 * Math.sin(t * 0.3), pos[1] + 0.008 * Math.sin(t * 0.37), pos[2] + 10];
  const prog = 1 - Math.exp(-t / tau);
  return {
    pos,
    target,
    roll: 0.01 * Math.sin(t * 0.35),
    // during the fly-through focus stays on the molecules streaming past
    focus: Math.min(dist, 14),
    focal: 0.95,
    zoomBlur: clamp((speed / dist) * (1 / 60) * 1.6, 0, 0.3),
    whiteout: 0.9 * (1 - smoothstep(0.0, 0.85, t)),
    bgZoom: lerp(0.72, 1.0, prog) + 0.012 * (t / T_TOTAL),
    bgShift: [-swayX * 0.02, -swayY * 0.02],
  };
};

/** Version 2 — orbital crane: low-angle arc around the hero with a pull-back reveal. */
export const cameraV2 = (t: number): Camera => {
  const u = t / T_TOTAL;
  const intro = easeOutCubic(t / 3.6);
  const dist = lerp(2.6, 9.4, intro) + 0.5 * easeInOutSine(u);
  // yaw sweeps from the right side of the hero around to its left
  const yaw = lerp(1.35, 0.42, intro) - 1.3 * easeInOutSine(clamp((t - 1.5) / (T_TOTAL - 1.5)));
  const pitch = lerp(-0.42, -0.2, intro) + 0.08 * easeInOutSine(u);
  const tgt: Vec3 = [0.55 * (1 - intro) + 0.35 * intro, 0.05, 0];
  const pos: Vec3 = [
    tgt[0] - Math.sin(yaw) * Math.cos(pitch) * dist,
    tgt[1] - Math.sin(pitch) * dist,
    tgt[2] - Math.cos(yaw) * Math.cos(pitch) * dist,
  ];
  // shift the aim a little so the hero sits on the left third at the end
  const shift = 1.55 * smoothstep(0.6, 4.5, t);
  const aim: Vec3 = [tgt[0] + Math.cos(yaw) * shift, tgt[1], tgt[2] - Math.sin(yaw) * shift];
  const speedProxy = Math.max(0, 1 - t / 2.2);
  return {
    pos,
    target: aim,
    roll: lerp(-0.12, 0.05, easeInOutSine(u)),
    focus: dist * 0.98,
    focal: 0.95,
    zoomBlur: 0.05 * speedProxy * speedProxy,
    whiteout: 0.9 * (1 - smoothstep(0.0, 0.55, t)),
    bgZoom: lerp(1.25, 1.0, intro) + 0.01 * u,
    bgShift: [Math.sin(yaw) * 0.18, pitch * 0.12],
  };
};

/** World-space positions of both atoms of a molecule at time t. */
const moleculeAtoms = (m: Molecule, t: number): [Vec3, Vec3] => {
  let center: Vec3;
  let axis: Vec3;
  if (m.hero) {
    center = [0, 0.08 * Math.sin(t * 0.62 + 0.5), 0];
    // mostly upright, gently swaying and turning
    let a: Vec3 = [0, 1, 0];
    a = rotate(a, [1, 0, 0], 0.22 + 0.12 * Math.sin(t * 0.41));
    a = rotate(a, [0, 0, 1], 0.12 * Math.sin(t * 0.47 + 0.6) - 0.03);
    axis = norm(a);
  } else {
    center = add(m.p0, scale(m.vel, t));
    if (!m.scripted) {
      center = add(center, [0.12 * Math.sin(t * 0.7 + m.phase), 0.1 * Math.sin(t * 0.55 + m.phase * 1.7), 0]);
    }
    axis = rotate(m.axis0, m.spinAxis, m.spin * t + m.phase);
  }
  const h = scale(axis, BOND / 2);
  return [add(center, h), sub(center, h)];
};

type Proj = { x: number; y: number; r: number; z: number };

type DrawItem = {
  a: Proj;
  b: Proj;
  depth: number;
  blur: number;
  alpha: number;
  hero: boolean;
};

const scratchPool: Record<string, HTMLCanvasElement> = {};
const getScratch = (name: string, w: number, h: number) => {
  let c = scratchPool[name];
  if (!c) {
    c = document.createElement("canvas");
    scratchPool[name] = c;
  }
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, Math.ceil(w));
    c.height = Math.max(c.height, Math.ceil(h));
  }
  return c;
};

const drawNeck = (ctx: CanvasRenderingContext2D, a: Proj, b: Proj, pal: Palette, hero: boolean) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const rmin = Math.min(a.r, b.r);
  if (d < 0.25 * rmin) return;
  const ux = dx / d;
  const uy = dy / d;
  // the neck is drawn behind both spheres, so it can start inside them
  const gapStart = a.r * 0.45;
  const gapEnd = d - b.r * 0.45;
  if (gapEnd <= gapStart) return;
  const uc = (a.r + (d - b.r)) / 2;
  const L = Math.max((gapEnd - gapStart) / 2, 1e-3);
  const wm = (hero ? 0.13 : 0.17) * rmin;
  const we = 0.74 * rmin;
  const N = 28;
  ctx.save();
  ctx.transform(ux, uy, -uy, ux, a.x, a.y);
  const prof = (s: number) => {
    const k = clamp(Math.abs(s - uc) / L);
    return wm + (we - wm) * Math.pow(k, 1.35);
  };
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const s = gapStart + ((gapEnd - gapStart) * i) / N;
    const w = prof(s);
    if (i === 0) ctx.moveTo(s, -w);
    else ctx.lineTo(s, -w);
  }
  for (let i = N; i >= 0; i--) {
    const s = gapStart + ((gapEnd - gapStart) * i) / N;
    ctx.lineTo(s, prof(s));
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -we, 0, we);
  g.addColorStop(0, pal.neckEdge);
  g.addColorStop(0.32, pal.neckCenter);
  g.addColorStop(0.5, pal.neckCenter);
  g.addColorStop(1, pal.neckEdge);
  ctx.fillStyle = g;
  ctx.fill();
  // metallic core where the two shells meet
  const core = ctx.createRadialGradient(uc, 0, 0, uc, 0, Math.max(L * 0.5, wm * 2.2));
  core.addColorStop(0, pal.neckCore);
  core.addColorStop(0.5, pal.neckCore.replace(/[\d.]+\)$/, "0.25)"));
  core.addColorStop(1, "rgba(80,90,100,0)");
  ctx.fillStyle = core;
  ctx.fill();
  if (hero || rmin > 18) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(0.6, 0.028 * rmin);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s = gapStart + ((gapEnd - gapStart) * i) / N;
      const w = prof(s) * 0.55;
      if (i === 0) ctx.moveTo(s, -w);
      else ctx.lineTo(s, -w);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const drawAtom = (ctx: CanvasRenderingContext2D, p: Proj, sprites: SpriteSet) => {
  const sp = pickSprite(sprites, p.r);
  const k = p.r / sp.r;
  const h = sp.half * k;
  ctx.drawImage(sp.canvas, p.x - h, p.y - h, h * 2, h * 2);
};

const drawMolecule = (ctx: CanvasRenderingContext2D, it: DrawItem, sprites: SpriteSet, pal: Palette) => {
  const [back, front] = it.a.z > it.b.z ? [it.a, it.b] : [it.b, it.a];
  // neck first: the spheres cover its ends, so there is no seam
  drawNeck(ctx, back, front, pal, it.hero);
  drawAtom(ctx, back, sprites);
  drawAtom(ctx, front, sprites);
};

/** Background: blurred hexagonal molecular lattice + soft out-of-focus blobs. */
const bgCache = new Map<string, HTMLCanvasElement>();
const getBackground = (w: number, h: number, pal: Palette, key: string) => {
  const k = `${key}:${w}x${h}`;
  const hit = bgCache.get(k);
  if (hit) return hit;
  // drawn at half resolution: it's heavily defocused anyway
  const bw = Math.ceil(w * 0.75);
  const bh = Math.ceil(h * 0.75);
  const c = document.createElement("canvas");
  c.width = bw;
  c.height = bh;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const U = bw / 1.5; // one "frame width" in bg pixels (bg covers 1.5x frame)
  const g = ctx.createLinearGradient(0, 0, 0, bh);
  g.addColorStop(0, pal.bgTop);
  g.addColorStop(0.5, pal.bgMid);
  g.addColorStop(1, pal.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, bw, bh);
  const rnd = mulberry32(77);
  // layers are drawn sharp, then blurred in a single pass each
  const layer = document.createElement("canvas");
  layer.width = bw;
  layer.height = bh;
  const lctx = layer.getContext("2d", { willReadFrequently: true })!;
  // hex lattice
  const e = 0.07 * U;
  const hx = Math.sqrt(3) * e;
  lctx.strokeStyle = pal.latticeLine;
  lctx.lineWidth = 0.0055 * U;
  lctx.lineCap = "round";
  lctx.beginPath();
  for (let row = -1; row < bh / (1.5 * e) + 2; row++) {
    for (let col = -1; col < bw / hx + 2; col++) {
      const cx = col * hx + (row % 2 ? hx / 2 : 0);
      const cy = row * 1.5 * e;
      for (let s = 0; s < 3; s++) {
        if (rnd() < 0.5) continue;
        const a0 = Math.PI / 6 + (s * Math.PI) / 3 - Math.PI / 2;
        const a1 = a0 + Math.PI / 3;
        lctx.moveTo(cx + Math.cos(a0) * e, cy + Math.sin(a0) * e);
        lctx.lineTo(cx + Math.cos(a1) * e, cy + Math.sin(a1) * e);
      }
    }
  }
  lctx.stroke();
  ctx.filter = `blur(${0.0055 * U}px)`;
  ctx.drawImage(layer, 0, 0);
  ctx.filter = "none";
  lctx.clearRect(0, 0, bw, bh);
  // out-of-focus blobs, denser in a mid band like the reference
  for (let i = 0; i < 70; i++) {
    const x = rnd() * bw;
    const band = rnd() < 0.65;
    const y = band ? bh * (0.38 + (rnd() - 0.5) * 0.3) : rnd() * bh;
    const r = (0.025 + rnd() * 0.045) * U;
    lctx.fillStyle = pal.blob;
    lctx.globalAlpha = 0.35 + rnd() * 0.45;
    lctx.beginPath();
    lctx.ellipse(x, y, r * (1.2 + rnd() * 0.8), r, 0, 0, Math.PI * 2);
    lctx.fill();
  }
  lctx.globalAlpha = 1;
  ctx.filter = `blur(${0.018 * U}px)`;
  ctx.drawImage(layer, 0, 0);
  ctx.filter = "none";
  bgCache.set(k, c);
  return c;
};

let frameCanvas: HTMLCanvasElement | null = null;
const getFrameCanvas = (w: number, h: number) => {
  if (!frameCanvas) frameCanvas = document.createElement("canvas");
  if (frameCanvas.width !== w || frameCanvas.height !== h) {
    frameCanvas.width = w;
    frameCanvas.height = h;
  }
  return frameCanvas;
};

export const renderFrame = (
  out: HTMLCanvasElement,
  t: number,
  world: Molecule[],
  cam: Camera,
  sprites: SpriteSet,
  pal: Palette,
  bgKey: string,
) => {
  const W = out.width;
  const H = out.height;
  const frame = getFrameCanvas(W, H);
  const ctx = frame.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";

  // --- background -----------------------------------------------------------
  const bg = getBackground(W, H, pal, bgKey);
  const bgW = W * 1.5 * cam.bgZoom;
  const bgH = H * 1.5 * cam.bgZoom;
  ctx.drawImage(bg, W / 2 - bgW / 2 + cam.bgShift[0] * W, H / 2 - bgH / 2 + cam.bgShift[1] * H, bgW, bgH);

  // --- camera basis ---------------------------------------------------------
  const f = norm(sub(cam.target, cam.pos));
  let right = norm(cross([0, 1, 0], f));
  let down = cross(f, right);
  right = rotate(right, f, cam.roll);
  down = rotate(down, f, cam.roll);
  const F = cam.focal * W;
  const project = (p: Vec3): Proj => {
    const d = sub(p, cam.pos);
    const z = dot(d, f);
    return {
      x: W / 2 + (F * dot(d, right)) / z,
      y: H / 2 + (F * dot(d, down)) / z,
      r: (F * ATOM_R) / z,
      z,
    };
  };

  // --- project, cull, depth of field -----------------------------------------
  const items: DrawItem[] = [];
  const zf = cam.focus;
  for (const m of world) {
    const [pa, pb] = moleculeAtoms(m, t);
    const a = project(pa);
    const b = project(pb);
    const z = (a.z + b.z) / 2;
    if (Math.min(a.z, b.z) < 0.35) continue;
    if (z > 95) continue;
    const rr = Math.max(a.r, b.r);
    const minx = Math.min(a.x, b.x) - rr * 2;
    const maxx = Math.max(a.x, b.x) + rr * 2;
    const miny = Math.min(a.y, b.y) - rr * 2;
    const maxy = Math.max(a.y, b.y) + rr * 2;
    if (maxx < 0 || minx > W || maxy < 0 || miny > H) continue;
    let coc: number;
    if (z >= zf) coc = 0.008 * W * Math.pow(1 - zf / z, 2.9);
    else coc = 0.006 * W * Math.pow(zf / z - 1, 1.3);
    if (m.hero) coc *= 0.5;
    const fog = 1 - smoothstep(30, 74, z);
    const near = smoothstep(0.35, 1.6, Math.min(a.z, b.z));
    items.push({ a, b, depth: z, blur: coc, alpha: fog * near, hero: m.hero });
  }
  items.sort((p, q) => q.depth - p.depth);

  for (const it of items) {
    if (it.alpha <= 0.003) continue;
    const blurPx = it.blur;
    if (blurPx < 0.35) {
      ctx.globalAlpha = it.alpha;
      drawMolecule(ctx, it, sprites, pal);
      continue;
    }
    // draw sharp into scratch, then composite with a true gaussian blur
    const rr = Math.max(it.a.r, it.b.r) * 1.08;
    const pad = Math.ceil(blurPx * 3 + 2);
    const bx = Math.floor(Math.min(it.a.x, it.b.x) - rr - pad);
    const by = Math.floor(Math.min(it.a.y, it.b.y) - rr - pad);
    const bw = Math.ceil(Math.max(it.a.x, it.b.x) + rr + pad) - bx;
    const bh = Math.ceil(Math.max(it.a.y, it.b.y) + rr + pad) - by;
    if (bw > W * 3 || bh > H * 3) continue;
    const sc = getScratch("sharp", bw, bh);
    const sctx = sc.getContext("2d", { willReadFrequently: true })!;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, bw, bh);
    sctx.imageSmoothingQuality = "low";
    sctx.setTransform(1, 0, 0, 1, -bx, -by);
    drawMolecule(sctx, it, sprites, pal);
    // blur inside a second, clipped scratch so the filter layer stays small
    const bc = getScratch("blur", bw, bh);
    const bctx = bc.getContext("2d", { willReadFrequently: true })!;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bw, bh);
    bctx.save();
    bctx.beginPath();
    bctx.rect(0, 0, bw, bh);
    bctx.clip();
    bctx.filter = `blur(${blurPx.toFixed(2)}px)`;
    bctx.drawImage(sc, 0, 0, bw, bh, 0, 0, bw, bh);
    bctx.restore();
    ctx.globalAlpha = it.alpha;
    ctx.drawImage(bc, 0, 0, bw, bh, bx, by, bw, bh);
  }
  ctx.globalAlpha = 1;

  // --- output: zoom blur (dolly motion blur) + white-out ----------------------
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = 1;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(frame, 0, 0);
  if (cam.zoomBlur > 0.002) {
    const N = 14;
    for (let i = 1; i < N; i++) {
      const s = 1 + (cam.zoomBlur * i) / (N - 1);
      octx.globalAlpha = 1 / (i + 1);
      octx.drawImage(frame, W / 2 - (W * s) / 2, H / 2 - (H * s) / 2, W * s, H * s);
    }
    octx.globalAlpha = 1;
  }
  if (cam.whiteout > 0.001) {
    octx.globalAlpha = cam.whiteout;
    octx.fillStyle = pal.whiteout;
    octx.fillRect(0, 0, W, H);
    octx.globalAlpha = 1;
  }
};
