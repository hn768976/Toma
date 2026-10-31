import type { PostParams } from "./post";

export type Palette = {
  name: string;
  oceanDeep: string;
  ocean: string;
  landLow: string;
  landHigh: string;
  landSpec: string;
  fog: string;
  background: string;
  cityDot: string;
  arcCore: string;
  arcGlow: string;
  post: Partial<PostParams>;
};

/** V1 — matches the reference: monochrome electric blue relief map on navy. */
export const BLUE: Palette = {
  name: "blue",
  oceanDeep: "#0b1a2b",
  ocean: "#1a3653",
  landLow: "#0a5c98",
  landHigh: "#2a9ada",
  landSpec: "#bfe2ff",
  fog: "#173e62",
  background: "#061227",
  cityDot: "#e8f6ff",
  arcCore: "#f2fbff",
  arcGlow: "#7cc4ff",
  post: { tint: [1, 1, 1], lift: [0.0, 0.012, 0.03], gain: [1, 1, 1], saturation: 1.0 },
};

/** V2 — alternative palette: warm amber / gold relief on a deep umber ocean. */
export const AMBER: Palette = {
  name: "amber",
  oceanDeep: "#150a05",
  ocean: "#3a1d0e",
  landLow: "#74340c",
  landHigh: "#c27324",
  landSpec: "#ffe2b0",
  fog: "#40200c",
  background: "#120804",
  cityDot: "#fff4e0",
  arcCore: "#fff7e8",
  arcGlow: "#ffb35c",
  post: { tint: [1, 1, 1], lift: [0.025, 0.01, 0.0], gain: [1, 1, 1], saturation: 1.0 },
};

export const PALETTES = { blue: BLUE, amber: AMBER } as const;
export type PaletteName = keyof typeof PALETTES;
