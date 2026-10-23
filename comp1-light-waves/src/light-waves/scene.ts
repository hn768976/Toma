import { mulberry32, noise1 } from "./random";
import { Palette, RGB, mix, rgba } from "./palettes";

// Camera space: x right, y down, z forward (into the screen).
// Everything is projected into 1920x1080 design units.
type V3 = [number, number, number];

export const DW = 1920;
export const DH = 1080;
const NEAR = 0.1;
const FAR = 16;

// Depth of field: blur radius (design px) of each layer and the resolution
// that layer is rasterised at (blurred layers can be drawn smaller).
export const BLUR_LEVELS = [0, 1.4, 3, 6, 11, 20, 34] as const;
export const LEVEL_RES = [1, 1, 0.5, 0.5, 0.25, 0.25, 0.125] as const;

export type CameraVariant = {
  focus: number; // focal distance (camera-space z)
  aperture: number; // circle-of-confusion gain
};

export type Frame = {
  ctxs: CanvasRenderingContext2D[]; // one per blur level, in design units
  t: number;
  palette: Palette;
  camera: CameraVariant;
};

// The camera flies forward through a channel of light rails. Every structure
// runs parallel to the travel axis, so it converges on a vanishing point that
// sits low and right of centre, like the reference. A structure is described
// by its lateral offset (ox, oy) from the axis and a world position s along it.
type Rig = {
  F: number;
  dx: number; // axis direction (dx, dy, 1)
  dy: number;
  cam: number; // camera position along the axis
  roll: number;
  upX: number; // screen-space lean of "up" for the arcs
};

const SPEED = 0.55; // axis units per second

const makeRig = (t: number): Rig => ({
  F: DW * 0.9,
  dx: 0.2 + 0.018 * Math.sin(0.23 * t + 0.4),
  dy: 0.2 + 0.014 * Math.sin(0.19 * t + 1.3),
  cam: SPEED * t,
  roll: 0.025 * Math.sin(0.17 * t + 0.6),
  upX: 0.14,
});

// World point -> camera space. u lifts the point "up" (arcs).
const at = (r: Rig, s: number, ox: number, oy: number, u = 0): V3 => {
  const z = s - r.cam;
  return [ox + r.dx * z + r.upX * u, oy + r.dy * z - u, z];
};

const project = (r: Rig, p: V3) => {
  const x = (r.F * p[0]) / p[2];
  const y = (r.F * p[1]) / p[2];
  const c = Math.cos(r.roll);
  const sn = Math.sin(r.roll);
  return { x: DW / 2 + x * c - y * sn, y: DH / 2 + x * sn + y * c };
};

const levelFor = (z: number, cam: CameraVariant) => {
  const coc = (cam.aperture * Math.abs(z - cam.focus)) / z;
  let best = 0;
  for (let i = 1; i < BLUR_LEVELS.length; i++) {
    if (Math.abs(BLUR_LEVELS[i] - coc) < Math.abs(BLUR_LEVELS[best] - coc)) {
      best = i;
    }
  }
  return best;
};

// Distance fade (keeps the vanishing point from blowing out) and a fade-in
// right in front of the lens so nothing pops when it passes the near plane.
const fade = (z: number) =>
  Math.exp(-z / 11) * Math.min(1, Math.max(0, (z - NEAR) / 0.25)) * Math.min(1, (FAR - z) / 3);

const segment = (
  f: Frame,
  r: Rig,
  a: V3,
  b: V3,
  worldWidth: number,
  minPx: number,
  color: RGB,
  alpha: number,
) => {
  if (a[2] < NEAR || b[2] < NEAR || a[2] > FAR) return;
  const z = (a[2] + b[2]) / 2;
  const k = alpha * fade(z);
  if (k < 0.004) return;
  const ctx = f.ctxs[levelFor(z, f.camera)];
  const pa = project(r, a);
  const pb = project(r, b);
  ctx.strokeStyle = rgba(color, k);
  ctx.lineWidth = Math.max(minPx, (worldWidth * r.F) / z);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
};

// Step along the axis that keeps projected segments short near the lens.
const stepAt = (z: number) => Math.max(0.03, Math.min(0.6, z * 0.12));

const railLine = (
  f: Frame,
  r: Rig,
  s0: number,
  s1: number,
  ox: number,
  oy: number,
  width: number,
  color: RGB,
  alpha: number,
) => {
  let s = Math.max(s0, r.cam + NEAR);
  const end = Math.min(s1, r.cam + FAR);
  while (s < end) {
    const ds = Math.min(stepAt(s - r.cam), end - s);
    segment(f, r, at(r, s, ox, oy), at(r, s + ds, ox, oy), width, 0.7, color, alpha);
    s += ds;
  }
};

