import { abstractHorizon, diagonalSweep, horizontalBands, layeredGlazes, marbledBlend } from "./glazes";
import { brushSwatches, confettiDabs, looseDots, pourDrip, splatterDrips } from "./marks";
import { test } from "./test";
import type { Layout } from "./types";
import {
  bloomField,
  centreBloom,
  cornerWashes,
  edgeFrame,
  granulatingWash,
  gradedSky,
  halfPage,
  saltTexture,
} from "./washes";

// To add a composition: write a Layout (see types.ts), register it here,
// then add a row per colourway in data/stills.ts.
export const LAYOUTS = {
  bloomField,
  cornerWashes,
  gradedSky,
  horizontalBands,
  splatterDrips,
  centreBloom,
  edgeFrame,
  layeredGlazes,
  looseDots,
  brushSwatches,
  saltTexture,
  granulatingWash,
  pourDrip,
  marbledBlend,
  abstractHorizon,
  confettiDabs,
  diagonalSweep,
  halfPage,
  test,
} satisfies Record<string, Layout>;

export type LayoutKey = keyof typeof LAYOUTS;
