import { CHARS_PER_ROW } from "./constants";
import { hash, makePrng } from "./random";

export type Token = {
  /** Column of the token's first character. */
  x: number;
  len: number;
};

export type Skeleton = {
  tokens: Token[];
};

/**
 * Rows do not each get their own layout — they draw from a pool of pre-built
 * skeletons and swap between them on a slow cycle (see LAYOUT_PERIOD). That
 * keeps the per-frame work to a lookup while still letting a row visibly
 * rewrite itself now and then, the way a live dump does.
 */
const NUM_SKELETONS = 96;

const TOKEN_LENGTHS = [2, 2, 2, 2, 4, 4, 4, 6, 6, 8];

/** Dense / normal / sparse rows, so the field has an uneven vertical rhythm. */
const DENSITY = [
  { gapMin: 1, gapMax: 3, runChance: 0.03 },
  { gapMin: 1, gapMax: 6, runChance: 0.07 },
  { gapMin: 2, gapMax: 9, runChance: 0.14 },
];

const buildSkeleton = (seed: number): Skeleton => {
  const prng = makePrng(seed);
  const density = DENSITY[Math.floor(prng() * DENSITY.length)];
  const tokens: Token[] = [];

  let x = Math.floor(prng() * 5);
  while (x < CHARS_PER_ROW) {
    const len = TOKEN_LENGTHS[Math.floor(prng() * TOKEN_LENGTHS.length)];
    if (x + len > CHARS_PER_ROW) {
      break;
    }
    tokens.push({ x, len });

    let gap =
      density.gapMin +
      Math.floor(prng() * (density.gapMax - density.gapMin + 1));
    // Occasional long empty run, so some rows read as half-blank.
    if (prng() < density.runChance) {
      gap += 8 + Math.floor(prng() * 18);
    }
    x += len + gap;
  }

  return { tokens };
};

export const SKELETONS: Skeleton[] = Array.from(
  { length: NUM_SKELETONS },
  (_, i) => buildSkeleton(0xbeef0000 + i * 7919),
);

export const MAX_TOKENS_PER_ROW = SKELETONS.reduce(
  (m, s) => Math.max(m, s.tokens.length),
  0,
);

export type TokenKind = "plain" | "primary" | "secondary" | "bright";

/**
 * A token's tier is a property of the skeleton slot, so when a row swaps
 * skeletons its highlights move with it.
 */
export const tokenKind = (skelIdx: number, tokenIdx: number): TokenKind => {
  const roll = hash(skelIdx, tokenIdx, 0x101) % 1000;
  if (roll < 65) {
    // ~6.5% filled highlight blocks, weighted toward the primary colour.
    return hash(skelIdx, tokenIdx, 0x202) % 100 < 70 ? "primary" : "secondary";
  }
  if (roll < 88) {
    return "bright"; // ~2.3% brighter white, no fill
  }
  return "plain";
};
