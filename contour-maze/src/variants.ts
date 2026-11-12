import type { FrameParams, Vec3 } from "./gl/renderer";

// Shot length matches the reference clip: 400 frames (reference: 400 frames @ 29.97).
export const FPS = 30;
export const DURATION_IN_FRAMES = 400;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type VariantName = "v1" | "v2";

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const hex = (h: string): Vec3 => {
  const n = parseInt(h.replace("#", ""), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
};

type Look = {
  palette: { pos: number; color: Vec3 }[];
  streakColor: Vec3;
  fogColor: Vec3;
  floorLo: number;
  floorHi: number;
  exposure: number;
  bloomA: number;
  bloomB: number;
  bloomThreshold: number;
  hazeColor: Vec3;
};

// Palette stops are keyed on the field value of each contour level:
// low values = outer terrain, ~1.0 = rim of the central island, >1.1 = core.
export const LOOKS: Record<VariantName, Look> = {
  // Version 1: the reference look - ember/orange terrain, cream rims, icy blue core.
  v1: {
    palette: [
      { pos: -0.6, color: hex("#3a0f04") },
      { pos: 0.2, color: hex("#7e300d") },
      { pos: 0.62, color: hex("#d85a0e") },
      { pos: 0.88, color: hex("#f57a12") },
      { pos: 0.965, color: hex("#ffb020") },
      { pos: 1.0, color: hex("#fff2d6") },
      { pos: 1.03, color: hex("#e6eeff") },
      { pos: 1.09, color: hex("#a9c0ff") },
    ],
    streakColor: hex("#a8c8ff"),
    hazeColor: hex("#ff9a2a"),
    fogColor: hex("#2a0b03"),
    floorLo: 0.08,
    floorHi: 0.62,
    exposure: 1.15,
    bloomA: 0.45,
    bloomB: 0.35,
    bloomThreshold: 0.8,
  },
  // Version 2: alternative palette - deep-sea teal/cyan terrain with a hot
  // magenta/rose core and golden light streaks (complementary inversion).
  v2: {
    palette: [
      { pos: -0.6, color: hex("#020d1c") },
      { pos: 0.2, color: hex("#05324a") },
      { pos: 0.62, color: hex("#007f96") },
      { pos: 0.88, color: hex("#13c4d6") },
      { pos: 0.965, color: hex("#7ff0e4") },
      { pos: 1.0, color: hex("#f2fff9") },
      { pos: 1.03, color: hex("#ffe3f1") },
      { pos: 1.09, color: hex("#ff6fb4") },
    ],
    streakColor: hex("#ffd27a"),
    hazeColor: hex("#2ad6e0"),
    fogColor: hex("#010812"),
    floorLo: 0.08,
    floorHi: 0.62,
    exposure: 1.15,
    bloomA: 0.45,
    bloomB: 0.35,
    bloomThreshold: 0.8,
  },
};

// Deterministic PRNG so every render is identical.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Streak = {
  level: number;
  start: number;
  dur: number;
  theta0: number;
  omega: number;
  halfLen: number;
  peak: number;
};

