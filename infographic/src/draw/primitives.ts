import { random } from "remotion";

export type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ *
 * Deterministic helpers. Every random value in the piece comes from
 * Remotion's random() with a stable string seed, so the chart data is
 * byte-identical on every render.
 * ------------------------------------------------------------------ */

export const rnd = (seed: string) => random(seed) as number;

export const rndRange = (seed: string, min: number, max: number) =>
  min + rnd(seed) * (max - min);

export const rndInt = (seed: string, min: number, max: number) =>
  Math.floor(rndRange(seed, min, max + 0.9999));

export const pick = <T>(seed: string, items: readonly T[]): T =>
  items[rndInt(seed, 0, items.length - 1)];

/* ------------------------------------------------------------------ *
 * Tabular figures. Canvas 2D cannot switch on OpenType `tnum`, so each
 * digit is drawn on a fixed advance equal to the widest digit of the
 * current font. Climbing numbers then stay rock-steady.
 * ------------------------------------------------------------------ */

const digitCellCache = new Map<string, number>();

const digitCell = (ctx: Ctx) => {
  const cached = digitCellCache.get(ctx.font);
  if (cached !== undefined) {
    return cached;
  }
  let w = 0;
  for (let d = 0; d <= 9; d++) {
    w = Math.max(w, ctx.measureText(String(d)).width);
  }
  digitCellCache.set(ctx.font, w);
  return w;
};

const isDigit = (ch: string) => ch >= "0" && ch <= "9";

export const tabularWidth = (ctx: Ctx, text: string) => {
  const cell = digitCell(ctx);
  let w = 0;
  for (const ch of text) {
    w += isDigit(ch) ? cell : ctx.measureText(ch).width;
  }
  return w;
};

export type TabularAlign = "left" | "center" | "right";

export const drawTabular = (
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  align: TabularAlign = "left",
) => {
  const cell = digitCell(ctx);
  const total = tabularWidth(ctx, text);
  let cursor =
    align === "left" ? x : align === "center" ? x - total / 2 : x - total;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text) {
    if (isDigit(ch)) {
      // Centre the glyph inside its fixed cell.
      const gw = ctx.measureText(ch).width;
      ctx.fillText(ch, cursor + (cell - gw) / 2, y);
      cursor += cell;
    } else {
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width;
    }
  }
  ctx.textAlign = prevAlign;
};

/* ------------------------------------------------------------------ *
 * Fictional filler copy. At this size a text block reads as texture, so
 * invented words cost nothing and keep any real published prose out of
 * the piece.
 * ------------------------------------------------------------------ */

const FILLER_WORDS = [
  "veloret", "ansett", "kurim", "brendal", "tosque", "milvane", "orcada",
  "pellum", "srevin", "haldor", "quinte", "nabrid", "wistel", "corvane",
  "tarrow", "ilbent", "grasmo", "denvik", "olture", "prandel", "sivet",
  "morlan", "cadrix", "ebbern", "thoral", "vunsel", "argine", "lomtar",
  "hesken", "pyrral", "onvest", "dulmar", "sennik", "traval", "yorbet",
  "clavin", "murrow", "septal", "windar", "boquel", "razven", "linter",
];

const FILLER_HEADINGS = [
  "Sectional Index of Compiled Returns",
  "Aggregate Movement by Registered Band",
  "Provisional Series, Restated Basis",
  "Comparative Notes on Sampling Frame",
  "Derived Ratios Across Reporting Units",
  "Summary of Weighted Observations",
  "Distribution of Recorded Intervals",
  "Annexed Table of Adjusted Counts",
  "Second Schedule of Banded Totals",
  "Interval Weighting, Revised Method",
  "Regional Split of Declared Units",
  "Continuity Test Against Prior Frame",
  "Index of Deferred Reconciliations",
  "Marginal Change by Collection Cycle",
  "Grouped Returns, Unrounded Basis",
  "Bracketed Counts and Their Residuals",
  "Standing Register of Sample Points",
  "Third Annexe: Comparative Spread",
  "Rebased Totals for the Closing Period",
  "Notes on Coverage and Non-Response",
]

export const fillerHeading = (seed: string) =>
  pick(`${seed}-h`, FILLER_HEADINGS);

export const fillerWords = (seed: string, count: number) => {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pick(`${seed}-w${i}`, FILLER_WORDS));
  }
  return out;
};

/**
 * Justified paragraph setting: greedy wrap, then distribute the leftover
 * space between the words of every line except the last of a paragraph.
 */
export const drawJustified = (
  ctx: Ctx,
  words: string[],
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines: number,
  paragraphEvery: number,
) => {
  const spaceW = ctx.measureText(" ").width;
  let line: string[] = [];
  let lineW = 0;
  let row = 0;
  let paraLine = 0;

  const flush = (justify: boolean) => {
    if (line.length === 0) {
      return;
    }
    const ty = y + row * lineHeight;
    if (!justify || line.length === 1) {
      let cx = x;
      for (const w of line) {
        ctx.fillText(w, cx, ty);
        cx += ctx.measureText(w).width + spaceW;
      }
    } else {
      const extra = (width - lineW) / (line.length - 1);
      let cx = x;
      for (const w of line) {
        ctx.fillText(w, cx, ty);
        cx += ctx.measureText(w).width + spaceW + extra;
      }
    }
    row++;
    paraLine++;
    line = [];
    lineW = 0;
  };

  for (let i = 0; i < words.length && row < maxLines; i++) {
    const w = words[i];
    const ww = ctx.measureText(w).width;
    const next = lineW === 0 ? ww : lineW + spaceW + ww;
    if (next > width && line.length > 0) {
      flush(true);
      if (paraLine >= paragraphEvery) {
        paraLine = 0;
        row += 0.55; // paragraph break
      }
      if (row >= maxLines) {
        break;
      }
    }
    line.push(w);
    lineW = lineW === 0 ? ww : lineW + spaceW + ww;
  }
  if (row < maxLines) {
    flush(false);
  }
};

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
