import * as THREE from "three";
import { getCloudNoise } from "./noise";

/**
 * Weather maps (x = coverage, y = cloud top as a fraction of the layer),
 * precomputed once into 2D half-float textures so the raymarcher pays one
 * 2D fetch per lookup. They sample the same seeded base noise volume.
 */

const sat = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const remap = (v: number, l0: number, h0: number, l1: number, h1: number) =>
  l1 + ((v - l0) * (h1 - l1)) / (h0 - l0);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Trilinear, repeat-wrapped sample of the base volume (same as GLSL texture()). */
const makeSampler = () => {
  const tex = getCloudNoise().base;
  const data = tex.image.data as Uint8Array;
  const N = tex.image.width;
  const out = [0, 0, 0, 0];
  return (u: number, v: number, w: number) => {
    const x = u * N - 0.5;
    const y = v * N - 0.5;
    const z = w * N - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fy = y - y0;
    const fz = z - z0;
    out[0] = out[1] = out[2] = out[3] = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1;
      const dy = (c >> 1) & 1;
      const dz = (c >> 2) & 1;
      const ix = (((x0 + dx) % N) + N) % N;
      const iy = (((y0 + dy) % N) + N) % N;
      const iz = (((z0 + dz) % N) + N) % N;
      const wgt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      const o = ((iz * N + iy) * N + ix) * 4;
      out[0] += data[o] * wgt;
      out[1] += data[o + 1] * wgt;
      out[2] += data[o + 2] * wgt;
      out[3] += data[o + 3] * wgt;
    }
    return [out[0] / 255, out[1] / 255, out[2] / 255, out[3] / 255];
  };
};

/**
 * Builds an RGBA half-float map: R = coverage, G = top, B = the highest top
 * within `dilate` texels (square window), used for empty-space skipping.
 */
