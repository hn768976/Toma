type Vec3 = [number, number, number];

export type BeamPalette = {
  tintBeam: Vec3;
  tintDeep: Vec3;
  tintCore: Vec3;
  tintFlare: Vec3;
};

/** Version 1: electric cyan / deep blue, matching the reference. */
export const ICE_BLUE: BeamPalette = {
  tintBeam: [0.03, 1.35, 2.6],
  tintDeep: [0.0, 0.35, 1.9],
  tintCore: [1.0, 1.2, 1.35],
  tintFlare: [0.12, 0.95, 1.45],
};

/** Version 2: solar amber / crimson alternative palette. */
export const SOLAR_AMBER: BeamPalette = {
  tintBeam: [2.6, 1.15, 0.05],
  tintDeep: [1.9, 0.28, 0.02],
  tintCore: [1.35, 1.2, 1.0],
  tintFlare: [1.5, 0.85, 0.12],
};
