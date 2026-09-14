import * as THREE from "three";

/**
 * The cell surface, baked once on the CPU.
 *
 * The first version of this shader evaluated four octaves of gradient
 * noise per fragment, five times over, to get relief and speckle. That
 * is fine on a GPU and ruinous under SwiftShader, which is what a
 * headless render actually runs on: it worked out at roughly 360
 * `sin()` calls for every pixel of every cell.
 *
 * Baking the same fields into one small tiling texture turns all of
 * that into two texture fetches, with no visible difference in the
 * result. Channels:
 *
 *   R  coarse relief      -> nodular surface, read as a height field
 *   G  fine speckle       -> ribosome pin-points
 *   B  mid-frequency wash -> gentle colour mottling
 */

const SIZE = 256;

/** Periodic value noise: hashing the lattice modulo `period` tiles it. */
const makeNoise = (seed: number) => {
  const hash = (x: number, y: number, period: number) => {
    const xi = ((x % period) + period) % period;
    const yi = ((y % period) + period) % period;
    let h = xi * 374761393 + yi * 668265263 + seed * 2246822519;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  return (x: number, y: number, period: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const n00 = hash(x0, y0, period);
    const n10 = hash(x0 + 1, y0, period);
    const n01 = hash(x0, y0 + 1, period);
    const n11 = hash(x0 + 1, y0 + 1, period);

    return (
      n00 * (1 - ux) * (1 - uy) +
      n10 * ux * (1 - uy) +
      n01 * (1 - ux) * uy +
      n11 * ux * uy
    );
  };
};

const fbm = (
  noise: (x: number, y: number, period: number) => number,
  u: number,
  v: number,
  basePeriod: number,
  octaves: number,
) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += noise(u * period, v * period, period) * amp;
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
};

let cached: THREE.DataTexture | null = null;

export const getDetailTexture = () => {
  if (cached) {
    return cached;
  }

  const relief = makeNoise(17);
  const speckle = makeNoise(4391);
  const wash = makeNoise(90210);

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const i = (y * SIZE + x) * 4;

      data[i] = Math.round(255 * fbm(relief, u, v, 8, 4));
      // Ridged high-frequency field: sparse bright points rather than a
      // smooth wash, which is what reads as membrane speckle.
      const s = fbm(speckle, u, v, 32, 2);
      data[i + 1] = Math.round(255 * Math.pow(s, 2.2));
      data[i + 2] = Math.round(255 * fbm(wash, u, v, 4, 3));
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  cached = texture;
  return texture;
};
