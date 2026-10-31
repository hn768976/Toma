import { clamp, fbm1, noise1, rng } from "../gl/random";
import { MAX_DISCS, MAX_GHOSTS } from "./shader";

export const ASPECT = 16 / 9;
export const CENTER: [number, number] = [ASPECT / 2, 0.5];

type V3 = [number, number, number];

export type Camera = { x: number; y: number; zoom: number; roll: number };

/** world -> screen (inverse of the mapping used for the background in the shader) */
export const project = (cam: Camera, wx: number, wy: number): [number, number] => {
  const dx = (wx - cam.x - CENTER[0]) * cam.zoom;
  const dy = (wy - cam.y - CENTER[1]) * cam.zoom;
  const c = Math.cos(cam.roll);
  const s = Math.sin(cam.roll);
  // shader: q = rot(-roll) * (p - C) / zoom + C + off  =>  p = rot(roll) * (q - C - off) * zoom + C
  // GLSL mat2(c,-s,s,c) is column-major: rot(a) * v = (c*v.x + s*v.y, -s*v.x + c*v.y)
  return [CENTER[0] + c * dx + s * dy, CENTER[1] - s * dx + c * dy];
};

type DiscSpec = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  col: V3;
  soft: number;
  depth: number; // parallax factor (1 = moves with the sun plane)
  twSpeed: number;
  twDepth: number;
  sway: number;
  seed: number;
};

/** Sun world position, matched to the reference frame. */
export const SUN_WORLD: [number, number] = [1.17, 0.27];
const REF_AXIS_LEN = Math.hypot(CENTER[0] - SUN_WORLD[0], CENTER[1] - SUN_WORLD[1]);

const WHITE: V3 = [1.05, 1.0, 0.97];
const LILAC: V3 = [0.8, 0.68, 0.86];
const GREY: V3 = [0.32, 0.3, 0.31];
const OLIVE: V3 = [0.36, 0.32, 0.05];
const DIM_OLIVE: V3 = [0.2, 0.19, 0.04];

