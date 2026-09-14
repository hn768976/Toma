// Timing, geometry and palette for the two "market arrow" motion
// graphics (V1 Downturn, V2 Rally).
//
// Everything in this module — and everywhere under src/market-arrow —
// is authored in **stage units**, a fixed 1920x1080 design space. The
// scene is then uniformly scaled onto the real canvas by <Stage>, so a
// 4K composition is a pixel-exact 2x blow-up of the 1080p one and the
// two can never drift apart. Never hardcode a canvas dimension below;
// use STAGE_WIDTH / STAGE_HEIGHT.

export const FPS = 30;

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

// Output resolutions. 4K is the authoring master; 1080p is the
// delivery cut and is the exact same frame at half scale.
export const UHD_WIDTH = STAGE_WIDTH * 2; // 3840
export const UHD_HEIGHT = STAGE_HEIGHT * 2; // 2160

// Durations are locked to the two reference clips: 10s and 12s.
export const DOWNTURN_DURATION_IN_FRAMES = 10 * FPS; // 300
export const RALLY_DURATION_IN_FRAMES = 12 * FPS; // 360

// ---------------------------------------------------------------------
// V1 — Downturn
// ---------------------------------------------------------------------

export const DOWNTURN = {
  background: "#070c16",
  backgroundGlow: "#0d1b2e",
  gridFine: "rgba(78, 170, 185, 0.20)",
  gridBold: "rgba(96, 190, 205, 0.30)",
  axis: "#e9f4fb",
  axisDim: "rgba(233, 244, 251, 0.45)",

  // Ruler geometry. A "major" tick carries a number; MINOR_PER_MAJOR
  // unlabelled ticks sit between consecutive numbers.
  majorGap: 268, // stage px between numbered ticks
  minorPerMajor: 5,

  // The ticker starts at -1,000 and each numbered tick subtracts a
  // pseudo-random step from this range, so the readout drops at roughly
  // the same rate as the reference (~8,000 per second).
  startValue: -1000,
  stepMin: 560,
  stepMax: 1060,

  // The ruler is finite: 96 numbered ticks long, and the scroll is
  // timed so its tail (with a terminating arrowhead) glides into the
  // lower third exactly on the last frame.
  rulerMajors: 96,
  anchorY: 356, // stage y of numbered tick 0 at scroll 0
  tailRestY: 880, // stage y the ruler tail settles at on the last frame

  axisX: 590, // stage x of the vertical ruler
  arrowX: 356, // stage x of the plunging arrow's centreline
  minorTickLength: 45,
  majorTickLength: 68,
  labelSize: 48,
} as const;

// Total ruler travel, in stage px, across the whole 10s.
export const DOWNTURN_SCROLL_DISTANCE =
  DOWNTURN.rulerMajors * DOWNTURN.majorGap -
  (DOWNTURN.tailRestY - DOWNTURN.anchorY);

// Severity gradient. `topColor` is the cool end (top of the arrow / top
// of the readout column), `bottomColor` the hot end. Both ramp toward
// red as the crash deepens, which is what makes the whole frame turn
// from cyan to molten orange over the 10s.
export const DOWNTURN_TOP_RAMP = [
  "#3fbdee",
  "#4ec3f0",
  "#c3a9d8",
  "#ff9b76",
  "#ff6a3d",
  "#ff5326",
];

export const DOWNTURN_BOTTOM_RAMP = [
  "#4fbdf0",
  "#e79ab4",
  "#ff9e86",
  "#ff7048",
  "#ff4f22",
  "#ff3a10",
];

// ---------------------------------------------------------------------
// V2 — Rally
// ---------------------------------------------------------------------

export const RALLY = {
  background: "#04101f",
  backgroundGlow: "#0f3b66",
  landmass: "#1d4f7f",
  gridFine: "rgba(88, 168, 232, 0.13)",
  gridBold: "rgba(110, 196, 255, 0.24)",
  axis: "#3fc3f5",
  label: "#ffb238",
  labelHot: "#ff8b2a",

  // The scale is a stylised "ladder": the numbers below are drawn at
  // even spacing regardless of their arithmetic gaps, exactly like the
  // reference. LADDER_GAP is the spacing at zoom 1.
  ladderGap: 185, // stage px between rungs at zoom 1
  axisWorldX: 0,
  arrowWorldX: 232,
  chartStartX: 200,
  chartEndX: 1520,
} as const;

// Rung labels, bottom (index 0) to top. Formatted with a dot thousands
// separator to match the reference readout.
export const RALLY_LADDER = [
  10, 20, 50, 75, 100, 200, 500, 750, 1000, 1500, 2500, 5000,
];

export const RALLY_ARROW_RAMP = [
  "#9fd45a",
  "#c9e04e",
  "#f5d63c",
  "#ffb02e",
  "#ff8524",
  "#ff5f1e",
];

export const RALLY_LINE_RAMP = ["#ffd84a", "#ffa62b", "#ff7a1c", "#ff5714"];
