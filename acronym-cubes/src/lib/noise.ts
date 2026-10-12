import { mulberry32 } from "./random";

/**
 * 4D simplex noise (after Stefan Gustavson's public-domain reference).
 * The permutation table is shuffled once at module level from a fixed seed.
 * Sampling the last two dimensions around a circle (cos θ, sin θ) gives noise
 * that evolves and returns exactly to its start: a seamless loop.
 */
const rand = mulberry32(0x5eed_c0be);
const p = new Uint8Array(256);
for (let i = 0; i < 256; i++) p[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  const t = p[i];
  p[i] = p[j];
  p[j] = t;
}
const perm = new Uint8Array(512);
for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

const grad4 = new Float32Array([
  0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1,
  -1, -1, 1, 0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1, -1, -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1,
  1, -1, 0, -1, -1, 1, 1, 0, 1, 1, 1, 0, -1, 1, -1, 0, 1, 1, -1, 0, -1, -1, 1, 0, 1, -1, 1, 0, -1,
  -1, -1, 0, 1, -1, -1, 0, -1, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1,
  1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 0,
]);

const F4 = (Math.sqrt(5) - 1) / 4;
const G4 = (5 - Math.sqrt(5)) / 20;

export function simplex4(x: number, y: number, z: number, w: number): number {
  const s = (x + y + z + w) * F4;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const l = Math.floor(w + s);
  const t = (i + j + k + l) * G4;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const z0 = z - (k - t);
  const w0 = w - (l - t);
  let rankx = 0;
  let ranky = 0;
  let rankz = 0;
  let rankw = 0;
  if (x0 > y0) rankx++;
  else ranky++;
  if (x0 > z0) rankx++;
  else rankz++;
  if (x0 > w0) rankx++;
  else rankw++;
  if (y0 > z0) ranky++;
  else rankz++;
  if (y0 > w0) ranky++;
  else rankw++;
  if (z0 > w0) rankz++;
  else rankw++;
  const i1 = rankx >= 3 ? 1 : 0;
  const j1 = ranky >= 3 ? 1 : 0;
  const k1 = rankz >= 3 ? 1 : 0;
  const l1 = rankw >= 3 ? 1 : 0;
  const i2 = rankx >= 2 ? 1 : 0;
  const j2 = ranky >= 2 ? 1 : 0;
  const k2 = rankz >= 2 ? 1 : 0;
  const l2 = rankw >= 2 ? 1 : 0;
  const i3 = rankx >= 1 ? 1 : 0;
  const j3 = ranky >= 1 ? 1 : 0;
  const k3 = rankz >= 1 ? 1 : 0;
  const l3 = rankw >= 1 ? 1 : 0;
  const x1 = x0 - i1 + G4;
  const y1 = y0 - j1 + G4;
  const z1 = z0 - k1 + G4;
  const w1 = w0 - l1 + G4;
  const x2 = x0 - i2 + 2 * G4;
  const y2 = y0 - j2 + 2 * G4;
  const z2 = z0 - k2 + 2 * G4;
  const w2 = w0 - l2 + 2 * G4;
  const x3 = x0 - i3 + 3 * G4;
  const y3 = y0 - j3 + 3 * G4;
  const z3 = z0 - k3 + 3 * G4;
  const w3 = w0 - l3 + 3 * G4;
  const x4 = x0 - 1 + 4 * G4;
  const y4 = y0 - 1 + 4 * G4;
  const z4 = z0 - 1 + 4 * G4;
  const w4 = w0 - 1 + 4 * G4;
  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  const ll = l & 255;
  const contrib = (gi: number, cx: number, cy: number, cz: number, cw: number) => {
    let tt = 0.6 - cx * cx - cy * cy - cz * cz - cw * cw;
    if (tt < 0) return 0;
    tt *= tt;
    const g = (gi % 32) * 4;
    return tt * tt * (grad4[g] * cx + grad4[g + 1] * cy + grad4[g + 2] * cz + grad4[g + 3] * cw);
  };
  const n0 = contrib(perm[ii + perm[jj + perm[kk + perm[ll]]]], x0, y0, z0, w0);
  const n1 = contrib(perm[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]]], x1, y1, z1, w1);
  const n2 = contrib(perm[ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]]], x2, y2, z2, w2);
  const n3 = contrib(perm[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]]], x3, y3, z3, w3);
  const n4 = contrib(perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]], x4, y4, z4, w4);
  return 27 * (n0 + n1 + n2 + n3 + n4);
}
