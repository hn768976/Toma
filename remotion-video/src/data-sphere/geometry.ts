import { mulberry32 } from "../particle-ring/random";
import {
  DOT_COUNT,
  STRAND_COUNT,
  STRAND_POINTS,
  TANGLE_IN_END,
  TANGLE_IN_START,
  TANGLE_OUT_END,
  TANGLE_OUT_START,
} from "./constants";

// Everything here is a pure function of a fixed seed, so every frame (and
// every render worker) sees the identical sphere.

export type Strand = {
  // Unit-sphere samples, packed xyz.
  points: Float32Array;
  // Per-point radial offset (fraction of radius) so strands sit on a
  // slightly lumpy shell instead of a perfect ball.
  radial: Float32Array;
  minLen: number; // visible samples in the dotted phase
  maxLen: number; // visible samples in the tangle phase
  driftSpeed: number; // rad / s of the visible window sliding along the strand
  driftPhase: number;
  wobblePhase: number;
  brightness: number;
};

export type Dot = {
  x: number;
  y: number;
  z: number;
  radius: number; // design px
  flickerPhase: number;
  flickerSpeed: number;
  brightness: number;
};

const randomUnitVector = (rand: () => number): [number, number, number] => {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
};

const normalize = (v: [number, number, number]) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= l;
  v[1] /= l;
  v[2] /= l;
  return v;
};

const cross = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// A strand is a smooth random walk across the sphere surface: a heading
// tangent to the sphere whose turn rate itself wanders, giving the loose
// looping "ball of yarn" curves seen in the reference.
const generateStrand = (seed: number): Strand => {
  const rand = mulberry32(seed);
  const p = randomUnitVector(rand);
  let d = normalize(cross(p, randomUnitVector(rand)));
  const step = 0.038 + rand() * 0.02;
  let turn = (rand() - 0.5) * 0.2;
  const bulge = rand() < 0.25 ? 0.06 + rand() * 0.09 : rand() * 0.04;
  const bulgeFreq = 0.02 + rand() * 0.05;
  const bulgePhase = rand() * Math.PI * 2;

  const points = new Float32Array(STRAND_POINTS * 3);
  const radial = new Float32Array(STRAND_POINTS);
  for (let i = 0; i < STRAND_POINTS; i++) {
    points[i * 3] = p[0];
    points[i * 3 + 1] = p[1];
    points[i * 3 + 2] = p[2];
    radial[i] = bulge * Math.sin(i * bulgeFreq * Math.PI + bulgePhase);

    // Wander the curvature, then rotate heading around the normal (p).
    turn += (rand() - 0.5) * 0.06;
    turn = Math.max(-0.22, Math.min(0.22, turn));
    const side = cross(p, d);
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    d = [d[0] * c + side[0] * s, d[1] * c + side[1] * s, d[2] * c + side[2] * s];

    p[0] += d[0] * step;
    p[1] += d[1] * step;
    p[2] += d[2] * step;
    normalize(p);
    // Re-project heading onto the new tangent plane.
    const dot = d[0] * p[0] + d[1] * p[1] + d[2] * p[2];
    d = normalize([d[0] - dot * p[0], d[1] - dot * p[1], d[2] - dot * p[2]]);
  }

  return {
    points,
    radial,
    minLen: 5 + Math.floor(rand() * 12),
    maxLen: 30 + Math.floor(Math.pow(rand(), 1.6) * (STRAND_POINTS - 35)),
    driftSpeed: (0.25 + rand() * 0.5) * (rand() < 0.5 ? -1 : 1),
    driftPhase: rand() * Math.PI * 2,
    wobblePhase: rand() * Math.PI * 2,
    brightness: 0.55 + rand() * 0.45,
  };
};

export const generateStrands = (): Strand[] =>
  Array.from({ length: STRAND_COUNT }, (_, i) => generateStrand(1009 + i * 7919));

export const generateDots = (): Dot[] => {
  const rand = mulberry32(424242);
  return Array.from({ length: DOT_COUNT }, () => {
    const [x, y, z] = randomUnitVector(rand);
    const r = 1 + (rand() - 0.5) * 0.06;
    return {
      x: x * r,
      y: y * r,
      z: z * r,
      radius: 0.7 + Math.pow(rand(), 3) * 1.6,
      flickerPhase: rand() * Math.PI * 2,
      flickerSpeed: 1.5 + rand() * 5,
      brightness: 0.45 + rand() * 0.55,
    };
  });
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 0 = dotted sphere, 1 = full tangle. t in seconds.
export const tangleAmount = (t: number) =>
  smoothstep(TANGLE_IN_START, TANGLE_IN_END, t) *
  (1 - smoothstep(TANGLE_OUT_START, TANGLE_OUT_END, t));