export const buildDiscs = (seed = 2024): DiscSpec[] => {
  const R = rng(seed);
  const out: DiscSpec[] = [];
  const add = (x: number, y: number, r: number, alpha: number, col: V3, o: Partial<DiscSpec> = {}) =>
    out.push({
      x,
      y,
      r,
      alpha,
      col,
      soft: 0.5 + R() * 0.25,
      depth: 1,
      twSpeed: 0.8 + R() * 1.6,
      twDepth: 0.3 + R() * 0.4,
      sway: 0.004 + R() * 0.007,
      seed: R() * 1000,
      ...o,
    });

  // leaf-gap highlights around the sun (they merge into the blown-out mass)
  add(0.856, 0.116, 0.05, 0.75, WHITE);
  add(0.97, 0.07, 0.048, 0.9, WHITE);
  add(1.09, 0.03, 0.05, 0.9, WHITE);
  add(0.637, 0.093, 0.042, 0.35, WHITE);
  add(0.78, 0.04, 0.035, 0.3, WHITE);
  for (let i = 0; i < 7; i++) {
    const a = R() * Math.PI * 2;
    const d = 0.14 + R() * 0.12;
    add(SUN_WORLD[0] + Math.cos(a) * d * 1.15, SUN_WORLD[1] + Math.sin(a) * d * 0.9, 0.035 + R() * 0.04, 0.35 + R() * 0.4, WHITE, {
      twDepth: 0.3 + R() * 0.4,
    });
  }
  // pale lilac leaf highlights down the right edge
  add(1.62, 0.13, 0.11, 1.0, LILAC, { soft: 0.3 });
  add(1.66, 0.3, 0.1, 0.7, LILAC, { soft: 0.32 });
  add(1.58, 0.21, 0.08, 0.8, WHITE, { soft: 0.3 });
  add(1.56, 0.06, 0.06, 0.9, WHITE, { soft: 0.3 });
  add(1.6, 0.28, 0.07, 0.6, LILAC);
  add(1.7, 0.2, 0.06, 0.5, LILAC);
  add(1.67, 0.44, 0.06, 0.45, LILAC);
  add(1.74, 0.36, 0.05, 0.4, LILAC);
  add(1.736, 0.856, 0.065, 0.75, WHITE, { depth: 1.12 });
  add(1.72, 0.97, 0.05, 0.5, WHITE, { depth: 1.12 });
  add(1.63, 0.625, 0.04, 0.35, GREY, { depth: 1.1 });
  // small grey-white bokeh in the lower middle
  const dots: [number, number, number, number][] = [
    [1.25, 0.65, 0.036, 0.6],
    [1.19, 0.76, 0.03, 0.45],
    [1.354, 0.81, 0.033, 0.5],
    [1.26, 0.926, 0.034, 0.55],
    [0.97, 0.75, 0.03, 0.3],
    [1.4, 0.58, 0.028, 0.35],
    [0.69, 0.29, 0.03, 0.25],
    [1.06, 0.62, 0.026, 0.3],
  ];
  for (const [x, y, r, a] of dots) add(x, y, r, a, GREY, { depth: 1.1 });
  // olive-yellow out-of-focus leaves (lower right & top left)
  add(1.574, 0.718, 0.035, 0.6, OLIVE, { depth: 1.12 });
  add(1.62, 0.914, 0.04, 0.6, OLIVE, { depth: 1.12 });
  add(1.5, 0.82, 0.03, 0.45, OLIVE, { depth: 1.12 });
  add(0.35, 0.05, 0.06, 0.7, DIM_OLIVE, { depth: 0.95 });
  add(0.53, 0.14, 0.05, 0.6, DIM_OLIVE, { depth: 0.95 });
  add(0.18, 0.12, 0.05, 0.5, DIM_OLIVE, { depth: 0.95 });
  add(0.42, 0.2, 0.07, 0.4, DIM_OLIVE, { depth: 0.95 });
  add(0.08, 0.3, 0.07, 0.35, DIM_OLIVE, { depth: 0.95 });
  // canopy beyond the reference framing (revealed only by the V2 camera move)
  add(1.9, 0.08, 0.08, 0.7, LILAC);
  add(1.98, 0.24, 0.07, 0.6, WHITE);
  add(2.08, 0.12, 0.06, 0.55, LILAC);
  add(1.88, 0.5, 0.06, 0.45, LILAC);
  add(2.1, 0.42, 0.05, 0.4, WHITE);
  add(2.0, 0.75, 0.04, 0.4, GREY, { depth: 1.1 });
  add(1.9, 0.92, 0.035, 0.45, OLIVE, { depth: 1.12 });
  add(-0.12, 0.2, 0.06, 0.55, DIM_OLIVE, { depth: 0.95 });
  add(0.02, 0.4, 0.05, 0.45, DIM_OLIVE, { depth: 0.95 });
  // faint scattered field
  while (out.length < MAX_DISCS - 12) {
    const x = 0.75 + R() * 1.0;
    const y = 0.45 + R() * 0.55;
    add(x, y, 0.022 + R() * 0.024, 0.08 + R() * 0.14, R() < 0.65 ? GREY : OLIVE, { depth: 1.1 });
  }
  return out;
};

type GhostSpec = {
  k: number; // position along the optical axis (0 = centre, 1 = mirrored sun)
  off: [number, number];
  r: number;
  intensity: number;
  col: V3;
  type: 0 | 1 | 2 | 3;
  shape: [number, number, number, number];
};

// Calibrated so that with the reference sun position the ghosts land where
// they are in the reference; they move along the optical axis if the sun moves.
export const GHOSTS: GhostSpec[] = [
  // lavender disc just left of centre
  { k: 0.363, off: [0, -0.027], r: 0.094, intensity: 1, col: [0.3, 0.2, 0.55], type: 0, shape: [1, 1, 0, 0.42] },
  // red-orange arc fragment beside it
  { k: 0.5, off: [-0.03, -0.05], r: 0.05, intensity: 1.0, col: [0.36, 0.06, 0.05], type: 2, shape: [0.6, 1.9, 0.55, 0] },
  // small bright hexagonal ghost
  { k: 1.31, off: [0, -0.072], r: 0.04, intensity: 1, col: [0.3, 0.42, 0.34], type: 1, shape: [0.75, 1.25, 0.2, 0.6] },
  // large violet ghost lower left
  { k: 2.217, off: [0, -0.188], r: 0.15, intensity: 1, col: [0.24, 0.13, 0.58], type: 0, shape: [1, 1, 0, 0.5] },
  // tiny peach dot inside it
  { k: 1.85, off: [0, -0.15], r: 0.016, intensity: 1, col: [0.35, 0.22, 0.13], type: 2, shape: [1, 1, 0, 0] },
  // faint large halo ring
  { k: 0.8, off: [0, -0.04], r: 0.34, intensity: 1, col: [0.012, 0.009, 0.02], type: 3, shape: [1, 1, 0, 0.12] },
  // soft purple wash around the big ghost
  { k: 2.1, off: [0, -0.17], r: 0.36, intensity: 1, col: [0.06, 0.035, 0.13], type: 2, shape: [1.2, 1, 0, 0] },
];

