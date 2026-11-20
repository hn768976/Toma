import { SAND_KEYS, SHAPE } from "../config";
import { keyframes } from "../lib/rng";

/** radius of the glass at height y (neck at y = 0) */
export const glassRadius = (y: number) => {
  const h = SHAPE.neckHalfHeight;
  if (y >= 0) return Math.sqrt(SHAPE.neckRadius ** 2 + (SHAPE.upperSlope * Math.max(y - h, 0)) ** 2);
  y = Math.min(y + h, 0);
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

/** Sand in the upper bulb at time t: where it meets the glass, and the bottom of its crater. */
export const sandState = (t: number) => {
  const rimY = keyframes(SAND_KEYS.map((k) => [k.t, k.rim] as [number, number]), t);
  const apex = Math.min(keyframes(SAND_KEYS.map((k) => [k.t, k.apex] as [number, number]), t), rimY - 0.02);
  return { rimY, apex, rimR: glassRadius(rimY) };
};

/** sand surface height at radius r: a dish that deepens into a funnel */
export const sandSurface = (s: { rimY: number; apex: number; rimR: number }, r: number) =>
  s.apex + (s.rimY - s.apex) * Math.pow(Math.min(r / s.rimR, 1), 1.35);
