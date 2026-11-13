export type Palette = {
  deep: string; // nucleus crevices
  mid: string; // nucleus body
  rim: string; // nucleus highlights
  tint: string; // membrane body
  memRim: string; // membrane edge
  fog: string; // depth haze
  bgA: string; // backdrop edge
  bgB: string; // backdrop body
  bgC: string; // backdrop light source
  lift: [number, number, number];
  saturation: number;
};

// Version 1 - the reference look: cyan / azure liquid, navy nuclei.
export const AZURE: Palette = {
  deep: "#03103a",
  mid: "#1f5f8f",
  rim: "#cdf6ff",
  tint: "#49b6f2",
  memRim: "#e2fbff",
  fog: "#2a9be0",
  bgA: "#0a5fae",
  bgB: "#0d96e2",
  bgC: "#74d6ff",
  lift: [0, 0, 0],
  saturation: 1.05,
};

// Version 2 - alternative palette: magenta / orchid liquid, plum nuclei
// with warm peach highlights.
export const ORCHID: Palette = {
  deep: "#2c0638",
  mid: "#a23a86",
  rim: "#ffe3d2",
  tint: "#f27ac0",
  memRim: "#fff0ea",
  fog: "#c8409c",
  bgA: "#5a0f6e",
  bgB: "#cf3a98",
  bgC: "#ffb48a",
  lift: [0.004, 0, 0.006],
  saturation: 1.05,
};
