import { gauss, mulberry32 } from "../../lib/random";

// Seeded particle tables for the Particle Heart, built once at module load.
// Positions are in a 1280 x 720 design space (y down); heart targets are in
// heart-curve units (x = 16 sin^3 t, y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t),
// centred on the curve's bounding box, y up.

export const GLITTER = 120_000;
export const AMBIENT_FRACTION = 0.12;
export const HEARTS = 300;
export const HEART_STAYERS = 40;

/** Lower-left point the burst comes from (design px). */
export const ORIGIN = { x: 300, y: 590 };

// ---------------------------------------------------------------- heart shape

const CURVE_N = 1440;
export const heartCurve = (t: number) => ({
  x: 16 * Math.pow(Math.sin(t), 3),
  y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
});
const curve = Array.from({ length: CURVE_N }, (_, i) => heartCurve((i / CURVE_N) * Math.PI * 2));
let yMin = Infinity;
let yMax = -Infinity;
for (const p of curve) {
  yMin = Math.min(yMin, p.y);
  yMax = Math.max(yMax, p.y);
}
/** Curve height in heart units, and the bbox centre offset. */
export const HEART_UNITS_H = yMax - yMin;
const yMid = (yMax + yMin) / 2;

/** Outline crossings of the horizontal line at height y (bbox-centred units), sorted. */
const crossings = (y: number) => {
  const xs: number[] = [];
  for (let i = 0, j = CURVE_N - 1; i < CURVE_N; j = i++) {
    const yi = curve[i].y - yMid;
    const yj = curve[j].y - yMid;
    if (yi > y !== yj > y) xs.push(curve[i].x + ((curve[j].x - curve[i].x) * (y - yi)) / (yj - yi));
  }
  return xs.sort((a, b) => a - b);
};
const insideRow = (xs: number[], x: number) => {
  let c = false;
  for (const v of xs) if (x > v) c = !c;
  return c;
};

/** Distance (heart units) from a point to the outline, sampled. */
const edgeDist = (x: number, y: number) => {
  let d = Infinity;
  for (let i = 0; i < CURVE_N; i += 8) d = Math.min(d, Math.hypot(curve[i].x - x, curve[i].y - yMid - y));
  return d;
};

// ---------------------------------------------------------------- glitter

export interface GlitterData {
  count: number;
  target: Float32Array; // vec2 heart units
  burst: Float32Array; // vec2 design px
  time: Float32Array; // vec4: launch, burst duration, gather start, gather duration
  misc: Float32Array; // vec4: size px@720, tone 0..2, swirl angle, kind (0 heart, 1 dust)
  misc2: Float32Array; // vec4: near (0..1), curl, drift angle, edge (0..1)
}

const buildGlitter = (): GlitterData => {
  const rng = mulberry32(0x4ea27);
  const count = GLITTER;
  const nHeart = Math.round(count * (1 - AMBIENT_FRACTION));

  // jittered grid inside the heart, rows aligned (a woven glitter texture)
  const pts: { x: number; y: number }[] = [];
  // columns spaced wider than rows: vertical glitter streaks with dark gaps
  const colStep = 0.22;
  const rowStep = 0.0233;
  const spacing = colStep;
  for (let y = -HEART_UNITS_H / 2; y <= HEART_UNITS_H / 2; y += rowStep) {
    const xs = crossings(y);
    for (let x = -16.5; x <= 16.5; x += colStep) {
      const jx = x + (rng() - 0.5) * colStep * 0.45;
      const jy = y + (rng() - 0.5) * rowStep * 0.8;
      if (insideRow(xs, jx)) pts.push({ x: jx, y: jy });
    }
  }
  // shuffle deterministically
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }

  const target = new Float32Array(count * 2);
  const burst = new Float32Array(count * 2);
  const time = new Float32Array(count * 4);
  const misc = new Float32Array(count * 4);
  const misc2 = new Float32Array(count * 4);
  const rMax = 17;
  for (let i = 0; i < count; i++) {
    const heart = i < nHeart;
    const p = pts[i % pts.length];
    // reuse of grid points (if any) gets a small offset so no two coincide
    const reuse = Math.floor(i / pts.length);
    const tx = p.x + (reuse ? (rng() - 0.5) * spacing : 0);
    const ty = p.y + (reuse ? (rng() - 0.5) * spacing : 0);
    target[i * 2] = tx;
    target[i * 2 + 1] = ty;

    // burst destination: up and across the frame, spreading wide
    const bx = 690 + gauss(rng) * 360;
    const by = 330 + gauss(rng) * 200;
    burst[i * 2] = bx;
    burst[i * 2 + 1] = by;

    const r = Math.min(1, Math.hypot(tx, ty) / rMax);
    const launch = 1.0 + 0.95 * Math.pow(rng(), 1.6);
    const dur = 1.4 + 0.9 * rng();
    const gStart = 3.35 + 0.95 * r + 0.25 * rng();
    const gDur = 0.85 + 0.35 * rng();
    time.set([launch, dur, gStart, gDur], i * 4);

    const tone = rng() < 0.7 ? 0 : rng() < 0.85 ? 1 : 2;
    const size = 1 + rng() * rng() * 1.1;
    const swirl = (0.9 + rng() * 1.6) * (rng() < 0.85 ? 1 : -1);
    misc.set([size, tone, swirl, heart ? 0 : 1], i * 4);

    const near = rng() < 0.12 ? 0.3 + 0.7 * rng() : 0;
    const edge = heart ? Math.max(0, 1 - edgeDist(tx, ty) / 1.2) : 0;
    misc2.set([near, (rng() - 0.5) * 0.5, rng() * Math.PI * 2, edge], i * 4);
  }
  return { count, target, burst, time, misc, misc2 };
};

