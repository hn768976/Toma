import { OUTER_PROFILE, SAND_KEYS, SHAPE } from "../config";
import { keyframes } from "../lib/rng";

/** radius of the outside of the glass at height y (neck at y = 0) */
export const outerRadius = (y: number) => {
  const p = OUTER_PROFILE;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const u = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u;
    }
  }
  return p[p.length - 1][1];
};

/** radius of the cavity inside the glass at height y: this is the wall the sand touches */
export const glassRadius = (y: number) => {
  const h = SHAPE.neckHalfHeight;
  const slope = y >= 0 ? SHAPE.upperSlope : SHAPE.lowerSlope;
  const d = Math.max(Math.abs(y) - h, 0);
  const r = Math.sqrt(SHAPE.neckRadius ** 2 + (slope * d) ** 2);
  return Math.min(r, outerRadius(y) - SHAPE.minWall);
};

export const outerPoint = (y: number, phi: number): [number, number, number] => {
  const r = outerRadius(y);
  return [Math.sin(phi) * r, y, Math.cos(phi) * r];
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

/** Sand in the upper bulb at time t: where it meets the glass, and the bottom of its crater. */
export const sandState = (t: number) => {
  const rimY = keyframes(SAND_KEYS.map((k) => [k.t, k.rim] as [number, number]), t);
  const apex = Math.min(keyframes(SAND_KEYS.map((k) => [k.t, k.apex] as [number, number]), t), rimY - 0.02);
  return { rimY, apex, rimR: glassRadius(rimY) };
};

/** sand surface height at radius r: a dish that deepens into a funnel */
export const sandSurface = (s: { rimY: number; apex: number; rimR: number }, r: number) =>
  s.apex + (s.rimY - s.apex) * Math.pow(Math.min(r / s.rimR, 1), 1.35);
