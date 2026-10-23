import { mulberry32, noise1 } from "./random";
import { Palette, RGB, mix, rgba } from "./palettes";

// Camera space: x right, y down, z forward (into the screen).
// Everything is projected into 1920x1080 design units.
type V3 = [number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

export const DW = 1920;
export const DH = 1080;
const NEAR = 0.18;

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

type Rig = {
  F: number;
  roll: number;
  P0: V3;
  D: V3;
  U: V3;
  L: V3;
};

const makeRig = (t: number): Rig => {
  // Long-lens framing: the rail enters at the left edge (z~4) and leaves the
  // frame at the bottom-right corner (z~7), so arcs keep a similar size.
  const D = norm([
    2.8 + 0.08 * Math.sin(0.21 * t + 0.4),
    1.23 + 0.06 * Math.sin(0.17 * t + 1.1),
    3.2,
  ]);
  const P0: V3 = [
    -1.02 + 0.03 * Math.sin(0.13 * t),
    -0.27 + 0.025 * Math.sin(0.11 * t + 2),
    4 - 0.12 * Math.sin(0.09 * t),
  ];
  const upRef: V3 = [0.28, -1, 0.05];
  const U = norm(add(upRef, scale(D, -dot(upRef, D))));
  let L = norm(cross(D, U));
  // Lateral axis pointing from the track towards the camera.
  if (dot(L, scale(P0, -1)) < 0) L = scale(L, -1);
  return { F: DW * 2, roll: 0.01 * Math.sin(0.15 * t + 0.3), P0, D, U, L };
};

// Point on the structure: s along the track, l lateral (towards camera),
// u height (up is positive).
const at = (r: Rig, s: number, l: number, u: number): V3 =>
  add(add(add(r.P0, scale(r.D, s)), scale(r.L, l)), scale(r.U, u));

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

const fog = (z: number) => Math.exp(-z / 40);

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
  if (a[2] < NEAR || b[2] < NEAR) return;
  const z = (a[2] + b[2]) / 2;
  const ctx = f.ctxs[levelFor(z, f.camera)];
  const pa = project(r, a);
  const pb = project(r, b);
  ctx.strokeStyle = rgba(color, alpha * fog(z));
  ctx.lineWidth = Math.max(minPx, (worldWidth * r.F) / z);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
};

// Step size along the track that keeps projected segments short.
const stepAt = (r: Rig, s: number) => {
  const z = at(r, s, 0, 0)[2];
  return Math.max(0.03, z * 0.018);
};

const trackLine = (
  f: Frame,
  r: Rig,
  s0: number,
  s1: number,
  l: number,
  u: number,
  width: number,
  color: RGB,
  alpha: number,
) => {
  let s = s0;
  while (s < s1) {
    const ds = Math.min(stepAt(r, s), s1 - s);
    segment(f, r, at(r, s, l, u), at(r, s + ds, l, u), width, 0.7, color, alpha);
    s += ds;
  }
};

