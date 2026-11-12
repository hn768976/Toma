import { AURORA_HEADS, AURORA_SEQUENCE, REFERENCE_HEADS, REFERENCE_SEQUENCE, RGB, Theme } from "./palettes";

export type FiberVariant = {
  id: string;
  seed: number;
  sequence: Theme[];
  heads: RGB[];
  /** Floor / background haze tint (added black level). */
  lift: [number, number, number];
  saturation: number;
  exposure: number;
};

/** Version 1 — reference match: rainbow / orange / ice / magenta light waves. */
export const referenceVariant: FiberVariant = {
  id: "v1",
  seed: 11,
  sequence: REFERENCE_SEQUENCE,
  heads: REFERENCE_HEADS,
  lift: [0.03, 0.02, 0.035],
  saturation: 1.0,
  exposure: 1.7,
};

/** Version 2 — same scene and camera, alternative "Aurora" emerald/teal/gold palette. */
export const auroraVariant: FiberVariant = {
  id: "v2",
  seed: 11,
  sequence: AURORA_SEQUENCE,
  heads: AURORA_HEADS,
  lift: [0.012, 0.03, 0.03],
  saturation: 1.0,
  exposure: 1.7,
};
