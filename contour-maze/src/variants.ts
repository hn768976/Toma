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
};

// Palette stops are keyed on the field value of each contour level:
// low values = outer terrain, ~1.0 = rim of the central island, >1.1 = core.
export const LOOKS: Record<VariantName, Look> = {
  // Version 1: the reference look - ember/orange terrain, cream rims, icy blue core.
  v1: {
    palette: [
      { pos: -0.9, color: hex("#3a0f04") },
      { pos: -0.45, color: hex("#8a2a06") },
      { pos: 0.0, color: hex("#c23a08") },
      { pos: 0.5, color: hex("#f2600c") },
      { pos: 0.95, color: hex("#ffb030") },
      { pos: 0.995, color: hex("#fff2d6") },
      { pos: 1.04, color: hex("#f2f6ff") },
      { pos: 1.14, color: hex("#a9c0ff") },
    ],
    streakColor: hex("#d8e6ff"),
    fogColor: hex("#2a0b03"),
    floorLo: 0.08,
    floorHi: 0.13,
    exposure: 1.0,
    bloomA: 0.45,
    bloomB: 0.35,
    bloomThreshold: 0.8,
  },
  // Version 2: alternative palette - deep-sea teal/cyan terrain with a hot
  // magenta/rose core and golden light streaks (complementary inversion).
  v2: {
    palette: [
      { pos: -0.9, color: hex("#020d1c") },
      { pos: -0.45, color: hex("#05324a") },
      { pos: 0.0, color: hex("#007f96") },
      { pos: 0.5, color: hex("#13c4d6") },
      { pos: 0.95, color: hex("#7ff0e4") },
      { pos: 0.995, color: hex("#f2fff9") },
      { pos: 1.04, color: hex("#ffe3f1") },
      { pos: 1.14, color: hex("#ff6fb4") },
    ],
    streakColor: hex("#ffd27a"),
    fogColor: hex("#010812"),
    floorLo: 0.08,
    floorHi: 0.13,
    exposure: 1.0,
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
  for (let i = 0; i < 46; i++) {
    out.push({
      level: Math.floor(11 + rnd() * 6), // contour level index (field value = level * 0.06), near the island
      start: -1.5 + rnd() * (total + 1.0),
      dur: 1.4 + rnd() * 1.8,
      theta0: rnd() * Math.PI * 2,
      omega: (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.6),
      halfLen: 0.07 + rnd() * 0.12,
      peak: 0.75 + rnd() * 0.25,
    });
  }
  return out;
})();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const frameParams = (frame: number, variant: VariantName): FrameParams => {
  const time = frame / FPS;
  const total = DURATION_IN_FRAMES / FPS;
  const progress = Math.min(1, Math.max(0, time / total));
  const look = LOOKS[variant];

  // Camera: slow drift + yaw while it tilts from an oblique view to a
  // steeper, more top-down view (matching the reference move).
  // Ease-out: most of the camera travel happens early, then it settles.
  const e = 1 - Math.pow(1 - progress, 3.0);
  const yaw = lerp(-1.98, -1.56, e);
  const pitch = lerp(0.86, 1.12, e);
  const dist = lerp(2.0, 2.55, e);
  const target: Vec3 = [lerp(0.0, -0.08, e), lerp(0.12, 0.08, e), 0.22];
  const camPos: Vec3 = [
    target[0] + Math.cos(yaw) * Math.cos(pitch) * dist,
    target[1] + Math.sin(yaw) * Math.cos(pitch) * dist,
    target[2] + Math.sin(pitch) * dist,
  ];

  const streaks: FrameParams["streaks"] = [];
  for (const s of STREAKS) {
    const u = (time - s.start) / s.dur;
    if (u <= 0 || u >= 1) continue;
    const env = Math.sin(Math.PI * u);
    streaks.push([s.level, s.theta0 + s.omega * (time - s.start), s.halfLen, s.peak * env]);
  }

  return {
    time,
    progress,
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
    streakCenter: [0, 0],
    exposure: look.exposure,
    bloomA: look.bloomA,
    bloomB: look.bloomB,
    bloomThreshold: look.bloomThreshold,
  };
};
