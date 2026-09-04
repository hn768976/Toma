/**
 * Quote values as pure functions of the frame number.
 *
 * Remotion renders frames out of order and across threads, so nothing here
 * accumulates or holds state: every figure is computed from (pairIndex,
 * frame) alone. Every ingredient is periodic with DURATION_IN_FRAMES, so
 * frame 480 reproduces frame 0 exactly.
 *
 * The model matches how a real board reads:
 *
 *   value  = base * (1 + drift)
 *   change = base * drift
 *   pct    = drift * 100
 *
 * One underlying number, three printed figures — they cannot disagree.
 */

import { DURATION_IN_FRAMES } from "./constants";
import { PAIRS, changeDecimals, rateDecimals } from "./pairs";

/** Frame counts a quote holds a value for. All divide 480 exactly. */
const TICK_PERIODS = [10, 12, 15, 16, 20, 24, 30, 32];

/** Frames a post-update highlight stays lit. */
export const FLASH_FRAMES = 4;

/**
 * A tick only flashes if it moved the rate by at least this many units of
 * its last printed decimal. Sub-threshold ticks still redraw the digits,
 * they just do it quietly — which is what keeps a handful of quotes lit at
 * any moment instead of the whole board.
 */
const FLASH_MIN_TICKS = 2.5;

/** Largest steady session move for an ordinary pair: +/- 2.6 %. */
const SESSION_MAX = 0.026;
/** Smallest, so an ordinary pair keeps its direction for the whole loop. */
const SESSION_MIN = 0.0025;
/** Slow wander around the session move for an ordinary pair. */
const WANDER_AMPLITUDE = 0.0002;

/**
 * One pair in ten is unsettled: no session bias, a much wider swing, and so
 * it crosses zero during the loop — its triangle and colour flip with it.
 */
const UNSETTLED_SHARE = 0.1;
const UNSETTLED_AMPLITUDE = 0.005;

/**
 * Micro noise, sized so it moves the last printed decimal by about a unit.
 * The rate-decimal rule in pairs.ts keeps that last decimal worth roughly
 * 0.006-0.010 % of the value for every pair, so one relative amplitude
 * works across the whole board.
 */
const MICRO_AMPLITUDE = 0.00006;

/** Deterministic scalar hash -> [0, 1). */
const hash = (n: number): number => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

type QuoteStatics = {
  readonly tickPeriod: number;
  readonly tickPhase: number;
  readonly sessionDrift: number;
  readonly wander: number;
  readonly phases: readonly number[];
  readonly rateDp: number;
  readonly changeDp: number;
  readonly tickUnit: number;
};

const buildStatics = (i: number): QuoteStatics => {
  const tickPeriod =
    TICK_PERIODS[Math.floor(hash(i * 5 + 11) * TICK_PERIODS.length)];
  const tickPhase = Math.floor(hash(i * 5 + 12) * DURATION_IN_FRAMES);

  const unsettled = hash(i * 5 + 14) < UNSETTLED_SHARE;
  const sign = hash(i * 5 + 15) < 0.5 ? -1 : 1;
  const sessionDrift = unsettled
    ? 0
    : sign * (SESSION_MIN + hash(i * 5 + 13) * (SESSION_MAX - SESSION_MIN));
  const wander = unsettled ? UNSETTLED_AMPLITUDE : WANDER_AMPLITUDE;

  const phases = [
    hash(i * 7 + 21),
    hash(i * 7 + 22),
    hash(i * 7 + 23),
    hash(i * 7 + 24),
    hash(i * 7 + 25),
  ];

  const base = PAIRS[i].base;
  const rateDp = rateDecimals(base);
  return {
    tickPeriod,
    tickPhase,
    sessionDrift,
    wander,
    phases,
    rateDp,
    changeDp: changeDecimals(base),
    tickUnit: Math.pow(10, -rateDp),
  };
};

const STATICS: readonly QuoteStatics[] = PAIRS.map((_, i) => buildStatics(i));

const TAU = Math.PI * 2;

/**
 * Relative move away from `base` at a quantised point in the loop.
 * `u` is a fraction of the loop, so integer harmonics are exactly periodic
 * and the whole walk returns to where it started at frame 480.
 */
const driftAt = (st: QuoteStatics, u: number): number => {
  const p = st.phases;
  const wander =
    st.wander *
    (Math.sin(TAU * (1 * u + p[0])) + 0.5 * Math.sin(TAU * (2 * u + p[1])));
  const micro =
    MICRO_AMPLITUDE *
    (Math.sin(TAU * (11 * u + p[2])) +
      0.6 * Math.sin(TAU * (19 * u + p[3])) +
      0.4 * Math.sin(TAU * (29 * u + p[4])));
  return st.sessionDrift + wander + micro;
};

const signed = (v: number, dp: number): string =>
  (v < 0 ? "-" : "+") + Math.abs(v).toFixed(dp);

export type Quote = {
  readonly code: string;
  readonly rate: string;
  readonly change: string;
  readonly pct: string;
  readonly up: boolean;
  /** 0 = no highlight, 1 = full highlight on the frame the value changed. */
  readonly flash: number;
};

const valueAt = (i: number, u: number): number =>
  PAIRS[i].base * (1 + driftAt(STATICS[i], u));

export const quoteAt = (pairIndex: number, frame: number): Quote => {
  const len = PAIRS.length;
  const i = ((pairIndex % len) + len) % len;
  const st = STATICS[i];
  const base = PAIRS[i].base;

  // Everything is expressed in loop-local time, so frame 480 == frame 0.
  const local =
    (((frame + st.tickPhase) % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) %
    DURATION_IN_FRAMES;
  const tickStart = Math.floor(local / st.tickPeriod) * st.tickPeriod;

  const drift = driftAt(st, tickStart / DURATION_IN_FRAMES);
  const value = base * (1 + drift);

  let flash = 0;
  const framesSinceTick = local - tickStart;
  if (framesSinceTick < FLASH_FRAMES) {
    const prevStart =
      (tickStart - st.tickPeriod + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
    const before = valueAt(i, prevStart / DURATION_IN_FRAMES);
    if (Math.abs(value - before) >= FLASH_MIN_TICKS * st.tickUnit) {
      flash = 1 - framesSinceTick / FLASH_FRAMES;
    }
  }

  return {
    code: PAIRS[i].code,
    rate: value.toFixed(st.rateDp),
    change: signed(base * drift, st.changeDp),
    pct: signed(drift * 100, 2) + " %",
    up: drift >= 0,
    flash,
  };
};

/**
 * Which pair sits in a given lattice cell.
 *
 * The loop shifts the board by SCROLL_BLOCKS_PER_LOOP columns and
 * SCROLL_ROWS_PER_LOOP rows, so seamlessness requires
 *
 *   pairIndexFor(row, col) === pairIndexFor(row - MY, col - MX)
 *
 * Writing the index as a function of (col * MY - row * MX) satisfies that
 * identity for any sequence, which frees the along-a-row order from having
 * to repeat every MX blocks — with a purely horizontal scroll it would have
 * to, three times over in every row. Stepping the table by a stride coprime
 * with its length keeps neighbouring cells unrelated.
 */
const STRIDE = 17;

export const pairIndexFor = (
  row: number,
  col: number,
  mx: number,
  my: number,
): number => {
  const n = col * my - row * mx;
  const len = PAIRS.length;
  return (((n * STRIDE) % len) + len) % len;
};
