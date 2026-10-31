/**
 * Timeline for the Neon Tunnel composition.
 *
 * The reference clip runs at 25 fps (328 frames = 13.12 s). Its lighting is a
 * frame-accurate flicker sequence, so the light states are authored here on the
 * reference's 25 fps grid and sampled from the 30 fps composition by time.
 *
 * Light states:
 *  '0' dark
 *  '1' back rectangle only
 *  'd' back rectangle, dim flicker
 *  '2' back rectangle + middle ring
 *  '3' all rings + wall spill (fully lit corridor)
 *  'f' short flash of the back rectangle while the camera is heavily rolled
 *  'g' glitch flash with lens warp
 *  'e' ending (last cycle): back rectangle + slowly fading middle ring
 */

export const REF_FPS = 25;
export const REF_FRAMES = 328;

type LightState = "0" | "1" | "d" | "2" | "3" | "f" | "g" | "e";
type Range = [number, number, LightState];

const cycle1: Range[] = [
  [15, 15, "1"],
  [17, 17, "1"],
  [18, 18, "2"],
  [20, 20, "2"],
  [21, 26, "3"],
  [27, 27, "2"],
  [28, 29, "3"],
  [30, 30, "2"],
  [31, 49, "3"],
  [50, 50, "2"],
  [51, 51, "3"],
  [52, 57, "2"],
  [58, 59, "1"],
  [60, 60, "2"],
  [61, 61, "1"],
  [62, 62, "2"],
  [63, 66, "1"],
  [68, 68, "1"],
  [71, 71, "d"],
];

// Cycles 2 and 3 share the same pattern (cycle 3 starts exactly 88 ref frames later).
const middleCycle: Range[] = [
  [0, 1, "f"],
  [3, 3, "f"],
  [12, 12, "1"],
  [14, 15, "1"],
  [17, 17, "1"],
  [18, 24, "2"],
  [25, 26, "3"],
  [27, 27, "2"],
  [28, 46, "3"],
  [47, 47, "2"],
  [48, 48, "3"],
  [49, 54, "2"],
  [55, 63, "1"],
  [65, 65, "1"],
  [68, 68, "d"],
];
const shift = (r: Range[], by: number): Range[] =>
  r.map(([a, b, s]) => [a + by, b + by, s]);

const cycle4: Range[] = [
  [260, 262, "g"],
  [264, 264, "f"],
  [273, 273, "1"],
  [275, 276, "1"],
  [278, 278, "1"],
  [279, 324, "e"],
  [326, 326, "e"],
];

const STATES: LightState[] = (() => {
  const s: LightState[] = new Array(REF_FRAMES).fill("0");
  const all = [
    ...cycle1,
    ...shift(middleCycle, 89),
    ...shift(middleCycle, 177),
    ...cycle4,
  ];
  for (const [a, b, st] of all) {
    for (let i = a; i <= b; i++) s[i] = st;
  }
  return s;
})();

const cycleOf = (n: number) => (n < 80 ? 0 : n < 170 ? 1 : n < 255 ? 2 : 3);

type Key = [number, number];

/** Piecewise-linear interpolation over [refFrame, value] keys. */
const sample = (keys: Key[], t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      // smoothstep inside each segment keeps velocity continuous-looking
      const e = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * (0.35 * u + 0.65 * e);
    }
  }
  return keys[keys.length - 1][1];
};

// Camera roll in degrees (positive = clockwise on screen), measured from the reference.
const ROLL: Key[][] = [
  [
    [0, -6],
    [15, -6],
    [20, -4.2],
    [24, -3.5],
    [32, -2],
    [40, -1],
    [50, 0],
    [80, 0],
  ],
  [
    [80, 64],
    [89, 64],
    [92, 57],
    [101, 9],
    [104, 6.3],
    [108, 3.8],
    [112, 2],
    [116, 1.4],
    [120, 0.6],
    [128, 0],
    [170, 0],
  ],
  [
    [170, 64],
    [177, 64],
    [180, 57],
    [189, 9],
    [192, 6.3],
    [196, 3.8],
    [200, 2],
    [204, 1.4],
    [208, 0.6],
    [216, 0],
    [255, 0],
  ],
  [
    [255, 63],
    [260, 63],
    [264, 54],
    [273, 7],
    [276, 4.4],
    [280, 2.9],
    [284, 1.4],
    [288, 0.8],
    [296, 0],
    [328, 0],
  ],
];