export type SceneState = {
  cam: Camera;
  sunScreen: [number, number];
  sunPow: number;
  discPos: Float32Array;
  discCol: Float32Array;
  ghost: Float32Array;
  ghostCol: Float32Array;
  ghostShape: Float32Array;
  rayRot: number;
};

export const computeScene = (discs: DiscSpec[], cam: Camera, time: number): SceneState => {
  const sunPow = 1 + 0.06 * fbm1(time * 0.35, 3) + 0.025 * fbm1(time * 1.3, 4);
  const sunScreen = project(cam, SUN_WORLD[0], SUN_WORLD[1]);

  const discPos = new Float32Array(MAX_DISCS * 4);
  const discCol = new Float32Array(MAX_DISCS * 4);
  discs.forEach((d, i) => {
    // parallax: elements nearer the lens (depth > 1) shift slightly more with the camera
    const pc: Camera = { ...cam, x: cam.x * d.depth, y: cam.y * d.depth };
    const sx = fbm1(time * 0.8 + d.seed, 1) * d.sway;
    const sy = fbm1(time * 0.7 + d.seed, 2) * d.sway;
    const [px, py] = project(pc, d.x + sx, d.y + sy);
    const tw = 0.5 + 0.5 * noise1(time * d.twSpeed + d.seed, 7);
    const a = d.alpha * (1 - d.twDepth + d.twDepth * tw);
    discPos.set([px, py, d.r * cam.zoom, a], i * 4);
    discCol.set([d.col[0], d.col[1], d.col[2], d.soft], i * 4);
  });

  const ghost = new Float32Array(MAX_GHOSTS * 4);
  const ghostCol = new Float32Array(MAX_GHOSTS * 4);
  const ghostShape = new Float32Array(MAX_GHOSTS * 4);
  const ax = CENTER[0] - sunScreen[0];
  const ay = CENTER[1] - sunScreen[1];
  // ghosts dim slightly as the sun nears the frame centre (less internal reflection)
  const sunDist = Math.hypot(ax, ay);
  const ghostGain = clamp(0.55 + 1.3 * sunDist, 0.6, 1.15);
  // calibration offsets scale with the axis length so ghosts converge on the
  // centre as the sun approaches it (identity for the reference framing)
  const offScale = sunDist / REF_AXIS_LEN;
  GHOSTS.forEach((g, i) => {
    const flick = 0.9 + 0.1 * fbm1(time * 0.8 + i * 3.3, 11);
    ghost.set(
      [CENTER[0] + ax * g.k + g.off[0] * offScale, CENTER[1] + ay * g.k + g.off[1] * offScale, g.r * cam.zoom, g.intensity * flick * ghostGain],
      i * 4,
    );
    ghostCol.set([g.col[0], g.col[1], g.col[2], g.type], i * 4);
    ghostShape.set(g.shape, i * 4);
  });

  const rayRot = 0.04 * fbm1(time * 0.2, 17) + cam.roll;
  return { cam, sunScreen, sunPow, discPos, discCol, ghost, ghostCol, ghostShape, rayRot };
};

/** Version 1: locked-off tripod, matching the reference. */
export const staticCamera = (): Camera => ({ x: 0, y: 0, zoom: 1, roll: 0 });

/**
 * Version 2: a slow, eased pan with a gentle push-in and roll. The sun enters
 * from the upper right and drifts across the top of frame to the left of
 * centre, so the flare ghosts sweep across the frame along the optical axis
 * (they always mirror the sun through the frame centre, like a real lens).
 */
export const movingCamera = (time: number, duration: number): Camera => {
  const u = clamp(time / duration);
  const e = u * u * (3 - 2 * u); // smoothstep ease-in-out
  const handheld = (s: number, a: number) => fbm1(time * 0.45, s) * a;
  return {
    x: -0.28 + 0.71 * e + handheld(61, 0.006),
    y: 0.09 - 0.141 * e + handheld(62, 0.005),
    zoom: 1.0 + 0.12 * e,
    roll: (-3 + 6 * e) * (Math.PI / 180) + handheld(63, 0.002),
  };
};