// A flat glowing strip between two lateral offsets, extruded along the axis.
const plate = (
  f: Frame,
  r: Rig,
  s0: number,
  s1: number,
  a: [number, number],
  b: [number, number],
  color: RGB,
  alpha: number,
) => {
  let s = Math.max(s0, r.cam + NEAR);
  const end = Math.min(s1, r.cam + FAR);
  while (s < end) {
    const ds = Math.min(stepAt(s - r.cam) * 1.5, end - s);
    const q = [
      at(r, s, a[0], a[1]),
      at(r, s + ds, a[0], a[1]),
      at(r, s + ds, b[0], b[1]),
      at(r, s, b[0], b[1]),
    ];
    const z = (q[0][2] + q[2][2]) / 2;
    const k = alpha * fade(z);
    if (k > 0.004) {
      const ctx = f.ctxs[levelFor(z, f.camera)];
      const pts = q.map((p) => project(r, p));
      // Brighter towards the leading edge so the strip reads as a lit bevel.
      const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[3].x, pts[3].y);
      g.addColorStop(0, rgba(color, k));
      g.addColorStop(1, rgba(color, k * 0.35));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    }
    s += ds;
  }
};

// ---------------------------------------------------------------------------
// Layout, generated once. Offsets were chosen so the rails project onto the
// same rays as the reference: the main rail enters at the top-left, light
// strips fan out across the lower-left and a low rail exits bottom-right.

type Rail = { ox: number; oy: number; w: number; a: number; dash: [number, number] | null; core: boolean };
type PlateDef = { a: [number, number]; b: [number, number]; alpha: number; seg: [number, number] };
type Run = { s0: number; s1: number };

const S_MAX = 40;

const RAILS: Rail[] = [
  { ox: -0.8, oy: -0.36, w: 0.009, a: 1, dash: null, core: true }, // main rail
  { ox: -0.79, oy: -0.33, w: 0.003, a: 0.6, dash: null, core: false },
  { ox: -0.77, oy: -0.28, w: 0.004, a: 0.75, dash: [0.6, 0.25], core: false },
  { ox: -0.74, oy: -0.2, w: 0.003, a: 0.55, dash: [0.4, 0.3], core: false },
  { ox: 0.36, oy: 0.11, w: 0.004, a: 0.85, dash: null, core: true }, // low right rail
  { ox: 0.3, oy: 0.115, w: 0.0025, a: 0.5, dash: [0.5, 0.2], core: false },
  { ox: 0.45, oy: 0.1, w: 0.0025, a: 0.45, dash: [0.8, 0.35], core: false },
];

const PLATES: PlateDef[] = [
  // Lit wall under the main rail.
  { a: [-0.785, -0.32], b: [-0.76, -0.22], alpha: 0.35, seg: [4, 0.4] },
  // Floor strips fanning across the lower left.
  { a: [-0.74, -0.12], b: [-0.7, -0.06], alpha: 0.75, seg: [3, 0.6] },
  { a: [-0.7, 0.02], b: [-0.6, 0.05], alpha: 0.6, seg: [2.5, 0.9] },
  { a: [-0.52, 0.1], b: [-0.42, 0.11], alpha: 0.8, seg: [2, 1.2] },
  { a: [-0.24, 0.11], b: [-0.17, 0.11], alpha: 0.85, seg: [1.5, 1.5] },
  // A narrow strip on the right floor.
  { a: [0.12, 0.11], b: [0.18, 0.11], alpha: 0.6, seg: [1.5, 1.8] },
];

const buildRuns = (seed: number, seg: [number, number]) => {
  const rnd = mulberry32(seed);
  const runs: Run[] = [];
  let s = -1 + rnd() * seg[1];
  while (s < S_MAX) {
    const len = seg[0] * (0.4 + rnd() * 1.6);
    runs.push({ s0: s, s1: s + len });
    s += len + seg[1] * (0.3 + rnd() * 1.4);
  }
  return runs;
};

const RAIL_RUNS = RAILS.map((rail, i) =>
  rail.dash ? buildRuns(100 + i, rail.dash) : [{ s0: -1, s1: S_MAX }],
);
const PLATE_RUNS = PLATES.map((p, i) => buildRuns(300 + i, p.seg));

type Strand = {
  ox: number;
  oy: number;
  s0: number;
  s1: number;
  lambda: number;
  amp: number;
  speed: number;
  phase: number;
  kind: "bounce" | "wave";
  seed: number;
  lean: number;
};

const buildStrands = () => {
  const rnd = mulberry32(31);
  const strands: Strand[] = [];
  const add = (count: number, base: [number, number], spread: number, ampScale: number) => {
    for (let i = 0; i < count; i++) {
      const lambda = 0.18 + rnd() * rnd() * 0.7;
      const s0 = -1.5 + rnd() * (S_MAX - 8);
      const tall = rnd() < 0.18;
      strands.push({
        ox: base[0] + (rnd() - 0.5) * spread,
        oy: base[1] + (rnd() - 0.5) * spread * 0.3,
        s0,
        s1: s0 + 5 + rnd() * 8,
        lambda: tall ? lambda * 1.8 : lambda,
        amp: ampScale * lambda * (0.7 + rnd() * 1.3) * (tall ? 2.4 : 1),
        speed: 0.1 + rnd() * 0.25,
        phase: rnd() * 10,
        kind: rnd() < 0.7 ? "bounce" : "wave",
        seed: strands.length * 13 + 5,
        lean: (rnd() - 0.5) * 0.25,
      });
    }
  };
  add(34, [-0.79, -0.35], 0.06, 1.1); // on the main rail
  add(18, [0.36, 0.11], 0.12, 0.8); // on the low right rail
  return strands;
};