// Camera distance offset (+ = further back from the back wall).
const DOLLY: Key[][] = [
  [
    [0, 0.55],
    [15, 0.55],
    [20, 0.51],
    [24, 0.45],
    [48, 0.19],
    [68, 0.04],
    [80, 0.0],
  ],
  [
    [80, -0.1],
    [110, -0.06],
    [150, 0.14],
    [170, 0.16],
  ],
  [
    [170, -0.1],
    [198, -0.06],
    [238, 0.14],
    [255, 0.16],
  ],
  [
    [255, -0.3],
    [276, -0.36],
    [328, -0.38],
  ],
];

// Focal length (zoom). The last cycle slowly zooms in.
// The rolled flash at the start of cycles 2-4 is seen zoomed out (the rectangle is
// ~25-28 % of the frame width instead of ~40 %), then the camera snaps back in.
const FOCAL: Key[][] = [
  [[0, 1.545]],
  [
    [80, 0.98],
    [89, 0.98],
    [92, 1.0],
    [101, 1.42],
    [104, 1.545],
  ],
  [
    [170, 0.98],
    [177, 0.98],
    [180, 1.0],
    [189, 1.42],
    [192, 1.545],
  ],
  [
    [255, 0.78],
    [262, 0.8],
    [264, 0.91],
    [273, 1.25],
    [276, 1.38],
    [280, 1.41],
    [316, 1.78],
    [328, 1.9],
  ],
];

export type TunnelParams = {
  roll: number; // radians
  camZ: number;
  focal: number;
  ring0: number;
  ring1: number;
  ring2: number;
  fill: number;
  warp: number;
};

const lightLevels = (n: number) => {
  const st = STATES[Math.max(0, Math.min(REF_FRAMES - 1, n))];
  const c = cycleOf(n);
  // per-cycle strength of the middle ring, near ring and wall spill: the light "dies" over time
  const mid = [0.85, 0.8, 0.58, 0.2][c];
  const near = [1.0, 0.56, 0.42, 0][c];
  let fill = [1.45, 0.5, 0.36, 0][c];
  if (c === 0 && n >= 31 && n <= 49) {
    fill *= 1 - 0.45 * ((n - 31) / 18);
  }
  let ring0 = 0;
  let ring1 = 0;
  let ring2 = 0;
  let warp = 0;
  switch (st) {
    case "1":
      ring0 = c === 3 ? 0.6 : 0.8;
      break;
    case "d":
      ring0 = 0.5;
      break;
    case "f":
      ring0 = 0.9;
      break;
    case "g":
      ring0 = 0.42;
      warp = -0.42;
      break;
    case "2":
      ring0 = 1;
      ring1 = mid;
      break;
    case "3":
      ring0 = 1;
      ring1 = mid;
      ring2 = near;
      break;
    case "e": {
      ring0 = n < 316 ? 0.42 : 0.34;
      const fade =
        n < 295 ? 1 : n < 316 ? 0.55 - 0.25 * ((n - 295) / 21) : 0.12;
      ring1 = mid * fade;
      break;
    }
    default:
      break;
  }
  if (st !== "3") fill = 0;
  return { ring0, ring1, ring2, fill, warp };
};

/** Parameters for a composition frame (30 fps). */
export const tunnelParamsAt = (frame: number, fps: number): TunnelParams => {
  const refT = (frame / fps) * REF_FPS; // continuous reference-frame time
  const n = Math.floor(refT + 1e-6);
  const c = cycleOf(n);
  const roll = (sample(ROLL[c], refT) * Math.PI) / 180;
  const camZ = sample(DOLLY[c], refT);
  const focal = sample(FOCAL[c], refT);
  return { roll, camZ, focal, ...lightLevels(n) };
};
