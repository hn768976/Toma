/**
 * Seeded generators for the background panels.
 *
 * The rule for everything in here: it has to read as *texture*. Nothing
 * should resolve into a real system if a viewer pauses on it — no
 * addresses, no host names, no file paths, no runnable command syntax.
 * Abstract hex, counters and neutral engineering nouns only.
 */
import { pick, randInt, rngFor } from "../random";

const HEX = "0123456789ABCDEF";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Neutral column headers — nouns, never verbs against a real target. */
export const HEADERS = [
  "DATA SOURCE",
  "PROGRAM INITIATED",
  "SIGNAL",
  "SIGNAL BOOST",
  "CHANNEL INDEX",
  "SEGMENT MAP",
  "BUFFER STATE",
  "VECTOR TABLE",
  "SAMPLE RANGE",
  "PHASE DELTA",
  "GRID SECTOR",
  "FRAME COUNTER",
] as const;

const LABELS = [
  "SEG",
  "IDX",
  "VEC",
  "BUF",
  "CHN",
  "LVL",
  "DLT",
  "RNG",
  "PHS",
  "NOD",
  "SMP",
  "FRM",
] as const;

const hex = (rand: () => number, len: number): string => {
  let out = "";
  for (let i = 0; i < len; i++) out += HEX[Math.floor(rand() * 16)];
  return out;
};

const alpha = (rand: () => number, len: number): string => {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHA[Math.floor(rand() * ALPHA.length)];
  return out;
};

/**
 * One line of "code". Groups of hex separated by spaces, occasionally with
 * a bracketed token, so the eye reads structure without reading meaning.
 */
export const codeLine = (key: string): string => {
  const rand = rngFor(key);
  const groups = randInt(rand, 4, 7);
  const parts: string[] = [];
  for (let i = 0; i < groups; i++) {
    const roll = rand();
    if (roll < 0.14) parts.push(`[${hex(rand, 2)}]`);
    else if (roll < 0.3) parts.push(alpha(rand, randInt(rand, 2, 3)));
    else parts.push(hex(rand, randInt(rand, 2, 4)));
  }
  return parts.join(" ");
};

export const codeBlock = (key: string, lines: number): string[] =>
  Array.from({ length: lines }, (_, i) => codeLine(`${key}:${i}`));

export type ReadoutRow = { label: string; value: string };

/** A `LABEL 0F3A` style row for the denser data panels. */
export const readoutRows = (key: string, count: number): ReadoutRow[] =>
  Array.from({ length: count }, (_, i) => {
    const rand = rngFor(`${key}:row:${i}`);
    return {
      label: pick(rand, LABELS),
      value: hex(rand, randInt(rand, 3, 5)),
    };
  });

/** The tall stacked serial column on the right of the reference frame. */
export const serialColumn = (key: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => {
    const rand = rngFor(`${key}:ser:${i}`);
    return `${alpha(rand, 2)}${hex(rand, 5)}`;
  });

/** A long numeric readout for the headline slot of a header panel. */
export const bigReadout = (key: string): string => {
  const rand = rngFor(key);
  return `${alpha(rand, 1)} ${hex(rand, 2)}${randInt(rand, 100000, 999999)}${randInt(rand, 10, 99)}`;
};

/** Bar-meter fill fractions, stable per panel. */
export const meterLevels = (key: string, count: number): number[] =>
  Array.from({ length: count }, (_, i) => {
    const rand = rngFor(`${key}:m:${i}`);
    return 0.15 + rand() * 0.8;
  });

/** Per-cell opacity for the box grid behind the dialog. */
export const gridCells = (key: string, count: number): number[] =>
  Array.from({ length: count }, (_, i) => rngFor(`${key}:c:${i}`)());
