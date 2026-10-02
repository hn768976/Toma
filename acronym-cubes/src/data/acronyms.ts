// One composition template, one data row per acronym.
//
// To add an acronym, add ONE row here. Its letters come from `id`, the
// composition is registered as `Cubes-<id>`, and every random choice (side
// letters, rolls, timings, chart wiggles, volume bars) is derived from
// `seed`. `shape` picks the story the price line tells (see chartShapes.ts).

export type ChartShape =
  | "steadyRise" // steady rise with small wobbles
  | "listingPop" // flat, then a sharp jump upward
  | "clearRise" // clear rise
  | "dipRecovery" // rise, dip, recovery
  | "steadyClimb" // steady, smooth climb
  | "steppedRise" // rising in steps
  | "longGentleRise" // long, gentle compounding rise
  | "gentleRise" // gentle, steady rise
  | "rateSteps" // flat runs with jumps (rate changes)
  | "flatSideways" // mostly flat, sideways
  | "rising"; // rising

export type AcronymRow = {
  id: string; // the characters on the cubes, left to right (A-Z, 0-9)
  shape: ChartShape;
  seed: number;
};

export const ACRONYMS: AcronymRow[] = [
  { id: "ETF", shape: "steadyRise", seed: 1101 },
  { id: "IPO", shape: "listingPop", seed: 2202 },
  { id: "ROI", shape: "clearRise", seed: 3303 },
  { id: "GDP", shape: "dipRecovery", seed: 4404 },
  { id: "CPI", shape: "steadyClimb", seed: 5505 },
  { id: "KPI", shape: "steppedRise", seed: 6606 },
  { id: "401K", shape: "longGentleRise", seed: 7707 },
  { id: "IRA", shape: "longGentleRise", seed: 8808 },
  { id: "ESG", shape: "gentleRise", seed: 9909 },
  { id: "APR", shape: "rateSteps", seed: 1212 },
  { id: "VAT", shape: "flatSideways", seed: 1313 },
  { id: "GST", shape: "flatSideways", seed: 1414 },
  { id: "B2B", shape: "rising", seed: 1515 },
];

// Remotion composition ids may not contain "_", so the id is Cubes-ETF etc.
// (rendered files are still named Cubes_ETF.mp4).
export const compositionId = (row: AcronymRow) => `Cubes-${row.id}`;
