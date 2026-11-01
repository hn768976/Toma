/**
 * Animation curves traced frame-by-frame from the reference
 * (277 frames). Keys are [frame, value]; values between keys use a
 * monotone cubic (Fritsch-Carlson) so motion is smooth with no
 * overshoot or stalls at keyframes.
 */
type Keys = [number, number][];

const monotone = (keys: Keys) => {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
};

// Outer radius of the blast, in frame heights.
const radius = monotone([
  [0, 0.0], [1, 0.08], [3, 0.145], [6, 0.21], [10, 0.265], [14, 0.305],
  [18, 0.34], [22, 0.38], [26, 0.435], [30, 0.485], [35, 0.56], [40, 0.635],
  [50, 0.76], [70, 0.95], [100, 1.04], [160, 1.12], [276, 1.2],
]);

// Radius of the dark hole in the middle, in frame heights.
const hole = monotone([
  [0, 0.0], [1, 0.02], [10, 0.065], [20, 0.11], [35, 0.14], [70, 0.13],
  [130, 0.2], [200, 0.27], [276, 0.32],
]);

// Incandescence 1 = white-hot, 0 = cold smoke.
const heat = monotone([
  [0, 1], [40, 1], [55, 0.92], [70, 0.78], [90, 0.62], [110, 0.45],
  [130, 0.3], [150, 0.13], [170, 0.03], [190, 0], [276, 0],
]);

// Smoke presence once the fire is gone; fades to nothing by the end.
const smoke = monotone([
  [0, 1],
  [130, 1],
  [165, 0.78],
  [200, 0.5],
  [235, 0.26],
  [262, 0.08],
  [276, 0.0],
]);

// How much the smoke tears into clumps.
const thin = monotone([
  [0, 0], [90, 0], [120, 0.3], [160, 0.5], [220, 0.6], [276, 0.7],
]);

// Turbulence of the domain warp: tight ring early, churning later.
const warp = monotone([
  [0, 0.04], [12, 0.06], [35, 0.1], [70, 0.16], [140, 0.19], [276, 0.2],
]);

const spin = monotone([
  [0, 0],
  [40, -0.35],
  [120, -0.75],
  [276, -1.05],
]);

// Centre of mass drifts slightly to the right as the blast grows.
const driftX = monotone([
  [0, 0], [30, 0.03], [60, 0.06], [276, 0.07],
]);

export const sampleTimeline = (frame: number) => ({
  R: radius(frame),
  Rh: hole(frame),
  heat: heat(frame),
  smoke: smoke(frame),
  thin: thin(frame),
  warp: warp(frame),
  spin: spin(frame),
  cx: driftX(frame),
});