// Light pulses that run along individual contour walls.
const STREAKS: Streak[] = (() => {
  const rnd = mulberry32(1297594969);
  const out: Streak[] = [];
  const total = DURATION_IN_FRAMES / FPS;
  for (let i = 0; i < 24; i++) {
    out.push({
      level: Math.floor(12 + rnd() * 5), // contour level index (field value = level * 0.06), walls hugging the core
      start: -1.5 + rnd() * (total + 1.0),
      dur: 2.0 + rnd() * 1.6,
      theta0: rnd() * Math.PI * 2,
      omega: (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.5),
      halfLen: 0.12 + rnd() * 0.18,
      peak: 0.8 + rnd() * 0.2,
    });
  }
  return out;
})();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Core ribbon key shapes in ground coordinates (x -> screen right, y -> away
// from camera), [x, y, half-width]. It starts as a compact curled blob and
// unrolls into a hook: a tall arm on the left that sweeps down and right
// into a wide body whose end curls back up.
const CORE_START: Vec3[] = [
  [-0.5, 0.42, 0.22],
  [-0.6, 0.18, 0.28],
  [-0.48, -0.08, 0.33],
  [-0.22, -0.16, 0.35],
  [0.02, -0.06, 0.32],
  [0.06, 0.16, 0.27],
  [-0.06, 0.3, 0.24],
  [-0.2, 0.38, 0.2],
];
const CORE_END: Vec3[] = [
  [-0.86, 1.05, 0.13],
  [-0.76, 0.5, 0.16],
  [-0.56, 0.02, 0.24],
  [-0.18, -0.3, 0.3],
  [0.24, -0.56, 0.27],
  [0.66, -0.66, 0.18],
  [0.86, -0.36, 0.13],
  [0.66, -0.12, 0.1],
];

// Catmull-Rom through the key points -> dense polyline for the shader.
const catmull = (pts: Vec3[], sub: number): Vec3[] => {
  const out: Vec3[] = [];
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let j = 0; j < sub; j++) {
      const t = j / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      const v = [0, 1, 2].map(
        (k) =>
          0.5 *
          (2 * p1[k] +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
      );
      out.push([v[0], v[1], v[2]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const corePath = (morph: number, time: number): Vec3[] => {
  const keys = CORE_START.map((a, i): Vec3 => {
    const b = CORE_END[i];
    // Small independent wobble keeps the core alive once it has unrolled.
    const wx = 0.025 * Math.sin(time * 0.55 + i * 1.7);
    const wy = 0.025 * Math.sin(time * 0.47 + i * 2.3 + 1.0);
    return [lerp(a[0], b[0], morph) + wx, lerp(a[1], b[1], morph) + wy, lerp(a[2], b[2], morph)];
  });
  return catmull(keys, 5);
};

export const frameParams = (frame: number, variant: VariantName): FrameParams => {
  const time = frame / FPS;
  const total = DURATION_IN_FRAMES / FPS;
  const progress = Math.min(1, Math.max(0, time / total));
  const look = LOOKS[variant];
  // The core unrolls with an ease-in-out and has its hook shape by ~frame 170.
  const m = Math.min(1, frame / 170);
  const morph = m * m * (3 - 2 * m);

  // Camera: slow push and a gentle tilt towards a steeper view, easing out.
  const e = 1 - Math.pow(1 - progress, 2.0);
  const yaw = lerp(-1.66, -1.56, e);
  const pitch = lerp(0.92, 1.08, e);
  const dist = lerp(3.4, 3.15, e);
  const target: Vec3 = [lerp(0.02, 0.08, e), lerp(0.05, 0.0, e), 0.15];
  const camPos: Vec3 = [
    target[0] + Math.cos(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[2] + Math.sin(pitch) * dist,
  ];

  const path = corePath(morph, time);
  // Spirals sit in the widest part of the core.
  const sp1 = path[Math.round(path.length * 0.42)];
  const sp2 = path[Math.round(path.length * 0.62)];
  const spirals: Vec3[] = [
    [sp1[0], sp1[1], 1.0],
    [sp2[0], sp2[1], 0.8 * morph],
  ];
  const cx = path.reduce((a, v) => a + v[0], 0) / path.length;
  const cy = path.reduce((a, v) => a + v[1], 0) / path.length;

  const streaks: FrameParams["streaks"] = [];
  for (const s of STREAKS) {
    const u = (time - s.start) / s.dur;
    if (u <= 0 || u >= 1) continue;
    const env = Math.sin(Math.PI * u);
    streaks.push([s.level, s.theta0 + s.omega * (time - s.start), s.halfLen, s.peak * env]);
  }

  return {
    time,
    progress: morph,
    camPos,
    camTarget: target,
    fovDeg: 40,
    palette: look.palette,
    streakColor: look.streakColor,
    fogColor: look.fogColor,
    fogStart: dist + 0.5,
    floorLo: look.floorLo,
    floorHi: look.floorHi,
    streaks,
    streakCenter: [cx, cy],
    exposure: look.exposure * lerp(1.0, 1.15, e),
    bloomA: look.bloomA * lerp(0.9, 1.3, e),
    bloomB: look.bloomB * lerp(0.9, 1.4, e),
    bloomThreshold: look.bloomThreshold,
    path,
    spirals,
    hazeColor: look.hazeColor,
    haze: lerp(0.18, 0.6, e),
  };
};
