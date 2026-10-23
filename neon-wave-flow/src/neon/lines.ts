import { mulberry32, range, Rng } from "./random";

// World layout: the light track runs along +X at y = 0, spanning z ≈ ±1.
// Wave filaments rise from the track as bouncing arcs and looping springs.

export type LineDef = {
  n: number;
  // Out-of-focus light bars under the track, framed by the low tracking
  // shot only.
  foreground?: boolean;
  width: number;
  intensity: number;
  color: [number, number, number];
  // Writes n xyz points into out starting at offset*3.
  fill: (out: Float32Array, offset: number, t: number, camX: number) => void;
};

const BLUES: [number, number, number][] = [
  [0.2, 0.48, 1.0],
  [0.28, 0.62, 1.0],
  [0.14, 0.34, 1.0],
  [0.36, 0.72, 1.0],
];

const pickBlue = (rng: Rng) => BLUES[Math.floor(rng() * BLUES.length)];

// Window of the track that is ever on screen, relative to the camera.
const BEHIND = 10;
const AHEAD = 140;

const straight = (
  n: number,
  y: number,
  z: number,
  ahead = AHEAD,
): LineDef["fill"] => (out, offset, _t, camX) => {
  const x0 = camX - BEHIND;
  const span = BEHIND + ahead;
  for (let i = 0; i < n; i++) {
    const o = (offset + i) * 3;
    out[o] = x0 + (span * i) / (n - 1);
    out[o + 1] = y;
    out[o + 2] = z;
  }
};

// A short segment sliding along the track inside a world-fixed window. It
// travels exactly `laps` window lengths per clip, so the clip loops; it
// grows from / shrinks to nothing at the window ends instead of popping.
const SLIDER_ORIGIN = -12;

const slider = (
  n: number,
  x0: number,
  length: number,
  laps: number,
  y: number,
  z: number,
  period: number,
  duration: number,
  origin = SLIDER_ORIGIN,
): LineDef["fill"] => (out, offset, t) => {
  const raw = x0 - (laps * period * t) / duration;
  const u = ((((raw - origin) % period) + period) % period) / period;
  const start = origin + u * period;
  const fade = smoothstep(0, 0.08, u) * smoothstep(1, 0.85, u);
  for (let i = 0; i < n; i++) {
    const o = (offset + i) * 3;
    out[o] = start + (length * fade * i) / (n - 1);
    out[o + 1] = y;
    out[o + 2] = z;
  }
};

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

type WaveParams = {
  z: number;
  amp: number;
  lambda: number;
  // Whole wavelengths travelled per clip (negative = toward the camera).
  laps: number;
  phase: number;
  envSeed: number;
  loop: number; // 0 = bouncing arcs; > 1/(2π) = looping spring (prolate cycloid)
  zWobble: number;
  // Visible window relative to the camera.
  behind: number;
  ahead: number;
};

const SAMPLES_PER_WAVE = 18;

const waveSampleCount = (p: WaveParams) =>
  Math.ceil(((p.behind + p.ahead) / p.lambda) * SAMPLES_PER_WAVE) + 2;

// Sampling uses a world-fixed grid so fine waves never shimmer as the camera
// moves; the window simply slides over it.
//
// Everything is periodic over the clip: the arcs advance a whole number of
// wavelengths, and the height envelope rides along with them and repeats
// over exactly that distance, so the last frame flows into the first.
const wave = (p: WaveParams, n: number, duration: number): LineDef["fill"] => (out, offset, t, camX) => {
  const dTheta = (Math.PI * 2) / SAMPLES_PER_WAVE;
  const k = (Math.PI * 2) / p.lambda;
  const theta0 = Math.floor(((camX - p.behind) * k) / dTheta) * dTheta;
  const shift = (p.laps * p.lambda * t) / duration;
  const travel = p.phase - k * shift;
  const envPeriod = Math.abs(p.laps) * p.lambda;
  for (let i = 0; i < n; i++) {
    const theta = theta0 + i * dTheta;
    const local = theta + travel;
    let x = theta / k;
    let shape: number;
    if (p.loop > 0) {
      x -= p.loop * p.lambda * Math.sin(local);
      shape = (1 - Math.cos(local)) / 2;
    } else {
      shape = Math.pow(Math.abs(Math.sin(local / 2)), 0.85);
    }
    const e = ((x - shift) / envPeriod) * Math.PI * 2;
    const env =
      0.5 +
      0.5 * (0.6 * Math.sin(e + p.envSeed) + 0.4 * Math.sin(2 * e + p.envSeed * 1.7));
    const amp = p.amp * (0.08 + 0.92 * Math.pow(env, 1.7));
    const o = (offset + i) * 3;
    out[o] = x;
    out[o + 1] = amp * shape;
    out[o + 2] = p.z + p.zWobble * Math.sin(theta * 0.37 + p.envSeed);
  }
};

