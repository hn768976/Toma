/**
 * Value noise in 2D (static fields: hue pooling, height weighting) and 4D
 * (animated fields).
 *
 * The 4D variant is what makes the loop seamless: sampling
 * `noise4(x, z, R*cos(2*PI*t), R*sin(2*PI*t))` walks a circle through the last
 * two dimensions, so frame 300 lands exactly back on frame 0 while the path in
 * between never repeats a value.
 */

const hash4i = (x: number, y: number, z: number, w: number, seed: number) => {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (w | 0), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const noise2 = (x: number, y: number, seed = 1) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const n00 = hash4i(xi, yi, 0, 0, seed);
  const n10 = hash4i(xi + 1, yi, 0, 0, seed);
  const n01 = hash4i(xi, yi + 1, 0, 0, seed);
  const n11 = hash4i(xi + 1, yi + 1, 0, 0, seed);
  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
};

export const noise4 = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed = 1,
) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const wi = Math.floor(w);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const fz = fade(z - zi);
  const fw = fade(w - wi);

  let acc = 0;
  // Quadrilinear interpolation over the 16 corners of the 4D cell.
  for (let dw = 0; dw < 2; dw++) {
    const ww = dw === 0 ? 1 - fw : fw;
    for (let dz = 0; dz < 2; dz++) {
      const wz = dz === 0 ? 1 - fz : fz;
      for (let dy = 0; dy < 2; dy++) {
        const wy = dy === 0 ? 1 - fy : fy;
        for (let dx = 0; dx < 2; dx++) {
          const wx = dx === 0 ? 1 - fx : fx;
          acc +=
            hash4i(xi + dx, yi + dy, zi + dz, wi + dw, seed) * wx * wy * wz * ww;
        }
      }
    }
  }
  return acc;
};

/** Two octaves of 4D noise — enough texture without a visible base frequency. */
export const fbm4 = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed = 1,
) =>
  noise4(x, y, z, w, seed) * 0.68 +
  noise4(x * 2.13, y * 2.13, z * 2.13, w * 2.13, seed + 17) * 0.32;
