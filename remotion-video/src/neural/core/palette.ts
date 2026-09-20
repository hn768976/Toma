/** Linear RGB triples, matched by eye against the reference frames. */
export type Rgb = readonly [number, number, number];

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const scaleRgb = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/**
 * V1 -- "Abstract AI neural network".
 * Cool blue-white fibres on near-black; the warm accents live in the bokeh
 * rather than in the strands themselves.
 */
export const V1 = {
  background: "#02040a",
  haze: "#060e24",
  fibreCore: [0.55, 0.75, 1.0] as Rgb,
  fibreBody: [0.13, 0.35, 0.95] as Rgb,
  fibreDeep: [0.05, 0.13, 0.46] as Rgb,
  nodeFlare: [0.85, 0.92, 1.0] as Rgb,
  dotCool: [0.55, 0.78, 1.0] as Rgb,
  dotWhite: [1.0, 0.98, 0.94] as Rgb,
  dotWarm: [1.0, 0.62, 0.22] as Rgb,
  bokehWarm: "#ff9c3d",
  bokehCool: "#5f9dff",
  bokehWhite: "#dbe8ff",
} as const;

/**
 * V2 -- "Loopable isometric branching network".
 * Deeper navy, more saturated cyan, a mint-green spine highlight and a thin
 * red-orange minority strand set.
 */
export const V2 = {
  background: "#02050f",
  haze: "#0a1a44",
  fibreCore: [0.70, 0.95, 1.0] as Rgb,
  fibreBody: [0.14, 0.52, 1.0] as Rgb,
  fibreDeep: [0.05, 0.20, 0.72] as Rgb,
  fibreSpine: [0.55, 1.0, 0.82] as Rgb,
  fibreWarm: [1.0, 0.30, 0.26] as Rgb,
  nodeFlare: [0.78, 0.95, 1.0] as Rgb,
  dotCool: [0.6, 0.86, 1.0] as Rgb,
  dotWhite: [0.92, 0.97, 1.0] as Rgb,
  bokehWarm: "#ff6a4a",
  bokehCool: "#4aa8ff",
  bokehWhite: "#cfe6ff",
} as const;