// Whole wavelengths per clip closest to the requested speed (units/s).
const lapsFor = (speed: number, lambda: number, duration: number) =>
  Math.sign(speed) * Math.max(1, Math.round((Math.abs(speed) * duration) / lambda));

export const buildLines = (seed: number, duration: number): LineDef[] => {
  const rng = mulberry32(seed);
  const lines: LineDef[] = [];

  // Track rails: crisp, evenly spaced strands.
  for (let i = 0; i < 18; i++) {
    const z = -1.5 + (3 * i) / 17 + range(rng, -0.03, 0.03);
    lines.push({
      n: 300,
      width: range(rng, 0.02, 0.045),
      intensity: range(rng, 0.9, 1.3),
      color: pickBlue(rng),
      fill: straight(300, 0, z),
    });
  }
  // Glassy edges of the track.
  for (const z of [-1.65, 1.65]) {
    lines.push({
      n: 300,
      width: 0.12,
      intensity: 0.9,
      color: [0.22, 0.5, 1.0],
      fill: straight(300, 0, z),
    });
  }

  // Rectangular light segments gliding along the track surface.
  for (let i = 0; i < 36; i++) {
    const z = range(rng, -1.55, 1.55);
    const period = range(rng, 30, 44);
    lines.push({
      n: 10,
      width: range(rng, 0.25, 0.5),
      intensity: range(rng, 1.0, 1.5),
      color: [0.3, 0.62, 1.0],
      // Fade out before reaching the lens (no blown-out near plates).
      fill: slider(10, range(rng, 0, period), range(rng, 1, 4), 1, 0.005, z, period, duration, 2),
    });
  }

  // An orderly row of wave filaments rising from the track, plus a few tall
  // looping springs.
  const waveCount = 14;
  for (let i = 0; i < waveCount; i++) {
    const loopy = i % 4 === 1;
    const tall = i % 5 === 2;
    const p: WaveParams = {
      z: -1.4 + (2.8 * i) / (waveCount - 1),
      amp: tall ? range(rng, 2.0, 3.0) : range(rng, 0.35, 1.3),
      lambda: loopy ? range(rng, 1.0, 2.0) : range(rng, 0.9, 2.4),
      laps: 0,
      phase: range(rng, 0, Math.PI * 2),
      envSeed: range(rng, 0, 100),
      loop: loopy ? range(rng, 0.2, 0.3) : 0,
      zWobble: range(rng, 0, 0.08),
      behind: -1,
      ahead: 55,
    };
    p.laps = lapsFor(-range(rng, 0.3, 0.8), p.lambda, duration);
    const n = waveSampleCount(p);
    lines.push({
      n,
      width: range(rng, 0.012, 0.02),
      intensity: range(rng, 1.1, 1.5),
      color: pickBlue(rng),
      fill: wave(p, n, duration),
    });
  }

  // Giant arcs behind the track — far out of focus, they read as soft beams.
  for (let i = 0; i < 3; i++) {
    const p: WaveParams = {
      z: range(rng, -9, -5),
      amp: range(rng, 4, 7),
      lambda: range(rng, 7, 12),
      laps: 0,
      phase: range(rng, 0, Math.PI * 2),
      envSeed: range(rng, 0, 100),
      loop: 0,
      zWobble: 0,
      behind: BEHIND,
      ahead: 70,
    };
    p.laps = lapsFor(-range(rng, 0.3, 0.7), p.lambda, duration);
    const n = waveSampleCount(p);
    lines.push({
      n,
      width: 0.06,
      intensity: 0.6,
      color: [0.25, 0.55, 1.0],
      fill: wave(p, n, duration),
    });
  }

  // Wide light bars on a lower rail beneath the track; with the low camera
  // they sit close to the lens and bloom into soft slabs.
  for (let i = 0; i < 9; i++) {
    lines.push({
      foreground: true,
      n: 24,
      width: range(rng, 0.3, 0.55),
      intensity: range(rng, 0.4, 0.6),
      color: [0.25, 0.58, 1.0],
      fill: slider(24, range(rng, -3, 9), range(rng, 4, 8), 1, range(rng, -1.5, -1.0), range(rng, -1.0, 0.6), 12, duration, -3),
    });
  }

  return lines;
};
