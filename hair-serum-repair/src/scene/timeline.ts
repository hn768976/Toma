/**
 * All timing lives here. Values are keyed in frames at 30 fps and were
 * measured from the reference clip (251 frames).
 */

type Key = [frame: number, value: number];

/** Monotone cubic (PCHIP) interpolation through keyframes – smooth, no overshoot */
export const curve = (keys: Key[], x: number): number => {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][1];
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(keys[i + 1][0] - keys[i][0]);
    d.push((keys[i + 1][1] - keys[i][1]) / h[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  let i = 0;
  while (x > keys[i + 1][0]) i++;
  const t = (x - keys[i][0]) / h[i];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * keys[i][1] +
    (t3 - 2 * t2 + t) * h[i] * m[i] +
    (-2 * t3 + 3 * t2) * keys[i + 1][1] +
    (t3 - t2) * h[i] * m[i + 1]
  );
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Continuous push-in on the strand
const CAMERA_DISTANCE: Key[] = [
  [0, 39],
  [40, 26],
  [75, 17.8],
  [125, 15.2],
  [180, 12.0],
  [250, 11.4],
];

// Droplet centre (world units, hair radius = 1)
const DROP_X: Key[] = [
  [0, -5.5],
  [40, -3.75],
  [72, -2.75],
  [90, -1.8],
  [110, -0.85],
  [150, -0.4],
];
const DROP_Y: Key[] = [
  [0, 2.0],
  [40, 1.0],
  [72, 0.42],
  [90, 0.3],
  [110, 0.4],
  [150, 0.5],
];
// The droplet travels in front of the strand, then settles onto its surface
const DROP_Z: Key[] = [
  [0, 1.35],
  [80, 1.35],
  [112, 0.8],
  [128, 0.72],
  [150, 0.5],
];

export type Timeline = {
  cameraDistance: number;
  dropX: number;
  dropY: number;
  dropZ: number;
  /** 0 = flying freely, 1 = lying flat on the strand's surface */
  dropSettle: number;
  /** squash along the hair normal / stretch along the strand */
  dropScaleNormal: number;
  dropScaleTangent: number;
  dropOpacity: number;
  haloStrength: number;
  /** half-length of the repaired section, in world units along the strand */
  repairFront: number;
  gridStrength: number;
  /** how far behind the repair front the grid starts */
  gridFront: number;
  exposure: number;
  /** the strand starts in shadow and is lit as the camera pushes in */
  cuticleLight: number;
  backgroundZoom: number;
  backgroundDrift: number;
  /** horizontal framing: the camera drifts onto the strand as it pushes in */
  cameraX: number;
};

export const getTimeline = (f: number): Timeline => {
  // the lens keeps its footprint while it flattens and sinks into the strand
  const absorb = smooth(112, 138, f);
  return {
    cameraDistance: curve(CAMERA_DISTANCE, f),
    dropX: curve(DROP_X, f),
    dropY: curve(DROP_Y, f),
    dropZ: curve(DROP_Z, f),
    dropSettle: smooth(80, 114, f),
    dropScaleNormal:
      curve(
        [
          [0, 1],
          [76, 1],
          [92, 0.93],
          [104, 0.7],
          [116, 0.34],
          [132, 0.24],
        ],
        f,
      ) *
      (1 - 0.7 * absorb),
    dropScaleTangent:
      curve(
        [
          [0, 1],
          [76, 1],
          [108, 1.08],
          [118, 1.04],
        ],
        f,
      ) *
      (1 - 0.5 * absorb),
    dropOpacity: 1 - smooth(120, 135, f),
    haloStrength: smooth(58, 88, f) * (1 - smooth(100, 146, f)),
    repairFront:
      f < 102 ? 0 : 0.9 * smooth(102, 112, f) + Math.max(0, f - 108) * 0.078,
    gridStrength:
      smooth(122, 150, f) *
      (0.72 + 0.28 * smooth(160, 190, f)) *
      (1 - smooth(197, 235, f)),
    gridFront: Math.max(0, f - 120) * 0.14,
    exposure: 0.62 + 0.38 * smooth(0, 42, f),
    cuticleLight: 0.38 + 0.62 * smooth(6, 60, f),
    cameraX: curve(
      [
        [0, -1.3],
        [110, -1.0],
        [180, -0.55],
        [250, -0.5],
      ],
      f,
    ),
    backgroundDrift: 0.16 * smooth(-20, 62, f) + 0.00012 * f,
    backgroundZoom: curve(
      [
        [0, 1],
        [60, 1.3],
        [250, 1.42],
      ],
      f,
    ),
  };
};
