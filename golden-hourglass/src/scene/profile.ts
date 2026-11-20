import { SHAPE, TIMING } from "../config";
import { clamp } from "../lib/rng";

/** radius of the glass at height y (neck at y = 0) */
export const glassRadius = (y: number) => {
  if (y >= 0) return Math.sqrt(SHAPE.neckRadius ** 2 + (SHAPE.upperSlope * y) ** 2);
  return (
    Math.sqrt(SHAPE.neckRadius ** 2 + (SHAPE.lowerSlope * y) ** 2) +
    SHAPE.lowerShoulder * (1 - Math.exp(y / SHAPE.lowerShoulderFall))
  );
};

/** outward surface normal of the glass at height y and angle phi (radians, 0 = towards +z, + = towards +x) */
export const glassNormal = (y: number, phi: number): [number, number, number] => {
  const e = 1e-3;
  const dr = (glassRadius(y + e) - glassRadius(y - e)) / (2 * e);
  const n = Math.hypot(1, dr);
  return [Math.sin(phi) / n, -dr / n, Math.cos(phi) / n];
};

export const glassPoint = (y: number, phi: number): [number, number, number] => {
  const r = glassRadius(y);
  return [Math.sin(phi) * r, y, Math.cos(phi) * r];
};

/**
 * Sand in the upper bulb: the surface is a shallow crater, y = apex + slope * r.
 * Volume leaves at a constant rate, and a cone's volume goes with height cubed,
 * so the apex height follows a cube-root curve and the level drops faster and faster.
 */
export const sandApex = (t: number) => {
  const k = clamp(1 - t / TIMING.sandEmpty, 0, 1);
  const off = SHAPE.neckRadius / SHAPE.upperSlope;
  return (SHAPE.sandStartApex + off) * Math.cbrt(k) - off;
};

/** radius where the sand surface meets the glass */
export const sandRimRadius = (apex: number) => {
  // solve apex + slope * r = y_wall(r), with the wall r = sqrt(n^2 + (a y)^2)
  let lo = 0, hi = 3;
  for (let i = 0; i < 40; i++) {
    const r = (lo + hi) / 2;
    const y = apex + SHAPE.sandSlope * r;
    const wall = y > 0 ? glassRadius(y) : SHAPE.neckRadius * 0.999;
    if (wall > r) lo = r; else hi = r;
  }
  return (lo + hi) / 2;
};

/** sand surface height at radius r (rounded at the bottom of the crater) */
export const sandSurface = (apex: number, r: number) =>
  apex + SHAPE.sandSlope * (Math.sqrt(r * r + 0.004) - 0.063);