const toTexture = (
  size: number,
  fn: (i: number, j: number) => [number, number],
  wrap: THREE.Wrapping,
  dilate: number,
) => {
  const cov = new Float32Array(size * size);
  const top = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const [a, b] = fn(i, j);
      cov[j * size + i] = a;
      top[j * size + i] = a > 0.01 ? b : 0;
    }
  }
  const repeat = wrap === THREE.RepeatWrapping;
  const idx = (k: number) => (repeat ? ((k % size) + size) % size : Math.min(size - 1, Math.max(0, k)));
  // Separable running max (sliding window).
  const tmp = new Float32Array(size * size);
  const mx = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let m = 0;
      for (let k = -dilate; k <= dilate; k++) m = Math.max(m, top[j * size + idx(i + k)]);
      tmp[j * size + i] = m;
    }
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let m = 0;
      for (let k = -dilate; k <= dilate; k++) m = Math.max(m, tmp[idx(j + k) * size + i]);
      mx[j * size + i] = m;
    }
  }
  const data = new Uint16Array(size * size * 4);
  for (let n = 0; n < size * size; n++) {
    data[n * 4] = THREE.DataUtils.toHalfFloat(cov[n]);
    data[n * 4 + 1] = THREE.DataUtils.toHalfFloat(top[n]);
    data[n * 4 + 2] = THREE.DataUtils.toHalfFloat(mx[n]);
    data[n * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = wrap;
  t.wrapT = wrap;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
};

/** Empty-space skipping radius (m): the B channel holds the max top within it. */
export const SKIP_RADIUS = 1000;

/** Flight map: covers x in [-16, 16] km, z in [-26, 6] km. */
export const FLIGHT_MAP = { x0: -16000, z0: -26000, size: 32000, res: 1024 };

const flightWeather = (
  base: ReturnType<typeof makeSampler>,
  x: number,
  z: number,
): [number, number] => {
  const w = base(x / 9600, z / 9600, 0.31);
  const w2 = base(x / 4800 + 0.37, z / 4800 + 0.37, 0.71);
  let cov = sat(remap(w[1] * 0.6 + w2[2] * 0.4, 0.34, 0.7, 0.3, 0.85));
  let top = sat(remap(w[2] * 0.5 + w2[1] * 0.5, 0.3, 0.7, 0.14, 0.3));
  // Around the exit the tops sit below the camera; far away they climb
  // into congestus towers on the horizon.
  const dE = Math.hypot(x, z + 700);
  const near = 1 - ss(1200, 3200, dE);
  // Varied (not capped) tops so they don't flatten into plateaus.
  top = mix(top, 0.1 + 0.16 * w2[3] * w[1] * 1.6, near);
  cov = mix(cov, cov * 0.8, near);
  // A cloud floor under the opening keeps the land hidden there.
  const start = 1 - ss(450, 1100, Math.hypot(x, z + 60));
  cov = mix(cov, 0.85, start);
  top = mix(top, 0.11 + 0.09 * w2[3], start);
  // Congestus towers from ~2.5 km out.
  const far = ss(2200, 5500, dE);
  // A lower layer with a few tall towers (tall tops are rare).
  const tower = Math.pow(sat((w2[3] - 0.35) / 0.45), 1.6);
  top = mix(top, 0.2 + 0.2 * tower, far);
  cov = mix(cov, Math.min(0.97, Math.max(cov, 0.45 + 0.3 * w[3]) + 0.35 * tower), far * 0.85);

  return [cov, top];
};

/** Sea near map: one 2400 m tile, repeat-wrapped (the loop period). */
export const SEA_NEAR = { size: 2400, res: 256 };
/** Sea far map: camera relative, +-24 km. */
export const SEA_FAR = { half: 24000, res: 1024 };

let flightTex: THREE.DataTexture | null = null;
let seaNearTex: THREE.DataTexture | null = null;
let seaFarTex: THREE.DataTexture | null = null;

export const getFlightWeather = () => {
  if (!flightTex) {
    const base = makeSampler();
    const { x0, z0, size, res } = FLIGHT_MAP;
    flightTex = toTexture(
      res,
      (i, j) => flightWeather(base, x0 + ((i + 0.5) / res) * size, z0 + ((j + 0.5) / res) * size),
      THREE.ClampToEdgeWrapping,
      Math.ceil((SKIP_RADIUS / size) * res) + 1,
    );
  }
  return flightTex;
};

export const getSeaWeather = () => {
  if (!seaNearTex || !seaFarTex) {
    const base = makeSampler();
    seaNearTex = toTexture(
      SEA_NEAR.res,
      (i, j) => {
        const w = base((i + 0.5) / SEA_NEAR.res, (j + 0.5) / SEA_NEAR.res, 0.53);
        return [
          sat(remap(w[1] * 0.75 + w[3] * 0.25, 0.3, 0.72, 0.2, 0.78)),
          sat(remap(w[2], 0.25, 0.75, 0.16, 0.34)),
        ];
      },
      THREE.RepeatWrapping,
      Math.ceil((SKIP_RADIUS / SEA_NEAR.size) * SEA_NEAR.res) + 1,
    );
    seaFarTex = toTexture(
      SEA_FAR.res,
      (i, j) => {
        const rx = -SEA_FAR.half + ((i + 0.5) / SEA_FAR.res) * 2 * SEA_FAR.half;
        const rz = -SEA_FAR.half + ((j + 0.5) / SEA_FAR.res) * 2 * SEA_FAR.half;
        const f = base(rx / 9000 + 0.21, rz / 9000 + 0.6, 0.17);
        return [
          sat(remap(f[1], 0.35, 0.75, 0.1, 0.9)),
          sat(remap(f[2] * 0.7 + f[3] * 0.3, 0.3, 0.75, 0.3, 0.72)),
        ];
      },
      THREE.ClampToEdgeWrapping,
      Math.ceil((SKIP_RADIUS / (2 * SEA_FAR.half)) * SEA_FAR.res) + 1,
    );
  }
  return { near: seaNearTex, far: seaFarTex };
};
