/**
 * Camera paths for the golden-bokeh plate. All positions are in frame
 * heights on the virtual plate; time is in seconds.
 */

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
  roll: number;
  parallax: number;
};

// Tilt of the reference, in plate travel (frame heights) every 2 s. Measured
// by tracking the gold/sky boundary in the reference footage: eases in,
// keeps a steady pace through the middle, then settles on open sky.
const TILT_KEYS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [2, 0.055],
  [4, 0.12],
  [6, 0.225],
  [8, 0.33],
  [10, 0.41],
  [12, 0.5],
  [14, 0.58],
  [16, 0.68],
  [18, 0.8],
  [20, 0.93],
  [22, 1.04],
  [24, 1.12],
  [26, 1.17],
  [28, 1.19],
];

// Monotone cubic (Fritsch-Carlson) interpolation: smooth, no overshoot.
const tangents = (() => {
  const n = TILT_KEYS.length;
  const d = TILT_KEYS.slice(0, -1).map(
    ([t0, v0], i) => (TILT_KEYS[i + 1][1] - v0) / (TILT_KEYS[i + 1][0] - t0),
  );
  const m = TILT_KEYS.map((_, i) =>
    i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return m;
})();

const tiltAt = (t: number) => {
  const last = TILT_KEYS.length - 1;
  if (t <= TILT_KEYS[0][0]) return TILT_KEYS[0][1];
  if (t >= TILT_KEYS[last][0]) return TILT_KEYS[last][1];
  let i = 0;
  while (t > TILT_KEYS[i + 1][0]) i++;
  const [t0, v0] = TILT_KEYS[i];
  const [t1, v1] = TILT_KEYS[i + 1];
  const h = t1 - t0;
  const s = (t - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * v0 +
    (s3 - 2 * s2 + s) * h * tangents[i] +
    (-2 * s3 + 3 * s2) * v1 +
    (s3 - s2) * h * tangents[i + 1]
  );
};

/** Plate height where the tilt comes to rest (the sky is laid out from it). */
export const TILT_END = TILT_KEYS[TILT_KEYS.length - 1][1];

/** Version 1: vertical tilt-up, as in the reference (no parallax: rotation). */
export const tiltUp = (t: number): CameraState => {
  const y = tiltAt(t);
  return {
    x: -0.05 * (y / TILT_END),
    y,
    zoom: 1,
    roll: 0,
    parallax: 0,
  };
};

const smootherstep = (x: number) => {
  const c = Math.min(Math.max(x, 0), 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/**
 * Version 2: a rising diagonal crane. The camera physically travels up and
 * to the right while pushing in and rolling level, so the bokeh layers slide
 * past each other with depth parallax before it settles on the sky.
 */
export const craneRise = (t: number): CameraState => {
  const s = smootherstep(t / 26);
  return {
    x: 0.55 * s - 0.25,
    y: tiltAt(t),
    zoom: 1.0 + 0.22 * s,
    roll: -0.06 * (1 - s) + 0.012 * Math.sin(t * 0.35),
    parallax: 0.9,
  };
};
