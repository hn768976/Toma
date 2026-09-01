import { random } from "remotion";

/**
 * Every glyph in the backdrop is invented here. No real source, no real error
 * strings, no copyright headers — it only has to read as dense machine output
 * at a size where it is illegible anyway.
 */

const VERBS = [
  "init", "seal", "wrap", "emit", "probe", "flush", "bind", "rekey",
  "stage", "purge", "align", "hoist", "vault", "cloak", "spool", "weave",
  "fold", "sift", "graft", "quench",
];

const NOUNS = [
  "Cipher", "Block", "Stream", "Nonce", "Digest", "Vector", "Segment",
  "Chunk", "Ledger", "Shard", "Envelope", "Token", "Frame", "Lattice",
  "Anchor", "Manifest", "Slab", "Rotor",
];

const SUFFIX = ["Ctx", "Ref", "Buf", "Map", "Node", "Pool", "Queue", "Slot", ""];

const LEVELS = ["ok", "inf", "dbg", "wrn", "trc"];

const HEX = "0123456789ABCDEF";

const pick = <T,>(arr: readonly T[], seed: string): T =>
  arr[Math.floor(random(seed) * arr.length) % arr.length];

const hexRun = (seed: string, len: number): string => {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += HEX[Math.floor(random(`${seed}-${i}`) * 16) % 16];
  }
  return s;
};

const num = (seed: string, digits: number): string =>
  Math.floor(random(seed) * Math.pow(10, digits))
    .toString()
    .padStart(digits, "0");

/** One line of illegible backdrop text. */
export const codeLine = (seed: string): string => {
  const kind = Math.floor(random(`${seed}-k`) * 5);
  switch (kind) {
    case 0:
      return `${pick(VERBS, `${seed}-v`)}${pick(NOUNS, `${seed}-n`)}${pick(
        SUFFIX,
        `${seed}-s`,
      )}(0x${hexRun(`${seed}-h`, 6)});`;
    case 1:
      return `0x${hexRun(`${seed}-h`, 8)}  ${hexRun(`${seed}-i`, 4)} ${hexRun(
        `${seed}-j`,
        4,
      )} ${hexRun(`${seed}-l`, 4)}`;
    case 2:
      return `[${pick(LEVELS, `${seed}-lv`)}] ${pick(
        NOUNS,
        `${seed}-n`,
      ).toLowerCase()} ${num(`${seed}-d`, 4)} ${pick(VERBS, `${seed}-v`)}ed`;
    case 3:
      return `.${pick(NOUNS, `${seed}-n`).toLowerCase()}_${num(
        `${seed}-d`,
        3,
      )} = ${num(`${seed}-e`, 2)}.${num(`${seed}-f`, 3)}`;
    default:
      return `${pick(VERBS, `${seed}-v`)}_${pick(
        NOUNS,
        `${seed}-n`,
      ).toLowerCase()} <- ${hexRun(`${seed}-h`, 5)}h`;
  }
};

/** Short label / value pair for a side panel row. */
export const panelRow = (
  seed: string,
): { label: string; value: string } => ({
  label: `${pick(VERBS, `${seed}-v`).toUpperCase()}.${pick(
    NOUNS,
    `${seed}-n`,
  )
    .slice(0, 4)
    .toUpperCase()}`,
  value: `${num(`${seed}-val`, 4)}`,
});

export const panelTitle = (seed: string): string =>
  `${pick(NOUNS, `${seed}-t`).toUpperCase()} ${hexRun(`${seed}-th`, 3)}`;

/** A run of garbage glyphs, for the column that corrupts on failure. */
export const garble = (seed: string, len: number): string => {
  const chars = "!@#$%&*<>/\\|=+-_?~^0123456789ABCDEF";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(random(`${seed}-${i}`) * chars.length) % chars.length];
  }
  return s;
};