const plate = (
  f: Frame,
  r: Rig,
  s0: number,
  s1: number,
  l0: number,
  l1: number,
  u: number,
  color: RGB,
  alpha: number,
) => {
  let s = Math.max(s0, -3);
  while (s < s1) {
    const ds = Math.min(stepAt(r, s) * 1.5, s1 - s);
    // Plates tilt down towards the camera so their faces catch the light.
    const drop = (l1 - l0) * 0.7;
    const q = [
      at(r, s, l0, u),
      at(r, s + ds, l0, u),
      at(r, s + ds, l1, u - drop),
      at(r, s, l1, u - drop),
    ];
    if (q.every((p) => p[2] > NEAR)) {
      const z = (q[0][2] + q[2][2]) / 2;
      const ctx = f.ctxs[levelFor(z, f.camera)];
      const pts = q.map((p) => project(r, p));
      ctx.fillStyle = rgba(color, alpha * fog(z));
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
// Static layout of the "circuit" track, generated once.

type TraceRun = { s0: number; s1: number; l: number; u: number; w: number; a: number };
type Plate = { s0: number; s1: number; l0: number; l1: number; u: number; a: number };
type Jog = { s: number; l0: number; l1: number; u0: number; u1: number; a: number };

const tierL = (k: number) => 0.06 * k + 0.03 * k * k;
const tierU = (k: number) => -0.035 * k - 0.01 * k * k;

const S_START = -3;
const S_END = 14;

const buildTrack = () => {
  const rnd = mulberry32(7);
  const runs: TraceRun[] = [];
  const plates: Plate[] = [];
  const jogs: Jog[] = [];
  // Tiers step down and towards the camera like a staircase of light plates.
  const tiers = 8;
  for (let k = 0; k < tiers; k++) {
    const l = tierL(k);
    const u = tierU(k);
    let s = S_START + rnd() * 0.5;
    while (s < S_END) {
      const len = k === 0 ? S_END - S_START : 0.3 + rnd() * (1.2 + k * 0.5);
      const w = k === 0 ? 0.006 : 0.003 + rnd() * 0.004;
      const a = k === 0 ? 1 : 0.4 + rnd() * 0.55;
      runs.push({ s0: s, s1: s + len, l, u, w, a });
      if (k > 0 && rnd() < 0.75) {
        const width = 0.04 + rnd() * 0.06 + k * 0.025;
        plates.push({ s0: s, s1: s + len, l0: l, l1: l + width, u, a: 0.18 + rnd() * 0.3 });
      }
      if (k > 0 && rnd() < 0.6) {
        jogs.push({ s: s + len, l0: l, l1: tierL(k - 1), u0: u, u1: tierU(k - 1), a });
      }
      s += len + (k === 0 ? 0 : rnd() * 0.35);
    }
  }
  // Thin parallel hairlines on the top of the rail.
  for (let i = 0; i < 6; i++) {
    runs.push({ s0: S_START, s1: S_END, l: -0.006 * i - 0.006, u: 0.003 * i, w: 0.0011, a: 0.35 });
  }
  return { runs, plates, jogs };
};

type Strand = {
  l: number;
  s0: number;
  s1: number;
  lambda: number;
  amp: number;
  speed: number;
  phase: number;
  kind: "bounce" | "wave";
  seed: number;
  wobble: number;
  life: [number, number] | null; // time window for transient foreground strands
};

const buildStrands = () => {
  const rnd = mulberry32(31);
  const strands: Strand[] = [];
  for (let i = 0; i < 17; i++) {
    const lambda = 0.16 + rnd() * rnd() * 0.75;
    const s0 = S_START + rnd() * 6;
    strands.push({
      l: -0.1 + rnd() * 0.13,
      s0,
      s1: s0 + 5 + rnd() * 12,
      lambda,
      amp: lambda * (0.8 + rnd() * 1.5),
      speed: (0.04 + rnd() * 0.1) * (rnd() < 0.8 ? 1 : -1),
      phase: rnd() * 10,
      kind: rnd() < 0.75 ? "bounce" : "wave",
      seed: i * 13 + 5,
      wobble: rnd() * 0.012,
      life: null,
    });
  }
  // Large out-of-focus strands sweeping close to the lens.
  for (let i = 0; i < 10; i++) {
    const lambda = 0.5 + rnd() * 0.7;
    const start = -1 + rnd() * 18;
    strands.push({
      l: 0.5 + rnd() * 1.4,
      s0: S_START + rnd() * 3,
      s1: 3 + rnd() * 6,
      lambda,
      amp: lambda * (0.6 + rnd() * 0.8),
      speed: 0.12 + rnd() * 0.15,
      phase: rnd() * 10,
      kind: rnd() < 0.5 ? "wave" : "bounce",
      seed: 900 + i,
      wobble: 0.03,
      life: [start, start + 2.5 + rnd() * 3],
    });
  }
  return strands;
};

const TRACK = buildTrack();
const STRANDS = buildStrands();

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const drawStrand = (f: Frame, r: Rig, st: Strand) => {
  const { t, palette } = f;
  let lifeEnv = 1;
  if (st.life) {
    const [a, b] = st.life;
    lifeEnv = smooth(a, a + 0.8, t) * (1 - smooth(b - 0.8, b, t));
    if (lifeEnv <= 0.001) return;
  }
  const step = st.lambda / 46;
  let prev: V3 | null = null;
  let prevH = 0;
  for (let s = st.s0; s <= st.s1; s += step) {
    const travel = s - st.speed * t;
    const envS =
      smooth(st.s0, st.s0 + 0.8, s) *
      (1 - smooth(st.s1 - 1.5, st.s1, s)) *
      (0.2 + 0.8 * noise1(travel / 1.4 + t * 0.12, st.seed));
    let h: number;
    if (st.kind === "bounce") {
      h = Math.pow(Math.abs(Math.sin((Math.PI * travel) / st.lambda + st.phase)), 0.85);
    } else {
      h = 0.5 + 0.5 * Math.sin((2 * Math.PI * travel) / st.lambda + st.phase + 0.6 * t);
    }
    h *= st.amp * envS;
    const lat = st.l + st.wobble * Math.sin(travel * 2.1 + st.seed);
    const p = at(r, s, lat, h);
    const tip = Math.min(1, h / (st.amp + 1e-6));
    const color = mix(palette.strandLow, palette.strandHigh, tip);
    const alpha = lifeEnv * (0.35 + 0.65 * Math.min(1, envS * 1.4));
    if (prev && p[2] > NEAR && prev[2] > NEAR) {
      segment(f, r, prev, p, 0.0008, 0.6, color, alpha * 0.55);
      // Dotted particles along the trail.
      const ctx = f.ctxs[levelFor(p[2], f.camera)];
      const pp = project(r, p);
      const rad = Math.max(0.6, (0.0014 * r.F) / p[2]);
      ctx.fillStyle = rgba(mix(color, palette.railCore, tip * 0.5), alpha * fog(p[2]));
      ctx.fillRect(pp.x - rad, pp.y - rad, rad * 2, rad * 2);
    }
    // Bright "landing" spark where the arc touches the track.
    if (st.kind === "bounce" && prevH > 0 && h < prevH && h < st.amp * 0.02 && p[2] > NEAR) {
      const ctx = f.ctxs[levelFor(p[2], f.camera)];
      const pp = project(r, p);
      const rad = Math.max(1, (0.0035 * r.F) / p[2]);
      ctx.fillStyle = rgba(palette.railCore, 0.25 * fog(p[2]) * lifeEnv);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    prev = p;
    prevH = h;
  }
};

export const drawScene = (f: Frame) => {
  const r = makeRig(f.t);
  const { palette } = f;
  for (const ctx of f.ctxs) ctx.globalCompositeOperation = "lighter";

  for (const p of TRACK.plates) {
    plate(f, r, p.s0, p.s1, p.l0, p.l1, p.u, palette.rail, p.a);
  }
  for (const run of TRACK.runs) {
    const core = run.w > 0.0055;
    trackLine(f, r, run.s0, run.s1, run.l, run.u, run.w, palette.rail, Math.min(1, run.a * 1.1));
    if (core) {
      trackLine(f, r, run.s0, run.s1, run.l, run.u, run.w * 0.35, palette.railCore, 0.9);
    }
  }
  for (const j of TRACK.jogs) {
    segment(f, r, at(r, j.s, j.l0, j.u0), at(r, j.s, j.l1, j.u1), 0.003, 0.7, palette.rail, j.a * 0.45);
  }
  // Pulses of light running along the main rail.
  for (let i = 0; i < 5; i++) {
    const head = ((f.t * (0.6 + i * 0.12) + i * 3.1) % 17) - 3;
    trackLine(f, r, head, head + 0.35, -0.002, 0.001, 0.0035, palette.railCore, 0.7);
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
  g.addColorStop(0.55, rgba(mix(palette.bgDeep, palette.bgLift, 0.55), 1));
  g.addColorStop(1, rgba(palette.bgLift, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, DW, DH);

  // Out-of-frame light source in the top-right corner.
  const pulse = 1 + 0.06 * Math.sin(t * 0.9);
  const sx = DW * 0.985 + 18 * Math.sin(t * 0.13);
  const sy = -DH * 0.02;
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 900 * pulse);
  halo.addColorStop(0, rgba(palette.source, 0.55));
  halo.addColorStop(0.25, rgba(palette.source, 0.22));
  halo.addColorStop(1, rgba(palette.source, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, DW, DH);
  const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 170);
  core.addColorStop(0, rgba(mix(palette.source, [255, 255, 255], 0.5), 0.9));
  core.addColorStop(1, rgba(palette.source, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, DW, DH);
};

export const drawVignette = (ctx: CanvasRenderingContext2D) => {
  const v = ctx.createRadialGradient(DW * 0.55, DH * 0.45, DH * 0.35, DW * 0.5, DH * 0.5, DW * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, DW, DH);
};
