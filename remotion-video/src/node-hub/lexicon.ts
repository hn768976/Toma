/**
 * Fictional filler vocabulary for the side chrome.
 *
 * Everything the panels display is invented: nonsense tokens, made-up channel
 * names and random numerals. None of it is real code, a real product name, or
 * a real trademark — it exists only to give the panels the texture of dense
 * technical readout at a size where nobody reads it.
 *
 * This is generated texture, not variant identity; the copy that names a
 * piece (the label plate, the hub text) lives in VARIANTS.
 */
import { pick, randInt } from "./seed";

const TOKENS = [
  "SYNQ", "VLTR", "NODE", "GRID", "PHZE", "ARCX", "KVAR", "TRXN",
  "DLTA", "MRDX", "OBSV", "LNKR", "SEQN", "BNDW", "QRTZ", "XPDR",
  "FLUX", "HEXR", "IONZ", "JTTR", "KRNL", "LMDA", "MTRX", "NVEC",
] as const;

const PREFIXES = ["SYS", "CH", "REF", "IDX", "SRC", "TRK", "BUS", "VEC"] as const;

const UNITS = ["MS", "KB", "HZ", "PCT", "DB", "NM", "PX", "RAD"] as const;

const STATES = ["OK", "RDY", "HLD", "SYN", "ACT", "IDL", "LNK"] as const;

/** A short all-caps token, e.g. "VLTR". */
export const token = (seed: string): string => pick(`${seed}/tok`, TOKENS);

/** A prefixed channel name, e.g. "CH-14". */
export const channel = (seed: string): string =>
  `${pick(`${seed}/pfx`, PREFIXES)}-${randInt(`${seed}/num`, 2, 98)
    .toString()
    .padStart(2, "0")}`;

export const unit = (seed: string): string => pick(`${seed}/unit`, UNITS);

export const state = (seed: string): string => pick(`${seed}/state`, STATES);

/** A fixed-width decimal, e.g. "047.82". */
export const numeric = (
  seed: string,
  digits: number,
  decimals: number,
): string => {
  const whole = randInt(`${seed}/whole`, 0, Math.pow(10, digits) - 1)
    .toString()
    .padStart(digits, "0");
  if (decimals === 0) return whole;
  const frac = randInt(`${seed}/frac`, 0, Math.pow(10, decimals) - 1)
    .toString()
    .padStart(decimals, "0");
  return `${whole}.${frac}`;
};

/** A two-digit value for the large readouts. */
export const twoDigit = (seed: string): string =>
  randInt(`${seed}/two`, 10, 99).toString();

const HEX_DIGITS = "0123456789ABCDEF";

/** A run of hex, for the dense illegible monospace blocks. */
export const hexRun = (seed: string, length: number): string => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += HEX_DIGITS[randInt(`${seed}/hex/${i}`, 0, 15)];
  }
  return out;
};

/** A run of binary, the other texture the mono blocks use. */
export const bitRun = (seed: string, length: number): string => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += randInt(`${seed}/bit/${i}`, 0, 1) === 1 ? "1" : "0";
  }
  return out;
};
