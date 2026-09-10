import entries from "./batch.json";
import type { CompositionName } from "./compositions";
import type { PaletteName } from "./palettes";

export type BatchEntry = {
  composition: CompositionName;
  palette: PaletteName;
};

/**
 * The twelve stills, defined in batch.json so that both this module and
 * scripts/render-batch.ts read one list.
 *
 * Palette pairs are assigned so the set does not read as six blues: the two
 * halves of each pair sit far apart in hue, and all six palettes are spread
 * across the compositions rather than clustered.
 *
 * The order also drives the contact sheet, where each pair sits side by side.
 */
export const BATCH = entries as BatchEntry[];

export const stillName = (entry: BatchEntry): string =>
  `trading-${entry.composition}-${entry.palette}.png`;
