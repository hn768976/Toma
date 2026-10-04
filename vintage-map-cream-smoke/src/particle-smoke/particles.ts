import { mulberry32 } from "../lib/random";

// Static per-particle data, generated once at module load with a fixed seed.
// aPosition = (u, v) on the sheet, aData = (sheet id, seed); dust particles
// carry sheet id + DUST_FLAG. Every position on screen is computed in the vertex shader.
export const PARTICLE_COUNT = 3_000_000;
export const SHEET_COUNT = 3;
export const DUST_SHARE = 0.1;
export const DUST_FLAG = 10;

const rnd = mulberry32(20260917);
export const particlePositions = new Float32Array(PARTICLE_COUNT * 2);
export const particleData = new Float32Array(PARTICLE_COUNT * 2);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const dust = rnd() < DUST_SHARE;
  // most particles on the main band (sheet 0), the rest on two thin strands
  const r = rnd();
  const sheet = r < 0.7 ? 0 : r < 0.85 ? 1 : 2;
  const u = rnd();
  // dust starts near the sheet edges
  const v = dust ? (rnd() < 0.5 ? 0.02 * rnd() : 1 - 0.02 * rnd()) : rnd();
  particlePositions[i * 2] = u;
  particlePositions[i * 2 + 1] = v;
  particleData[i * 2] = dust ? DUST_FLAG + sheet : sheet;
  particleData[i * 2 + 1] = rnd();
}
