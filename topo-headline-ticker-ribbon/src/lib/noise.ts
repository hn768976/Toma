// Periodic gradient noise, identical in GLSL and JS (integer hash, 8 fixed
// gradient directions, no trig) so CPU-placed pins sit exactly on the terrain.

export function pcg(v: number): number {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

const DIRS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.70710678, 0.70710678], [-0.70710678, 0.70710678], [0.70710678, -0.70710678], [-0.70710678, -0.70710678],
];

function grad(ix: number, iz: number, period: number, seed: number): [number, number] {
  const cz = ((iz % period) + period) % period;
  const h = pcg(((ix + 65536 + seed) >>> 0) ^ pcg((cz + 1013904223) >>> 0));
  return DIRS[h & 7];
}

export function pnoise(x: number, z: number, period: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const g00 = grad(ix, iz, period, seed), g10 = grad(ix + 1, iz, period, seed);
  const g01 = grad(ix, iz + 1, period, seed), g11 = grad(ix + 1, iz + 1, period, seed);
  const n00 = g00[0] * fx + g00[1] * fz;
  const n10 = g10[0] * (fx - 1) + g10[1] * fz;
  const n01 = g01[0] * fx + g01[1] * (fz - 1);
  const n11 = g11[0] * (fx - 1) + g11[1] * (fz - 1);
  const a = n00 + (n10 - n00) * ux;
  const b = n01 + (n11 - n01) * ux;
  return a + (b - a) * uz;
}

export const GLSL_PNOISE = /* glsl */ `
uint pcgN(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
vec2 gradN(int ix, int iz, int period, int seed){
  int cz = ((iz % period) + period) % period;
  uint h = pcgN(uint(ix + 65536 + seed) ^ pcgN(uint(cz) + 1013904223u));
  uint k = h & 7u;
  const float s = 0.70710678;
  if (k == 0u) return vec2(1,0); if (k == 1u) return vec2(-1,0);
  if (k == 2u) return vec2(0,1); if (k == 3u) return vec2(0,-1);
  if (k == 4u) return vec2(s,s); if (k == 5u) return vec2(-s,s);
  if (k == 6u) return vec2(s,-s); return vec2(-s,-s);
}
float pnoise(vec2 p, int period, int seed){
  vec2 i = floor(p); vec2 f = p - i;
  int ix = int(i.x), iz = int(i.y);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float n00 = dot(gradN(ix,iz,period,seed), f);
  float n10 = dot(gradN(ix+1,iz,period,seed), f-vec2(1,0));
  float n01 = dot(gradN(ix,iz+1,period,seed), f-vec2(0,1));
  float n11 = dot(gradN(ix+1,iz+1,period,seed), f-vec2(1,1));
  return mix(mix(n00,n10,u.x), mix(n01,n11,u.x), u.y);
}
`;
