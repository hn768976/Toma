import { clamp } from "../lib/random";

export type Key = [number, number];
/** Piecewise interpolation with smoothstep easing between keys. */
export const track = (keys: Key[], f: number) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (f <= f1) {
      const t = clamp((f - f0) / (f1 - f0));
      const e = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * e;
    }
  }
  return keys[keys.length - 1][1];
};

export type Vec2Key = [number, number, number]; // frame, screen x, screen y (-1..1)
export const track2 = (keys: Vec2Key[], f: number): [number, number] => [
  track(keys.map((k) => [k[0], k[1]]), f),
  track(keys.map((k) => [k[0], k[2]]), f),
];

/**
 * Light pockets inside the (almost static) sphere field. Positions are in
 * screen space (-1..1, y up) and were keyed from the reference: where and
 * when the swarm lights up. Energies follow the reference's per-frame
 * luminance curve: wave 1 builds from ~0.3 s, peaks ~2.8–3.3 s and cuts
 * out at 3.6 s; the second half lights pockets at the frame edges
 * (top-left ~4.8 s, bottom-left ~5.3–5.9 s, bottom-right ~6.4 s, left ~6.9 s)
 * and fades to black by 8.2 s.
 */
export type LightDef = { path: Vec2Key[]; energy: Key[]; depth: number; gain?: number };

export const LIGHTS: LightDef[] = [
  {
    // main wave 1: enters top-left, settles left/centre, sinks to the bottom
    depth: -5.9,
    path: [
      [0, -1.25, 1.15],
      [16, -0.78, 0.82],
      [32, -0.78, 0.0],
      [48, -0.2, 0.42],
      [64, -0.55, 0.12],
      [80, -0.42, -0.25],
      [96, -0.12, -0.42],
      [112, 0.5, -0.6],
    ],
    energy: [
      [0, 0],
      [6, 0.3],
      [16, 0.62],
      [32, 0.92],
      [44, 0.72],
      [56, 0.66],
      [68, 0.9],
      [80, 1.05],
      [96, 1.05],
      [102, 0.65],
      [106, 0.25],
      [112, 0.06],
      [120, 0],
    ],
  },
  {
    // wave 1 companion on the right (f60–100)
    depth: -5.9,
    path: [
      [40, 0.9, 0.6],
      [64, 0.82, 0.25],
      [80, 0.62, 0.66],
      [100, 0.75, 0.38],
    ],
    energy: [
      [58, 0],
      [72, 0.45],
      [84, 0.75],
      [96, 0.55],
      [104, 0.1],
      [110, 0],
    ],
  },
  {
    // top-left pocket around f144
    depth: -5.9,
    gain: 1.7,
    path: [
      [128, -0.6, 0.65],
      [160, -0.45, 0.8],
    ],
    energy: [
      [128, 0],
      [138, 0.2],
      [144, 0.32],
      [152, 0.2],
      [160, 0.05],
      [166, 0],
    ],
  },
  {
    // bottom-left burst f160–190, drifting to the left edge by f208
    depth: -5.9,
    gain: 1.7,
    path: [
      [150, -0.95, -0.85],
      [176, -0.55, -0.5],
      [192, -0.7, -0.65],
      [208, -0.85, 0.0],
      [224, -0.6, 0.2],
    ],
    energy: [
      [150, 0],
      [160, 0.38],
      [170, 1.0],
      [178, 1.15],
      [188, 0.5],
      [198, 0.24],
      [208, 0.28],
      [216, 0.08],
      [224, 0.0],
      [232, 0],
    ],
  },
  {
    // right side: small at f160, bottom-right at f192, right edge at f240
    depth: -5.9,
    gain: 1.7,
    path: [
      [150, 0.6, 0.55],
      [180, 0.7, -0.5],
      [192, 0.55, -0.6],
      [210, 0.6, -0.4],
      [240, 0.78, -0.3],
    ],
    energy: [
      [150, 0],
      [158, 0.14],
      [166, 0.06],
      [180, 0.22],
      [192, 0.46],
      [202, 0.24],
      [214, 0.07],
      [228, 0.0],
      [234, 0.04],
      [240, 0.1],
      [247, 0],
    ],
  },
  {
    // small central pocket around f224
    depth: -5.9,
    gain: 1.7,
    path: [
      [212, 0.0, 0.35],
      [236, 0.1, 0.42],
    ],
    energy: [
      [212, 0],
      [222, 0.09],
      [230, 0.03],
      [238, 0],
    ],
  },
];

/** Subtle deterministic strobe of the light, like the reference. */
export const flicker = (frame: number) => {
  const h = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const v = 0.6 * h(frame) + 0.4 * h(frame - 1);
  return 1 + (v - 0.5) * 0.3;
};
