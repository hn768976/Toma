// Deterministic generator for the scrolling "code" backdrop.
//
// Rows are pure functions of their absolute row index (and, for the small
// subset that churns, of a slow frame bucket). Remotion renders frames out
// of order across workers, so anything derived from Math.random() would
// flicker between neighbouring frames.
import { mulberry32 } from "../particle-ring/random";

const KEYWORDS = [
  "if",
  "for",
  "int",
  "ret",
  "var",
  "def",
  "let",
  "out",
  "buf",
  "ptr",
  "map",
  "vec",
  "net",
  "tok",
];

const IDENTIFIERS = [
  "x0Wz",
  "DxWb2l",
  "qNodE",
  "kRnl",
  "aVec",
  "tEnsr",
  "LstM",
  "sGmt",
  "wGht",
  "bIas",
  "lYr",
  "hEad",
  "embD",
  "stAck",
  "hEap",
  "frAme",
];

const OPERATORS = ["=", "==", "!=", "+=", "<<", ">>", "->", "::", "&&", "|"];

const HEX = "0123456789ABCDEF";

export type Token = {
  text: string;
  /** 0 = dim body text, 1 = hot, 2 = cold accent. */
  tone: 0 | 1 | 2;
  /** Baseline opacity before any per-frame modulation. */
  alpha: number;
  /** Tokens with churn > 0 re-roll their text on a slow cadence. */
  churn: boolean;
};

const pick = <T,>(rand: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rand() * arr.length)];

const hex = (rand: () => number, len: number): string => {
  let out = "0x";
  for (let i = 0; i < len; i++) out += HEX[Math.floor(rand() * 16)];
  return out;
};

const makeToken = (rand: () => number): string => {
  const roll = rand();
  if (roll < 0.22) return hex(rand, 2 + Math.floor(rand() * 3));
  if (roll < 0.42) return pick(rand, IDENTIFIERS);
  if (roll < 0.56) return pick(rand, KEYWORDS);
  if (roll < 0.68) return pick(rand, OPERATORS);
  if (roll < 0.8) return String(Math.floor(rand() * 9999));
  if (roll < 0.9) return `${pick(rand, IDENTIFIERS)}(${Math.floor(rand() * 64)})`;
  return `${pick(rand, KEYWORDS)}_${pick(rand, IDENTIFIERS)}`;
};

// One row of tokens. `bucket` advances every N frames for the ~1-in-6
// tokens flagged as churning, which makes the field feel like live output
// without turning the whole screen into noise. `count` is derived from the
// field width by the caller so rows always run edge to edge.
export const buildRow = (rowIndex: number, bucket: number, count: number): Token[] => {
  const rand = mulberry32(rowIndex * 2654435761 + 17);
  const tokenCount = count + Math.floor(rand() * 5);
  const tokens: Token[] = [];

  for (let i = 0; i < tokenCount; i++) {
    const churn = rand() < 0.17;
    const toneRoll = rand();
    const tone: Token["tone"] = toneRoll > 0.94 ? 2 : toneRoll > 0.62 ? 1 : 0;
    const alpha = 0.3 + rand() * 0.62;
    const textRand = churn
      ? mulberry32(rowIndex * 7919 + i * 104729 + bucket * 65537)
      : mulberry32(rowIndex * 7919 + i * 104729);
    tokens.push({ text: makeToken(textRand), tone, alpha, churn });
  }

  return tokens;
};

// Horizontal offset (in character widths) so rows do not all start flush
// left — the reference field looks like wrapped source, not a table.
export const rowIndent = (rowIndex: number): number => {
  const rand = mulberry32(rowIndex * 40503 + 991);
  return Math.floor(rand() * 14);
};
