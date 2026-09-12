import {
  GRID_COLUMNS,
  GRID_ROWS,
  PANEL_GAP,
  PANEL_HEIGHT,
  PANEL_WIDTH,
} from "./constants";

export type PanelKind =
  | "gauge"
  | "gauge-plain"
  | "bars"
  | "lines"
  | "signal"
  | "spectrum"
  | "globe"
  | "table"
  | "donut"
  | "heat";

export type PanelSpec = {
  kind: PanelKind;
  title: string;
  row: number;
  col: number;
  x: number; // relative to the board's top-left, in floor px
  y: number;
  seed: number;
  delay: number; // build-in stagger, frames
};

// Which chart sits where. Rows go from far (0) to near (3); the camera is
// framed on row 2, where the big gauge and the bar chart from the
// reference live.
const KINDS: PanelKind[][] = [
  ["heat", "lines", "gauge-plain", "signal", "table"],
  ["signal", "gauge-plain", "table", "globe", "donut"],
  ["lines", "gauge", "bars", "spectrum", "heat"],
  ["table", "signal", "donut", "lines", "gauge-plain"],
];

const TITLES: Record<PanelKind, string> = {
  gauge: "System load",
  "gauge-plain": "Throughput",
  bars: "Quarterly volume",
  lines: "Trend analysis",
  signal: "Live signal",
  spectrum: "Frequency",
  globe: "Global nodes",
  table: "Telemetry",
  donut: "Allocation",
  heat: "Cluster status",
};

// Cell the build-in stagger radiates from (the sharp, near-center gauge).
export const FOCUS_ROW = 2;
export const FOCUS_COL = 1;

export const BOARD_WIDTH =
  GRID_COLUMNS * PANEL_WIDTH + (GRID_COLUMNS - 1) * PANEL_GAP;
export const BOARD_HEIGHT =
  GRID_ROWS * PANEL_HEIGHT + (GRID_ROWS - 1) * PANEL_GAP;

export const PANELS: PanelSpec[] = KINDS.flatMap((rowKinds, row) =>
  rowKinds.map((kind, col) => {
    const dist = Math.hypot(row - FOCUS_ROW, col - FOCUS_COL);
    return {
      kind,
      title: TITLES[kind],
      row,
      col,
      x: col * (PANEL_WIDTH + PANEL_GAP),
      y: row * (PANEL_HEIGHT + PANEL_GAP),
      seed: row * GRID_COLUMNS + col + 1,
      delay: Math.round(dist * 6),
    };
  }),
);

// Depth-of-field: how blurred each row is (px at 1x). Row 2 is the focal
// plane; farther rows soften more than the nearer one, like a real lens.
export const ROW_BLUR: Record<number, number> = {
  0: 5,
  1: 2.2,
  2: 0,
  3: 1.6,
};
