/**
 * Height field that drives the pins. Pure function of grid position and loop
 * phase, so every frame is deterministic and the animation loops seamlessly.
 */

// Small deterministic value noise (no dependency, same output everywhere).
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

const smooth = (t: number) => t * t * (3 - 2 * t);

export const valueNoise = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export type FieldParams = {
  /** Wavelength of the travelling bands, in grid cells. */
  wavelength: number;
  /** Direction the bands travel (radians, in the grid plane). */
  direction: number;
  /** Strength of the static domain warp that bends the bands. */
  warp: number;
  /** Scale of the warp noise, in grid cells. */
  warpScale: number;
  /** Radial ripple mixed in around this centre (grid cells). */
  rippleCenter: [number, number];
  rippleWavelength: number;
  rippleMix: number;
  /** Ripple travel relative to the bands. The loop stays seamless when
   *  (band cycles per loop) x rippleSpeed is an integer; negative values
   *  travel the opposite way. */
  rippleSpeed: number;
  /** Threshold band that turns the sine into raised / flat zones. */
  edge0: number;
  edge1: number;
};

/**
 * Returns 0 (flat) .. 1 (fully raised) for a grid cell at loop phase
 * `phase` (0..1 = one full wavelength of travel).
 */
export const heightAt = (
  x: number,
  y: number,
  phase: number,
  p: FieldParams,
): number => {
  const tau = Math.PI * 2;
  const dx = Math.cos(p.direction);
  const dy = Math.sin(p.direction);
  const warp =
    (valueNoise(x / p.warpScale + 13.1, y / p.warpScale + 7.7) - 0.5) *
    p.warp *
    tau;
  const along = (x * dx + y * dy) / p.wavelength;
  const band = Math.sin(tau * (along - phase) + warp);
  const rx = x - p.rippleCenter[0];
  const ry = y - p.rippleCenter[1];
  const r = Math.sqrt(rx * rx + ry * ry) / p.rippleWavelength;
  const ripple = Math.sin(tau * (r - phase * p.rippleSpeed) + warp * 0.5);
  const v = 0.5 + 0.5 * ((1 - p.rippleMix) * band + p.rippleMix * ripple);
  return smoothstep(p.edge0, p.edge1, v);
};
