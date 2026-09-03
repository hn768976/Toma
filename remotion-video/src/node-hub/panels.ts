/**
 * Placement model for the side chrome.
 *
 * Panels are laid out in vertical columns hugging the left and right margins.
 * The variant supplies only a DENSITY name; this module turns that into
 * concrete columns, counts and rectangles, so changing a variant's chrome is a
 * one-word change in VARIANTS.
 *
 *   sparse   — one column per side, pushed into the top and bottom corners,
 *              leaving the middle clear for the arcs to sweep through.
 *   moderate — two columns per side.
 *   dense    — three columns per side, reaching further toward the centre,
 *              filling space a satellite layout would otherwise occupy.
 *
 * Every panel's height comes from its content, and the leftover vertical space
 * in a column is redistributed as seeded gaps, so a column always fits its
 * band exactly without any panel overlapping another.
 */
import { PERIODS } from "./constants";
import { channel, token } from "./lexicon";
import { pick, randInt, randRange } from "./seed";
import type { ChromeConfig, PanelDensity } from "./variants";

export type PanelKind =
  | "table"
  | "bars"
  | "readout"
  | "mono"
  | "bigReadout"
  | "strip";

export type PanelSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PanelKind;
  rows: number;
  /** Tiny label strip along the panel's top edge. Fictional. */
  label: string;
  /** Static per-row labels, for the kinds that have them. Fictional. */
  rowLabels: string[];
  /** Frames between value rerolls. Divides the loop. */
  rerollPeriod: number;
  /** Thin border, corner ticks and label strip. */
  chrome: boolean;
  seed: string;
};

type Column = { x: number; w: number };

type DensityPlan = {
  columns: Column[];
  perSide: number;
  /** Vertical bands panels may occupy, as [start, end] fractions of height. */
  bands: [number, number][];
};

const DENSITY_PLANS: Record<PanelDensity, DensityPlan> = {
  sparse: {
    columns: [{ x: 66, w: 330 }],
    perSide: 3,
    // Corners only.
    bands: [
      [0.038, 0.3],
      [0.7, 0.955],
    ],
  },
  moderate: {
    columns: [
      { x: 64, w: 344 },
      { x: 436, w: 306 },
    ],
    perSide: 5,
    bands: [[0.038, 0.955]],
  },
  dense: {
    columns: [
      { x: 64, w: 300 },
      { x: 392, w: 320 },
      { x: 740, w: 330 },
    ],
    perSide: 15,
    bands: [[0.038, 0.955]],
  },
};

/** Row metrics per kind, in 4K px. Panel height is derived from these. */
const ROW_HEIGHT: Record<PanelKind, number> = {
  table: 36,
  bars: 34,
  readout: 58,
  mono: 28,
  bigReadout: 0,
  strip: 0,
};

const HEADER_HEIGHT = 44;
const BODY_PAD = 18;

const KIND_WEIGHTS: PanelKind[] = [
  "table",
  "table",
  "bars",
  "bars",
  "mono",
  "mono",
  "readout",
];

const rowsFor = (kind: PanelKind, seed: string): number => {
  switch (kind) {
    case "table":
      return randInt(`${seed}/rows`, 3, 5);
    case "bars":
      return randInt(`${seed}/rows`, 3, 5);
    case "mono":
      return randInt(`${seed}/rows`, 4, 7);
    case "readout":
      return randInt(`${seed}/rows`, 1, 2);
    default:
      return 1;
  }
};

const naturalHeight = (kind: PanelKind, rows: number): number =>
  HEADER_HEIGHT + BODY_PAD * 2 + rows * ROW_HEIGHT[kind];

export type PanelsOptions = {
  chrome: ChromeConfig;
  width: number;
  height: number;
  seed: string;
  /** Vertical space to keep clear at the bottom of each side, for a label. */
  reserveBottomLeft: number;
  reserveBottomRight: number;
};

/**
 * Fills one column band with panels, deriving each height from its content and
 * spending the remaining space on seeded gaps.
 */
