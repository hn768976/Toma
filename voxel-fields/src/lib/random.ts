// Deterministic randomness. Everything random in the project comes from here,
// seeded once at module level -- never Math.random() at render time.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Seeded simplex noise (Gustavson / Ashima formulation), 2D and 4D.
// Output roughly in [-1, 1].

const grad4 = new Float64Array([
  0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1, -1,
  0, -1, -1, 1, 0, -1, -1, -1, 1, 0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1,
  -1, -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1, 1, -1, 0, -1, -1, 1, 1, 0, 1, 1, 1,
  0, -1, 1, -1, 0, 1, 1, -1, 0, -1, -1, 1, 0, 1, -1, 1, 0, -1, -1, -1, 0, 1, -1,
  -1, 0, -1, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0,
  -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 0,
]);
const grad2 = new Float64Array([
  1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1,
]);

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F4 = (Math.sqrt(5) - 1) / 4;
const G4 = (5 - Math.sqrt(5)) / 20;

export type Noise = {
  noise2: (x: number, y: number) => number;
  noise4: (x: number, y: number, z: number, w: number) => number;
};

export const makeNoise = (seed: number): Noise => {
  const rand = mulberry32(seed);
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

  const noise2 = (xin: number, yin: number) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = (perm[ii + perm[jj]] & 7) * 2;
      t0 *= t0;
      n += t0 * t0 * (grad2[g] * x0 + grad2[g + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = (perm[ii + i1 + perm[jj + j1]] & 7) * 2;
      t1 *= t1;
      n += t1 * t1 * (grad2[g] * x1 + grad2[g + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = (perm[ii + 1 + perm[jj + 1]] & 7) * 2;
      t2 *= t2;
      n += t2 * t2 * (grad2[g] * x2 + grad2[g + 1] * y2);
    }
    return 70 * n;
  };

  const noise4 = (x: number, y: number, z: number, w: number) => {
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
    // Rank the coordinates to find the simplex.
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
    const xs = [x0, x0 - i1 + G4, x0 - i2 + 2 * G4, x0 - i3 + 3 * G4, x0 - 1 + 4 * G4];
    const ys = [y0, y0 - j1 + G4, y0 - j2 + 2 * G4, y0 - j3 + 3 * G4, y0 - 1 + 4 * G4];
    const zs = [z0, z0 - k1 + G4, z0 - k2 + 2 * G4, z0 - k3 + 3 * G4, z0 - 1 + 4 * G4];
    const ws = [w0, w0 - l1 + G4, w0 - l2 + 2 * G4, w0 - l3 + 3 * G4, w0 - 1 + 4 * G4];
    const di = [0, i1, i2, i3, 1];
    const dj = [0, j1, j2, j3, 1];
    const dk = [0, k1, k2, k3, 1];
    const dl = [0, l1, l2, l3, 1];
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const ll = l & 255;
    let n = 0;
    for (let c = 0; c < 5; c++) {
      let tt = 0.6 - xs[c] * xs[c] - ys[c] * ys[c] - zs[c] * zs[c] - ws[c] * ws[c];
      if (tt > 0) {
        const g =
          (perm[ii + di[c] + perm[jj + dj[c] + perm[kk + dk[c] + perm[ll + dl[c]]]]] & 31) * 4;
        tt *= tt;
        n +=
          tt *
          tt *
          (grad4[g] * xs[c] + grad4[g + 1] * ys[c] + grad4[g + 2] * zs[c] + grad4[g + 3] * ws[c]);
      }
    }
    return 27 * n;
  };

  return { noise2, noise4 };
};
