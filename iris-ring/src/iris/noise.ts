// 4D value noise.
//
// Every animated feature samples this as noise(theta, r, cos(2*PI*t),
// sin(2*PI*t)). Because (cos, sin) traces a closed circle in the zw plane
// over one loop, any field built on it is exactly periodic over the
// composition's duration — that is what makes the loop seamless.

const hash4 = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed: number,
): number => {
  let h =
    Math.imul(x, 0x27d4eb2d) ^
    Math.imul(y, 0x165667b1) ^
    Math.imul(z, 0x9e3779b1) ^
    Math.imul(w, 0x85ebca6b) ^
    Math.imul(seed, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Quintic fade — C2 continuous, so the field has no visible lattice creases.
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Returns roughly -1..1.
export const noise4 = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed = 0,
): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const wi = Math.floor(w);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const fz = fade(z - zi);
  const fw = fade(w - wi);

  let acc = 0;
  // Quadrilinear blend of the 16 lattice corners.
  for (let dw = 0; dw < 2; dw++) {
    const ww = dw === 0 ? 1 - fw : fw;
    for (let dz = 0; dz < 2; dz++) {
      const wz = dz === 0 ? 1 - fz : fz;
      for (let dy = 0; dy < 2; dy++) {
        const wy = dy === 0 ? 1 - fy : fy;
        const h0 = hash4(xi, yi + dy, zi + dz, wi + dw, seed);
        const h1 = hash4(xi + 1, yi + dy, zi + dz, wi + dw, seed);
        acc += lerp(h0, h1, fx) * wy * wz * ww;
      }
    }
  }
  return acc * 2 - 1;
};

// Two-octave variant for the ragged outer edge, where a single octave reads
// too smooth to look like a torn membrane.
export const fbm4 = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed = 0,
): number =>
  noise4(x, y, z, w, seed) * 0.68 +
  noise4(x * 2.7, y * 2.7, z, w, seed + 101) * 0.32;

export const smoothstep = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

export const smootherstep = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (c * 6 - 15) + 10);
};

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
