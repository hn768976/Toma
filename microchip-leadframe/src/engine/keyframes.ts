/** A keyframe track: [time in seconds, value]. Times must be increasing. */
export type Track = ReadonlyArray<readonly [number, number]>;

/**
 * Smooth interpolation through non-uniformly spaced keys
 * (cubic Hermite with finite-difference tangents, clamped at both ends).
 */
export const sampleTrack = (track: Track, t: number): number => {
  const n = track.length;
  if (t <= track[0][0]) return track[0][1];
  if (t >= track[n - 1][0]) return track[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > track[i + 1][0]) i++;
  const [t0, v0] = track[i];
  const [t1, v1] = track[i + 1];
  const slope = (a: number, b: number) =>
    (track[b][1] - track[a][1]) / (track[b][0] - track[a][0]);
  const m0 = i === 0 ? slope(0, 1) : 0.5 * (slope(i - 1, i) + slope(i, i + 1));
  const m1 =
    i + 1 === n - 1
      ? slope(n - 2, n - 1)
      : 0.5 * (slope(i, i + 1) + slope(i + 1, i + 2));
  const h = t1 - t0;
  const u = (t - t0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * v0 +
    (u3 - 2 * u2 + u) * h * m0 +
    (-2 * u3 + 3 * u2) * v1 +
    (u3 - u2) * h * m1
  );
};

/** Piecewise-linear interpolation (no easing, no overshoot), clamped. */
export const sampleLinear = (track: Track, t: number): number => {
  const n = track.length;
  if (t <= track[0][0]) return track[0][1];
  if (t >= track[n - 1][0]) return track[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > track[i + 1][0]) i++;
  const [t0, v0] = track[i];
  const [t1, v1] = track[i + 1];
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
};