// ---------------------------------------------------------------- tiny hearts

export interface HeartSpriteData {
  count: number;
  target: Float32Array; // vec2: heart units (gatherers) or orbit (radius factor, angle) for stayers
  burst: Float32Array; // vec2 design px
  time: Float32Array; // vec4 launch, dur, gather start, gather dur
  misc: Float32Array; // vec4 size px@720, blur level 0..3, rotation, kind (0 gather, 1 stay)
  misc2: Float32Array; // vec4 brightness, orbit speed, bob phase, unused
}

const buildHearts = (glitter: GlitterData): HeartSpriteData => {
  const rng = mulberry32(0x7ea47);
  const count = HEARTS;
  const target = new Float32Array(count * 2);
  const burst = new Float32Array(count * 2);
  const time = new Float32Array(count * 4);
  const misc = new Float32Array(count * 4);
  const misc2 = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const stay = i < HEART_STAYERS;
    if (stay) {
      target[i * 2] = 1.15 + rng() * rng() * 2.6; // orbit radius, in heart half-heights
      target[i * 2 + 1] = rng() * Math.PI * 2;
    } else {
      const g = Math.floor(rng() * glitter.count * (1 - AMBIENT_FRACTION));
      target[i * 2] = glitter.target[g * 2];
      target[i * 2 + 1] = glitter.target[g * 2 + 1];
    }
    burst[i * 2] = 690 + gauss(rng) * 400;
    burst[i * 2 + 1] = 330 + gauss(rng) * 230;
    const launch = 1.05 + 0.9 * Math.pow(rng(), 1.4);
    time.set([launch, 1.5 + 0.9 * rng(), 3.4 + 1.1 * rng(), 1.0 + 0.5 * rng()], i * 4);
    const big = rng() < 0.12;
    const size = big ? 18 + rng() * 10 : 6 + rng() * rng() * 14;
    const blur = big ? 2 + Math.floor(rng() * 2) : rng() < 0.35 ? 1 : 0;
    misc.set([size, blur, (rng() - 0.5) * 0.8, stay ? 1 : 0], i * 4);
    misc2.set([0.6 + 0.4 * rng(), (0.05 + rng() * 0.06) * (rng() < 0.5 ? 1 : -1), rng() * Math.PI * 2, 0], i * 4);
  }
  return { count, target, burst, time, misc, misc2 };
};

let cache: { glitter: GlitterData; hearts: HeartSpriteData } | null = null;
export const getHeartData = () => {
  if (!cache) {
    const glitter = buildGlitter();
    cache = { glitter, hearts: buildHearts(glitter) };
  }
  return cache;
};

/** Heart outline path (for the sprite atlas), unit-scaled to fit a box. */
export const heartPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
  const s = size / Math.max(32, HEART_UNITS_H);
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const p = heartCurve((i / 200) * Math.PI * 2);
    const x = cx + p.x * s;
    const y = cy - (p.y - yMid) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};
