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
  deep: "#04123c",
  mid: "#2f7ba2",
  rim: "#9fe9e6",
  tint: "#5cc4f5",
  memRim: "#d6f8ff",
  fog: "#2f9fe2",
  bgA: "#0b6dbd",
  bgB: "#17a0ea",
  bgC: "#a8eaff",
  lift: [0, 0, 0],
  saturation: 1.04,
};

// Version 2 - alternative palette: magenta / orchid liquid, violet nuclei
// with soft pink highlights.
export const ORCHID: Palette = {
  deep: "#22083f",
  mid: "#8a3f9c",
  rim: "#ffd3e6",
  tint: "#f68fd0",
  memRim: "#ffeaf4",
  fog: "#d655ac",
  bgA: "#7a1c8c",
  bgB: "#e35db3",
  bgC: "#ffc6e6",
  lift: [0.004, 0, 0.006],
  saturation: 1.04,
};
