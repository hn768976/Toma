import { DURATION_IN_FRAMES } from "./constants";
import { between, mulberry32, pick } from "./random";
import type { LabelConfig } from "./variants";

export type FloatingLabel = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  bright: boolean;
  // Closed elliptical drift path. The period divides DURATION_IN_FRAMES, so
  // the label is back where it started at the end of the loop.
  driftRx: number;
  driftRy: number;
  driftPeriod: number;
  driftPhase: number;
  // The label rerolls its value every rerollPeriod frames. values.length is
  // exactly DURATION_IN_FRAMES / rerollPeriod, so the cycle also closes.
  rerollPeriod: number;
  values: string[];
};

// Periods that divide 390 exactly.
const DRIFT_PERIODS = [390, 390, 195, 130] as const;
const REROLL_PERIODS = [195, 130, 78] as const;

// Magnitudes lifted from the way real quote feeds look side by side: a few
// dollars, a few hundred, a few hundred thousand, and a sub-unit rate.
const MAGNITUDES = [0.04, 1.2, 12, 89, 563, 4057, 99034] as const;

const formatValue = (rand: () => number): string => {
  const magnitude = pick(rand, MAGNITUDES);
  const decimals = rand() < 0.45 ? 5 : 2;
  const value = magnitude * between(rand, 0.82, 1.18);
  return value.toFixed(decimals);
};

export const generateLabels = (
  config: LabelConfig,
  seed: number,
  width: number,
  height: number,
): FloatingLabel[] => {
  const rand = mulberry32(seed);
  const labels: FloatingLabel[] = [];

  // Stratified scatter: one label per cell of a coarse grid, jittered well
  // past the cell bounds. Keeps them spread across the frame without the
  // clumping a pure random scatter gives at these counts.
  const columns = Math.ceil(Math.sqrt(config.count * 1.7));
  const rows = Math.ceil(config.count / columns);

  for (let i = 0; i < config.count; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const cellW = width / columns;
    const cellH = height / rows;

    const sizeT = rand();
    const size =
      config.minSize + (config.maxSize - config.minSize) * sizeT * sizeT;
    const rerollPeriod = pick(rand, REROLL_PERIODS);
    const valueCount = DURATION_IN_FRAMES / rerollPeriod;
    const values: string[] = [];
    for (let v = 0; v < valueCount; v++) {
      values.push(formatValue(rand));
    }

    labels.push({
      x: cellW * (column + between(rand, -0.25, 1.25)),
      y: cellH * (row + between(rand, -0.2, 1.2)),
      size,
      // Bigger labels sit lower in the opacity range so they never compete
      // with the candles.
      opacity:
        config.minOpacity +
        (config.maxOpacity - config.minOpacity) * (1 - sizeT * 0.75) * rand(),
      bright: rand() < 0.35,
      driftRx: between(rand, 10, 46) * config.driftScale,
      driftRy: between(rand, 8, 34) * config.driftScale,
      driftPeriod: pick(rand, DRIFT_PERIODS),
      driftPhase: rand() * Math.PI * 2,
      rerollPeriod,
      values,
    });
  }

  return labels;
};

// Value index and a gentle opacity dip across the reroll, both pure
// functions of the frame within the loop.
export const labelStateAt = (label: FloatingLabel, frame: number) => {
  const index = Math.floor(frame / label.rerollPeriod) % label.values.length;
  const phase = (frame % label.rerollPeriod) / label.rerollPeriod;
  const edge = Math.min(phase, 1 - phase) / 0.12;
  const fade = 0.2 + 0.8 * Math.min(1, edge);
  return { value: label.values[index], fade };
};
