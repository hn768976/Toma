/**
 * The three plates. Same build, three briefs.
 */

import type { EmberConfig } from "./field";
import { COOL, WARM } from "./palette";

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 15s. Every particle cycle length divides this exactly, so the plate loops. */
export const DURATION = 450;

export type Variant = {
  readonly id: string;
  readonly config: EmberConfig;
};

/** V1 — reference match: fire, campfire, forge, autumn. */
export const V1_WARM: Variant = {
  id: "V1-EmbersWarm",
  config: {
    count: 430,
    palette: WARM,
    riseBoost: 1,
    hazeIntensity: 1,
    seed: 0x1e5c21,
  },
};

/** V2 — magic, frost sparks, fantasy. */
export const V2_COOL: Variant = {
  id: "V2-EmbersCool",
  config: {
    count: 430,
    palette: COOL,
    riseBoost: 1,
    hazeIntensity: 0.9,
    seed: 0x77a3d1,
  },
};

/** V3 — the roaring-fire moment: dense field, stronger upward drift. */
export const V3_DENSE: Variant = {
  id: "V3-EmbersDense",
  config: {
    count: 1450,
    palette: WARM,
    riseBoost: 1.32,
    hazeIntensity: 1.3,
    seed: 0x2c90ff,
  },
};

export const VARIANTS: readonly Variant[] = [V1_WARM, V2_COOL, V3_DENSE];
