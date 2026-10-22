import type { Vec3 } from "./FilamentScene";

export type Palette = {
  deep: Vec3;
  mid: Vec3;
  tintA: Vec3;
  tintB: Vec3;
  hot: Vec3;
  bgTop: Vec3;
  bgHorizon: Vec3;
  exposure: number;
};

// Electric blue with cyan / violet core, as in the reference.
export const ELECTRIC_BLUE: Palette = {
  deep: [0.0, 0.04, 0.75],
  mid: [0.02, 0.16, 1.0],
  tintA: [0.0, 0.75, 1.0],
  tintB: [0.5, 0.05, 1.0],
  hot: [0.75, 0.95, 1.0],
  bgTop: [0.001, 0.003, 0.012],
  bgHorizon: [0.006, 0.018, 0.06],
  exposure: 1.6,
};
