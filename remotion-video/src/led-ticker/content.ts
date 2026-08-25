// Deterministic band content. Every value comes from Remotion's random() with
// a stable string seed, so all render workers agree frame for frame.

import { random } from "remotion";
import { LIT_GREEN, LIT_RED, LIT_WHITE, MIN_GAP } from "./constants";

export type Entry =
  | { kind: "text"; text: string; color: number }
  | { kind: "tri"; up: boolean; color: number };

/**
 * Formats mixed within a band, weighted so prices and moves dominate.
 * "dir" entries take the sign of the current run.
 */
const KINDS = [
  { name: "price", w: 0.23, dir: false },
  { name: "change", w: 0.16, dir: true },
  { name: "percent", w: 0.16, dir: true },
  { name: "volume", w: 0.15, dir: false },
  { name: "cap", w: 0.12, dir: false },
  { name: "tri", w: 0.18, dir: true },
];

const pickKind = (r: number) => {
  let acc = 0;
  for (const k of KINDS) {
    acc += k.w;
    if (r < acc) {
      return k.name;
    }
  }
  return "price";
};

const makeEntry = (band: number, i: number, up: boolean): Entry => {
  const seed = `led-b${band}-e${i}`;
  const kind = pickKind(random(`${seed}-kind`));
  const v = random(`${seed}-val`);
  const sign = up ? "+" : "-";
  const color = up ? LIT_GREEN : LIT_RED;

  switch (kind) {
    case "change":
      return { kind: "text", text: `${sign} ${(0.05 + v * 5).toFixed(2)}`, color };
    case "percent":
      return {
        kind: "text",
        text: `${sign} ${(0.05 + v * 7).toFixed(2)}%`,
        color,
      };
    case "volume":
      return {
        kind: "text",
        text: `$ ${(0.8 + v * 9).toFixed(2)}M`,
        color: LIT_WHITE,
      };
    case "cap":
      return {
        kind: "text",
        text: `$ ${(1 + v * 3.5).toFixed(3)} B`,
        color: LIT_WHITE,
      };
    case "tri":
      return { kind: "tri", up, color };
    default:
      return {
        kind: "text",
        text: `$ ${(10 + v * 190).toFixed(2)}`,
        color: LIT_WHITE,
      };
  }
};

export interface BandContent {
  entries: Entry[];
  /** Board px of empty panel after each entry. */
  gap: number;
  /** Board px offset of each entry's left edge within the sequence. */
  offsets: number[];
  widths: number[];
}

/**
 * Fills exactly `targetWidth` board px with entries. The gap is solved for
 * rather than fixed, so the sequence width lands on the lattice multiple the
 * loop needs without the entries themselves being stretched.
 */
export const buildBandContent = (
  band: number,
  targetWidth: number,
  measure: (e: Entry) => number,
): BandContent => {
  const entries: Entry[] = [];
  const widths: number[] = [];
  let contentW = 0;

  // Adjacent entries share a direction for a few entries at a time — runs of
  // green then runs of red read as real market data, strict alternation does not.
  // Alternating the run's starting sign per band keeps green and red roughly
  // balanced across the stack, since a band only holds a handful of entries.
  let up = band % 2 === 0;
  let runLeft = 2 + Math.floor(random(`led-b${band}-run0`) * 3);

  for (let i = 0; i < 400; i++) {
    if (runLeft === 0) {
      if (random(`led-b${band}-flip${i}`) < 0.85) {
        up = !up;
      }
      runLeft = 2 + Math.floor(random(`led-b${band}-run${i}`) * 3);
    }
    const entry = makeEntry(band, i, up);
    const w = measure(entry);
    if (contentW + w + (entries.length + 1) * MIN_GAP > targetWidth) {
      break;
    }
    entries.push(entry);
    widths.push(w);
    contentW += w;
    runLeft--;
  }

  const gap = (targetWidth - contentW) / entries.length;
  const offsets: number[] = [];
  let x = 0;
  for (let i = 0; i < entries.length; i++) {
    offsets.push(x);
    x += widths[i] + gap;
  }
  return { entries, gap, offsets, widths };
};