const fillBand = (
  column: Column,
  side: "l" | "r",
  bandTop: number,
  bandBottom: number,
  count: number,
  seed: string,
  width: number,
): PanelSpec[] => {
  if (count <= 0 || bandBottom - bandTop < 120) return [];

  const drafts = Array.from({ length: count }, (_, i) => {
    const key = `${seed}/${i}`;
    const kind = pick(`${key}/kind`, KIND_WEIGHTS);
    const rows = rowsFor(kind, key);
    return { key, kind, rows, h: naturalHeight(kind, rows) };
  });

  // Drop panels from the end until the column fits with breathing room.
  const bandHeight = bandBottom - bandTop;
  let kept = drafts;
  const minGap = 44;
  while (
    kept.length > 1 &&
    kept.reduce((a, d) => a + d.h, 0) + minGap * (kept.length - 1) > bandHeight
  ) {
    kept = kept.slice(0, -1);
  }

  const contentHeight = kept.reduce((a, d) => a + d.h, 0);
  const free = Math.max(0, bandHeight - contentHeight);
  // Spend the slack on seeded gaps: one above each panel plus one below the
  // last, so the column reads as scattered rather than evenly stacked.
  const weights = kept.map((d, i) => randRange(`${d.key}/gap/${i}`, 0.4, 1.6));
  weights.push(randRange(`${seed}/gap/tail`, 0.4, 1.6));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const out: PanelSpec[] = [];
  let y = bandTop;
  kept.forEach((draft, i) => {
    y += (weights[i] / weightSum) * free;
    const x = side === "l" ? column.x : width - column.x - column.w;
    out.push({
      id: `p/${seed}/${i}`,
      x,
      y: Math.round(y),
      w: column.w,
      h: draft.h,
      kind: draft.kind,
      rows: draft.rows,
      label: `${token(`${draft.key}/label`)} ${channel(`${draft.key}/ch`)}`,
      rowLabels: Array.from({ length: draft.rows }, (_, r) =>
        channel(`${draft.key}/rl/${r}`),
      ),
      rerollPeriod: pick(`${draft.key}/reroll`, [
        PERIODS.panelFast,
        PERIODS.panelSlow,
      ]),
      chrome: true,
      seed: draft.key,
    });
    y += draft.h;
  });

  return out;
};

/** Builds every panel rectangle for a variant's chrome configuration. */
export const buildPanels = ({
  chrome,
  width,
  height,
  seed,
  reserveBottomLeft,
  reserveBottomRight,
}: PanelsOptions): PanelSpec[] => {
  const plan = DENSITY_PLANS[chrome.density];
  const panels: PanelSpec[] = [];

  // The large readouts take the outermost strip on the left, so the columns
  // beside them shift inward to make room.
  const readoutWidth = chrome.bigReadouts > 0 ? 300 : 0;
  const bottomStripReserve = chrome.bottomStrip ? 190 : 0;

  (["l", "r"] as const).forEach((side) => {
    const reserve =
      (side === "l" ? reserveBottomLeft : reserveBottomRight) +
      bottomStripReserve;

    plan.columns.forEach((rawColumn, columnIndex) => {
      const column =
        side === "l" && readoutWidth > 0
          ? { x: rawColumn.x + readoutWidth, w: rawColumn.w }
          : rawColumn;

      // Spread this side's panel budget across its columns.
      const count =
        Math.floor(plan.perSide / plan.columns.length) +
        (columnIndex < plan.perSide % plan.columns.length ? 1 : 0);

      // And across this column's bands, proportionally to band height.
      const spans = plan.bands.map(([from, to]) => {
        const top = height * from;
        const bottom = Math.min(height * to, height - reserve);
        return { top, bottom, size: Math.max(0, bottom - top) };
      });
      const sizeSum = spans.reduce((a, b) => a + b.size, 0) || 1;

      let assigned = 0;
      spans.forEach((span, bandIndex) => {
        const share =
          bandIndex === spans.length - 1
            ? count - assigned
            : Math.round((span.size / sizeSum) * count);
        assigned += share;
        panels.push(
          ...fillBand(
            column,
            side,
            span.top,
            span.bottom,
            share,
            `${seed}/${side}/${columnIndex}/${bandIndex}`,
            width,
          ),
        );
      });
    });
  });

  // A column of large two-digit readouts down the left edge.
  for (let i = 0; i < chrome.bigReadouts; i++) {
    const slot = height * 0.1 + (i * height * 0.78) / chrome.bigReadouts;
    panels.push({
      id: `big/${i}`,
      x: 72,
      y: Math.round(slot),
      w: 230,
      h: 230,
      kind: "bigReadout",
      rows: 1,
      label: token(`${seed}/big/${i}/label`),
      rowLabels: [`${token(`${seed}/big/${i}/sub`)} ${channel(`${seed}/big/${i}/ch`)}`],
      rerollPeriod: pick(`${seed}/big/${i}/reroll`, [
        PERIODS.readoutA,
        PERIODS.readoutB,
      ]),
      chrome: false,
      seed: `${seed}/big/${i}`,
    });
  }

  // A dense full-width value/bar strip along the bottom edge.
  if (chrome.bottomStrip) {
    panels.push({
      id: "strip",
      x: 60,
      y: height - 158,
      w: width - 120,
      h: 108,
      kind: "strip",
      rows: 1,
      label: token(`${seed}/strip/label`),
      rowLabels: [],
      rerollPeriod: PERIODS.panelSlow,
      chrome: false,
      seed: `${seed}/strip`,
    });
  }

  return panels;
};
