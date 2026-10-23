export type RGB = readonly [number, number, number];

export type Palette = {
  bgDeep: RGB; // darkest background (bottom-left)
  bgLift: RGB; // background tone towards the light source
  source: RGB; // out-of-frame light source glow (top-right)
  rail: RGB; // track/plate edge color
  railCore: RGB; // hot core of the brightest track lines
  strandLow: RGB; // wave strands near the track
  strandHigh: RGB; // wave strand tips
  bloom: RGB; // tint of the bloom pass
};

// Version 1: electric blue, matching the reference.
export const bluePalette: Palette = {
  bgDeep: [2, 5, 18],
  bgLift: [16, 32, 92],
  source: [70, 130, 255],
  rail: [40, 110, 255],
  railCore: [150, 205, 255],
  strandLow: [60, 140, 255],
  strandHigh: [165, 210, 255],
  bloom: [40, 100, 255],
};

// Version 2: "ember" - magenta to amber neon on a deep plum night.
export const emberPalette: Palette = {
  bgDeep: [12, 2, 10],
  bgLift: [58, 10, 52],
  source: [255, 120, 60],
  rail: [255, 50, 130],
  railCore: [255, 205, 150],
  strandLow: [255, 70, 150],
  strandHigh: [255, 175, 70],
  bloom: [255, 60, 110],
};

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const rgba = (c: RGB, a: number) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a))})`;
