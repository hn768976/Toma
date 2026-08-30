import { HEIGHT, WIDTH } from "./constants";
import type { LayoutMode } from "./variants";

export type PanelKind =
  | "map"
  | "title"
  | "readout"
  | "bars"
  | "trace"
  | "gauges"
  | "text"
  | "progress"
  | "toggles";

export type Rect = { x: number; y: number; w: number; h: number };

export type PanelSpec = Rect & {
  id: string;
  kind: PanelKind;
  /** Text shown in the label strip along the panel's top edge. */
  label: string;
  /** Per-kind tuning. Anything omitted is derived from the panel size. */
  opts?: {
    cols?: number;
    rows?: number;
    bars?: number;
    nodes?: number;
    gauges?: number;
    lines?: number;
    cells?: number;
    /** Line traces only: draw a filled area under the trace. */
    filled?: boolean;
    /** Trace panels only: how many wave periods fit across the width. */
    density?: number;
  };
};

export type Layout = {
  panels: PanelSpec[];
  map: PanelSpec;
  title: PanelSpec;
};

const M = 36; // outer margin
const G = 20; // gutter

/** Lay panels out left-to-right at a fixed y with explicit widths. */
const row = (
  y: number,
  h: number,
  x0: number,
  widths: number[],
  gap: number,
): Rect[] => {
  const out: Rect[] = [];
  let x = x0;
  for (const w of widths) {
    out.push({ x, y, w, h });
    x += w + gap;
  }
  return out;
};

/** Stack panels top-to-bottom at a fixed x with explicit heights. */
const column = (
  x: number,
  w: number,
  y0: number,
  heights: number[],
  gap: number,
): Rect[] => {
  const out: Rect[] = [];
  let y = y0;
  for (const h of heights) {
    out.push({ x, y, w, h });
    y += h + gap;
  }
  return out;
};

type Slot = [PanelKind, string, PanelSpec["opts"]?];

const assemble = (rects: Rect[], slots: Slot[], prefix: string): PanelSpec[] =>
  rects.map((rect, i) => ({
    ...rect,
    id: `${prefix}-${i}`,
    kind: slots[i][0],
    label: slots[i][1],
    opts: slots[i][2],
  }));

/**
 * v1 / v3 - "centred": the world map holds the middle ~40% of the frame width,
 * flanked by a column of panels left and right, with a full-width row of panels
 * above and below. Symmetrical around the map.
 */
const centredLayout = (): Layout => {
  const topY = M;
  const topH = 320;
  const midY = 376;
  const midH = 1408;
  const botY = 1804;
  const botH = 320;

  const top = assemble(
    row(topY, topH, M, [720, 720, 900, 688, 660], G),
    [
      ["readout", "SECTOR ARRAY", { cols: 4, rows: 4 }],
      ["readout", "BEACON GRID", { cols: 4, rows: 4 }],
      ["trace", "SIGNAL DRIFT", { nodes: 30, density: 2 }],
      ["text", "SYS LOG", { lines: 11 }],
      ["bars", "BAND LOAD", { bars: 22 }],
    ],
    "top",
  );

  const bottom = assemble(
    row(botY, botH, M, [660, 688, 900, 720, 720], G),
    [
      ["gauges", "PHASE LOCK", { gauges: 3 }],
      ["text", "TRACE LOG", { lines: 11 }],
      ["trace", "ALTITUDE DELTA", { nodes: 30, density: 3, filled: true }],
      ["readout", "SURVEY NODES", { cols: 4, rows: 4 }],
      ["readout", "RANGE TABLE", { cols: 4, rows: 4 }],
    ],
    "bot",
  );

  const left = assemble(
    column(M, 1104, midY, [420, 520, 200, 208], G),
    [
      ["trace", "VECTOR SCAN", { nodes: 34, density: 3 }],
      ["text", "SCANNING DATA", { lines: 16 }],
      ["progress", "SWEEP CYCLE", { cells: 3 }],
      ["toggles", "CHANNEL STATE", { cols: 25, rows: 2 }],
    ],
    "left",
  );

  const right = assemble(
    column(2700, 1104, midY, [300, 420, 320, 308], G),
    [
      ["toggles", "ARRAY STATE", { cols: 25, rows: 3 }],
      ["readout", "TRACKING DATA", { cols: 3, rows: 5 }],
      ["text", "LINK LOG", { lines: 10 }],
      ["gauges", "LOCK QUALITY", { gauges: 3 }],
    ],
    "right",
  );

  const map: PanelSpec = {
    id: "map",
    kind: "map",
    label: "GLOBAL SURVEY GRID",
    x: 1160,
    y: midY,
    w: 1520,
    h: midH,
  };

  const title: PanelSpec = {
    id: "title",
    kind: "title",
    label: "",
    x: 1460,
    y: midY + 44,
    w: 920,
    h: 78,
  };

  return { panels: [...top, ...bottom, ...left, ...right], map, title };
};

