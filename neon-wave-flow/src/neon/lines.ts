import { mulberry32, range, Rng, wobble } from "./random";

// World layout: the light track runs along +X at y = 0, spanning z ≈ ±1.
// Wave filaments rise from the track as bouncing arcs and looping springs.

export type LineDef = {
  n: number;
  // Foreground slabs are a lens-side element of the low tracking shot only.
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

// A short segment sliding along the track, wrapped so it keeps recurring
// ahead of the camera.
const slider = (
  n: number,
  x0: number,
  length: number,
  speed: number,
  y: number,
  z: number,
  period: number,
  behind = BEHIND,
): LineDef["fill"] => (out, offset, t, camX) => {
  const raw = x0 + speed * t;
  const base = camX - behind;
  const start = base + ((((raw - base) % period) + period) % period);
  for (let i = 0; i < n; i++) {
    const o = (offset + i) * 3;
    out[o] = start + (length * i) / (n - 1);
    out[o + 1] = y;
    out[o + 2] = z;
  }
};

type WaveParams = {
  z: number;
  amp: number;
  lambda: number;
  speed: number;
  phase: number;
  envSeed: number;
  envScale: number;
  loop: number; // 0 = bouncing arcs; > 1/(2π) = looping spring (prolate cycloid)
  zWobble: number;
  ahead: number;
};

const SAMPLES_PER_WAVE = 36;

const waveSampleCount = (p: WaveParams) =>
  Math.ceil(((BEHIND + p.ahead) / p.lambda) * SAMPLES_PER_WAVE) + 2;

// Sampling uses a world-fixed grid so fine waves never shimmer as the camera
// moves; the window simply slides over it.
const wave = (p: WaveParams, n: number): LineDef["fill"] => (out, offset, t, camX) => {
  const dTheta = (Math.PI * 2) / SAMPLES_PER_WAVE;
  const k = (Math.PI * 2) / p.lambda;
  const theta0 = Math.floor(((camX - BEHIND) * k) / dTheta) * dTheta;
  const travel = p.phase - k * p.speed * t;
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
    const env = 0.5 + 0.5 * wobble(x * p.envScale + t * 0.22, p.envSeed);
    const amp = p.amp * (0.08 + 0.92 * Math.pow(env, 1.7));
    const o = (offset + i) * 3;
    out[o] = x;
    out[o + 1] = amp * shape;
    out[o + 2] = p.z + p.zWobble * Math.sin(theta * 0.37 + p.envSeed);
  }
};

export const buildLines = (seed: number): LineDef[] => {
  const rng = mulberry32(seed);
  const lines: LineDef[] = [];

  // Track strands.
  for (let i = 0; i < 16; i++) {
    const z = -1 + (2 * i) / 15 + range(rng, -0.04, 0.04);
    lines.push({
      n: 300,
      width: range(rng, 0.012, 0.03),
      intensity: range(rng, 0.3, 0.7),
      color: pickBlue(rng),
      fill: straight(300, range(rng, -0.015, 0.015), z),
    });
  }
  // Wide glassy edge bands of the track.
  for (const z of [-1.18, 1.16, 1.3]) {
    lines.push({
      n: 300,
      width: 0.11,
      intensity: 0.5,
      color: [0.2, 0.45, 1.0],
      fill: straight(300, -0.02, z),
    });
  }

  // Bright light pads gliding along the track.
  for (let i = 0; i < 26; i++) {
    const z = range(rng, -1.2, 1.3);
    lines.push({
      n: 10,
      width: range(rng, 0.08, 0.2),
      intensity: range(rng, 1.0, 1.8),
      color: [0.3, 0.62, 1.0],
      fill: slider(10, range(rng, 0, 60), range(rng, 0.4, 2.2), range(rng, -1.6, -0.6), 0.005, z, 60),
    });
  }

  // Wave filaments rising from the track.
  for (let i = 0; i < 34; i++) {
    const loopy = rng() < 0.35;
    const p: WaveParams = {
      z: range(rng, -1.0, 1.1),
      amp: rng() < 0.3 ? range(rng, 1.4, 3.2) : range(rng, 0.25, 1.3),
      lambda: loopy ? range(rng, 0.7, 2.0) : range(rng, 0.5, 2.6),
      speed: range(rng, -1.4, -0.5),
      phase: range(rng, 0, Math.PI * 2),
      envSeed: range(rng, 0, 100),
      envScale: range(rng, 0.06, 0.2),
      loop: loopy ? range(rng, 0.2, 0.32) : 0,
      zWobble: range(rng, 0, 0.12),
      ahead: 70,
    };
    const n = waveSampleCount(p);
    lines.push({
      n,
      width: range(rng, 0.008, 0.02),
      intensity: range(rng, 0.7, 1.3),
      color: pickBlue(rng),
      fill: wave(p, n),
    });
  }

  // Giant arcs behind the track — far out of focus, they read as soft beams.
  for (let i = 0; i < 6; i++) {
    const p: WaveParams = {
      z: range(rng, -9, -4),
      amp: range(rng, 4, 8),
      lambda: range(rng, 5, 11),
      speed: range(rng, -1.2, -0.4),
      phase: range(rng, 0, Math.PI * 2),
      envSeed: range(rng, 0, 100),
      envScale: 0.05,
      loop: 0,
      zWobble: 0,
      ahead: 70,
    };
    const n = waveSampleCount(p);
    lines.push({
      n,
      width: 0.06,
      intensity: 0.9,
      color: [0.25, 0.55, 1.0],
      fill: wave(p, n),
    });
  }

  // Foreground slabs on a lower parallel rail close to the lens.
  for (let i = 0; i < 9; i++) {
    lines.push({
      foreground: true,
      n: 24,
      width: range(rng, 0.18, 0.35),
      intensity: range(rng, 0.55, 0.9),
      color: [0.25, 0.58, 1.0],
      fill: slider(24, range(rng, 0, 16), range(rng, 1.5, 4), range(rng, -1.2, -0.5), range(rng, -0.75, -0.6), range(rng, 1.3, 1.7), 16, 4),
    });
  }

  return lines;
};
