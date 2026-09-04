import { mulberry32 } from "./random";

/**
 * 4D simplex noise (Gustavson's formulation, seeded permutation table).
 *
 * Four dimensions rather than three because the clip has to loop: the two
 * extra axes are driven by `cos(2*PI*t)` and `sin(2*PI*t)`, so sampling walks a
 * closed circle through the noise and returns exactly to its starting values at
 * the end of the composition.
 */

const F4 = (Math.sqrt(5) - 1) / 4;
const G4 = (5 - Math.sqrt(5)) / 20;

// prettier-ignore
const GRAD4 = new Float32Array([
  0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1,
  0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1,
  1, 0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1, -1,
  -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1, 1, -1, 0, -1, -1,
  1, 1, 0, 1, 1, 1, 0, -1, 1, -1, 0, 1, 1, -1, 0, -1,
  -1, 1, 0, 1, -1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, -1,
  1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0,
  -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 0,
]);

export type Noise4D = (x: number, y: number, z: number, w: number) => number;

export const createNoise4D = (seed: number): Noise4D => {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }
  // Fisher-Yates with the seeded PRNG.
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod32 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod32[i] = perm[i] % 32;
  }

  return (x: number, y: number, z: number, w: number): number => {
    // Skew the input space onto the simplex lattice.
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

    // Rank the coordinates to work out which of the 24 simplices we are in.
    let rx = 0;
    let ry = 0;
    let rz = 0;
    let rw = 0;
    if (x0 > y0) rx++;
    else ry++;
    if (x0 > z0) rx++;
    else rz++;
    if (x0 > w0) rx++;
    else rw++;
    if (y0 > z0) ry++;
    else rz++;
    if (y0 > w0) ry++;
    else rw++;
    if (z0 > w0) rz++;
    else rw++;

    const i1 = rx >= 3 ? 1 : 0;
    const j1 = ry >= 3 ? 1 : 0;
    const k1 = rz >= 3 ? 1 : 0;
    const l1 = rw >= 3 ? 1 : 0;
    const i2 = rx >= 2 ? 1 : 0;
    const j2 = ry >= 2 ? 1 : 0;
    const k2 = rz >= 2 ? 1 : 0;
    const l2 = rw >= 2 ? 1 : 0;
    const i3 = rx >= 1 ? 1 : 0;
    const j3 = ry >= 1 ? 1 : 0;
    const k3 = rz >= 1 ? 1 : 0;
    const l3 = rw >= 1 ? 1 : 0;

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

    let n = 0;

    let tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
    if (tt > 0) {
      const g = permMod32[ii + perm[jj + perm[kk + perm[ll]]]] * 4;
      tt *= tt;
      n +=
        tt *
        tt *
        (GRAD4[g] * x0 + GRAD4[g + 1] * y0 + GRAD4[g + 2] * z0 + GRAD4[g + 3] * w0);
    }

    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
    if (tt > 0) {
      const g =
        permMod32[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]]] * 4;
      tt *= tt;
      n +=
        tt *
        tt *
        (GRAD4[g] * x1 + GRAD4[g + 1] * y1 + GRAD4[g + 2] * z1 + GRAD4[g + 3] * w1);
    }

    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
    if (tt > 0) {
      const g =
        permMod32[ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]]] * 4;
      tt *= tt;
      n +=
        tt *
        tt *
        (GRAD4[g] * x2 + GRAD4[g + 1] * y2 + GRAD4[g + 2] * z2 + GRAD4[g + 3] * w2);
    }

    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
    if (tt > 0) {
      const g =
        permMod32[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]]] * 4;
      tt *= tt;
      n +=
        tt *
        tt *
        (GRAD4[g] * x3 + GRAD4[g + 1] * y3 + GRAD4[g + 2] * z3 + GRAD4[g + 3] * w3);
    }

    tt = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
    if (tt > 0) {
      const g =
        permMod32[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]] * 4;
      tt *= tt;
      n +=
        tt *
        tt *
        (GRAD4[g] * x4 + GRAD4[g + 1] * y4 + GRAD4[g + 2] * z4 + GRAD4[g + 3] * w4);
    }

    return 27 * n;
  };
};