/**
 * v2 - "offset": the map is pushed to the left ~45% of the frame, the right
 * side becomes a dense three-column stack of small panels, and a single wide
 * line trace runs the full width along the bottom. Left-heavy image,
 * right-heavy data.
 */
const offsetLayout = (): Layout => {
  const topH = 1684;
  const mapW = 1728; // 45% of 3840
  const colX = [1784, 2464, 3144];
  const colW = 660;
  const cg = 14; // tighter gutter than v1 - the stack is denser

  const colA = assemble(
    column(colX[0], colW, M, [260, 300, 240, 300, 234, 280], cg),
    [
      ["readout", "PACKET FLOW", { cols: 3, rows: 3 }],
      ["trace", "LATENCY MS", { nodes: 24, density: 3 }],
      ["toggles", "PORT STATE", { cols: 14, rows: 3 }],
      ["readout", "NODE IDS", { cols: 2, rows: 4 }],
      ["progress", "SYNC QUEUE", { cells: 2 }],
      ["bars", "THROUGHPUT", { bars: 16 }],
    ],
    "colA",
  );

  const colB = assemble(
    column(colX[1], colW, M, [300, 240, 300, 260, 280, 234], cg),
    [
      ["gauges", "MESH HEALTH", { gauges: 2 }],
      ["readout", "UPTIME PCT", { cols: 3, rows: 2 }],
      ["text", "RELAY LOG", { lines: 11 }],
      ["readout", "HOP COUNT", { cols: 3, rows: 3 }],
      ["bars", "QUEUE DEPTH", { bars: 14 }],
      ["toggles", "LINK FLAGS", { cols: 14, rows: 3 }],
    ],
    "colB",
  );

  const colC = assemble(
    column(colX[2], colW, M, [240, 300, 260, 300, 234, 280], cg),
    [
      ["progress", "REBUILD", { cells: 2 }],
      ["readout", "PORT MAP", { cols: 3, rows: 3 }],
      ["trace", "JITTER", { nodes: 22, density: 4 }],
      ["text", "ROUTE TABLE", { lines: 11 }],
      ["toggles", "PEER STATE", { cols: 14, rows: 3 }],
      ["gauges", "SIGNAL", { gauges: 2 }],
    ],
    "colC",
  );

  const wide: PanelSpec = {
    id: "wide-trace",
    kind: "trace",
    label: "AGGREGATE THROUGHPUT / ALL SEGMENTS",
    x: M,
    y: 1740,
    w: WIDTH - M * 2,
    h: HEIGHT - 1740 - M,
    opts: { nodes: 96, density: 8, filled: true },
  };

  const map: PanelSpec = {
    id: "map",
    kind: "map",
    label: "RELAY TOPOLOGY",
    x: M,
    y: M,
    w: mapW,
    h: topH,
  };

  const title: PanelSpec = {
    id: "title",
    kind: "title",
    label: "",
    x: M + (mapW - 880) / 2,
    y: M + 44,
    w: 880,
    h: 74,
  };

  return { panels: [...colA, ...colB, ...colC, wide], map, title };
};

export const buildLayout = (mode: LayoutMode): Layout =>
  mode === "centred" ? centredLayout() : offsetLayout();
