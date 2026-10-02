import { CAM_DIST, CAM_FOV, PARTICLE_COUNT, T, VIEW_H } from "./config";
import { GLYPHS } from "./atlas";
import { mulberry32 } from "./random";

// Per-particle parameters that do not depend on the word. Generated once at
// module level from a fixed seed; the word only supplies the target points.
export type ParticleBase = {
  start: Float32Array; // vec3 deep in the scene
  ctrl1: Float32Array; // vec3 near the camera (the swirl)
  ctrl2Off: Float32Array; // vec3 offset from the target for the landing curve
  time: Float32Array; // vec4 spawn, arrive, fadeStart, sparkTime (-1 = none)
  look: Float32Array; // vec4 glyph, size, orange (0/1), seed
  spark: Float32Array; // vec4 spark offset xyz, swirl angle
};

const rng = mulberry32(0x0c0ffee5);
const TAN_HALF = Math.tan(((CAM_FOV / 2) * Math.PI) / 180);
const N = PARTICLE_COUNT;

const pickGlyph = () => {
  // Binary digits dominate.
  const r = rng();
  if (r < 0.3) return 0;
  if (r < 0.6) return 1;
  return 2 + Math.floor(rng() * (GLYPHS.length - 2));
};

const build = (): ParticleBase => {
  const start = new Float32Array(N * 3);
  const ctrl1 = new Float32Array(N * 3);
  const ctrl2Off = new Float32Array(N * 3);
  const time = new Float32Array(N * 4);
  const look = new Float32Array(N * 4);
  const spark = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    // Deep start spread across the whole view, snapped to vertical "data
    // columns" like the reference's streams of digits.
    const z0 = -110 - rng() * 190;
    const half = (CAM_DIST - z0) * TAN_HALF;
    const cols = 36;
    const col = Math.floor(rng() * cols);
    start[i * 3] = ((col + 0.5) / cols - 0.5) * 2 * half * (16 / 9) * 0.95;
    start[i * 3 + 1] = (rng() * 2 - 1) * half * 0.95;
    start[i * 3 + 2] = z0;

    // Sweep outward past the camera (warp-style), mostly beyond the frame edge.
    const z1 = rng() * 32;
    const half1 = (CAM_DIST - z1) * TAN_HALF;
    const out = 0.5 + rng() * 1.1;
    const dirX = start[i * 3] / (half * (16 / 9));
    const dirY = start[i * 3 + 1] / half;
    ctrl1[i * 3] = dirX * half1 * (16 / 9) * out + (rng() - 0.5) * half1;
    ctrl1[i * 3 + 1] = dirY * half1 * out + (rng() - 0.5) * half1 * 0.5;
    ctrl1[i * 3 + 2] = z1;

    // Landing: come in from slightly in front, offset outward.
    const a2 = rng() * Math.PI * 2;
    const r2 = 1 + rng() * 5;
    ctrl2Off[i * 3] = Math.cos(a2) * r2;
    ctrl2Off[i * 3 + 1] = Math.sin(a2) * r2;
    ctrl2Off[i * 3 + 2] = 2 + rng() * 8;

    // Arrival 150..210, skewed early so the word reads by frame ~180.
    const arrive = T.convergeStart + (T.convergeEnd - T.convergeStart) * Math.pow(rng(), 1.6);
    let spawn = T.stormStart + rng() * 85;
    spawn = Math.min(spawn, arrive - 55);
    const fadeStart = T.outlineStart + 2 + rng() * 38;

    const isSpark = rng() < 0.07;
    let sparkTime = -1;
    if (isSpark) {
      sparkTime = arrive < 200 && rng() < 0.5 ? arrive + 1 + rng() * 8 : T.outlineStart + 2 + rng() * 34;
    }
    const orange = isSpark ? (rng() < 0.6 ? 1 : 0) : rng() < 0.01 ? 1 : 0;

    time[i * 4] = spawn;
    time[i * 4 + 1] = arrive;
    time[i * 4 + 2] = fadeStart;
    time[i * 4 + 3] = sparkTime;

    look[i * 4] = pickGlyph();
    look[i * 4 + 1] = (0.010 + rng() * rng() * 0.020) * VIEW_H;
    look[i * 4 + 2] = orange;
    look[i * 4 + 3] = rng();

    // Spark offset: mostly outward in the word plane, a little toward camera.
    const sa = rng() * Math.PI * 2;
    const sd = (0.08 + rng() * 0.3) * VIEW_H;
    spark[i * 4] = Math.cos(sa) * sd * 1.3;
    spark[i * 4 + 1] = Math.sin(sa) * sd;
    spark[i * 4 + 2] = rng() * 6;
    spark[i * 4 + 3] = 0.5 + rng() * 1.2;
  }
  return { start, ctrl1, ctrl2Off, time, look, spark };
};

export const PARTICLES: ParticleBase = build();
