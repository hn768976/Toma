import { interpolate } from "remotion";

export type Keys = readonly (readonly [number, number])[];

/** Smoothly interpolated value at time `t` (seconds) from [time, value] keys. */
export const sampleKeys = (keys: Keys, t: number): number => {
  const times = keys.map((k) => k[0]);
  const values = keys.map((k) => k[1]);
  // Cosine-eased piecewise interpolation between keys.
  const i = Math.max(
    0,
    Math.min(times.length - 2, times.findIndex((x) => x > t) - 1),
  );
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];
  const local = interpolate(t, [times[i], times[i + 1]], [0, 1]);
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * local);
  return values[i] + (values[i + 1] - values[i]) * eased;
};

/** Numerically integrate a keyed speed curve from 0 to t (seconds). */
export const integrateKeys = (keys: Keys, t: number, step = 1 / 120) => {
  let sum = 0;
  for (let x = 0; x < t; x += step) {
    const h = Math.min(step, t - x);
    sum += sampleKeys(keys, x + h / 2) * h;
  }
  return sum;
};