const STRANDS = buildStrands();

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const drawStrand = (f: Frame, r: Rig, st: Strand) => {
  const { t, palette } = f;
  const sStart = Math.max(st.s0, r.cam + NEAR);
  const sEnd = Math.min(st.s1, r.cam + FAR * 0.65);
  if (sEnd <= sStart) return;
  const step = st.lambda / 40;
  let prev: V3 | null = null;
  let i = 0;
  for (let s = sStart; s <= sEnd; s += step, i++) {
    const travel = s - st.speed * t;
    const envS =
      smooth(st.s0, st.s0 + 0.6, s) *
      (1 - smooth(st.s1 - 0.8, st.s1, s)) *
      (0.25 + 0.75 * noise1(travel / 1.2 + t * 0.15, st.seed));
    let h: number;
    if (st.kind === "bounce") {
      h = Math.pow(Math.abs(Math.sin((Math.PI * travel) / st.lambda + st.phase)), 0.8);
    } else {
      h = 0.5 + 0.5 * Math.sin((2 * Math.PI * travel) / st.lambda + st.phase + 0.8 * t);
    }
    h *= st.amp * envS;
    const p = at(r, s, st.ox + st.lean * h, st.oy, h);
    const tip = Math.min(1, h / (st.amp + 1e-6));
    const color = mix(palette.strandLow, palette.strandHigh, tip);
    const alpha = 0.45 + 0.55 * Math.min(1, envS * 1.5);
    if (prev) {
      segment(f, r, prev, p, 0.0014, 0.8, color, alpha * 0.9);
      // Fine particles riding the trail.
      if (i % 3 === 0 && p[2] > NEAR && p[2] < FAR) {
        const k = alpha * fade(p[2]);
        const ctx = f.ctxs[levelFor(p[2], f.camera)];
        const pp = project(r, p);
        const rad = Math.max(0.55, (0.0016 * r.F) / p[2]);
        ctx.fillStyle = rgba(mix(color, palette.railCore, 0.4), k);
        ctx.fillRect(pp.x - rad, pp.y - rad, rad * 2, rad * 2);
      }
    }
    prev = p;
  }
};

export const drawScene = (f: Frame) => {
  const r = makeRig(f.t);
  const { palette } = f;
  for (const ctx of f.ctxs) ctx.globalCompositeOperation = "lighter";

  PLATES.forEach((p, i) => {
    for (const run of PLATE_RUNS[i]) plate(f, r, run.s0, run.s1, p.a, p.b, palette.rail, p.alpha);
  });
  RAILS.forEach((rail, i) => {
    for (const run of RAIL_RUNS[i]) {
      railLine(f, r, run.s0, run.s1, rail.ox, rail.oy, rail.w, palette.rail, rail.a);
      if (rail.core) {
        railLine(f, r, run.s0, run.s1, rail.ox, rail.oy, rail.w * 0.35, palette.railCore, 0.85);
      }
    }
  });
  // Pulses of light racing along the main rail.
  for (let i = 0; i < 4; i++) {
    const head = r.cam + ((f.t * (1.6 + i * 0.35) + i * 3.7) % 12);
    railLine(f, r, head, head + 0.5, -0.8, -0.36, 0.008, palette.railCore, 0.6);
  }
  for (const st of STRANDS) drawStrand(f, r, st);
};

export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  t: number,
) => {
  const g = ctx.createLinearGradient(0, DH, DW, 0);
  g.addColorStop(0, rgba(palette.bgDeep, 1));
  g.addColorStop(0.6, rgba(mix(palette.bgDeep, palette.bgLift, 0.35), 1));
  g.addColorStop(1, rgba(mix(palette.bgDeep, palette.bgLift, 0.8), 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DW, DH);

  // Out-of-frame light source in the top-right corner.
  const pulse = 1 + 0.06 * Math.sin(t * 0.9);
  const sx = DW * 0.985 + 18 * Math.sin(t * 0.13);
  const sy = -DH * 0.02;
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 1100 * pulse);
  halo.addColorStop(0, rgba(palette.source, 0.6));
  halo.addColorStop(0.3, rgba(palette.source, 0.2));
  halo.addColorStop(1, rgba(palette.source, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, DW, DH);
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 200);
  core.addColorStop(0, rgba(mix(palette.source, [255, 255, 255], 0.5), 0.9));
  core.addColorStop(1, rgba(palette.source, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, DW, DH);
};

export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const v = ctx.createRadialGradient(DW * 0.6, DH * 0.5, DH * 0.35, DW * 0.5, DH * 0.5, DW * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, DW, DH);
};
