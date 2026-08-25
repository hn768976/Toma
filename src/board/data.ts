import { random } from 'remotion';
import {
  FPS,
  GREEN,
  LOOP,
  OFFWHITE,
  PLANE_DESAT,
  RED,
  REROLL_MIN_GAP,
  REROLLS_PER_SEC,
  ROWS_PER_LOOP,
  TEAL,
  type RGB,
} from './constants';

/**
 * A single board entry.
 *
 * `value` is kept alongside the formatted string so a reroll can tick the
 * number rather than redraw it from scratch. The colour is pre-desaturated
 * once per depth plane, so the draw loop never does colour maths.
 */
export type Cell = {
  text: string;
  value: number;
  rgb: [RGB, RGB, RGB];
};

const desaturate = (c: RGB, amount: number): RGB => {
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return [
    c[0] + (lum - c[0]) * amount,
    c[1] + (lum - c[1]) * amount,
    c[2] + (lum - c[2]) * amount,
  ];
};

const cell = (text: string, value: number, base: RGB): Cell => ({
  text,
  value,
  rgb: [
    desaturate(base, PLANE_DESAT[0]),
    desaturate(base, PLANE_DESAT[1]),
    desaturate(base, PLANE_DESAT[2]),
  ],
});

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

// ── Column formats ─────────────────────────────────────────────────────────
//
// Each column keeps one consistent format for its whole life. `RANGE` bounds
// it, `tick` is how far one live update may move it, and the exponents skew
// the initial draw toward the low end of the range — which is what the
// reference board does: mostly small numbers, the occasional large one.

type Format = {
  range: [number, number];
  tick: number;
  /** Relative ticks scale with the value; absolute ones do not. */
  relative?: boolean;
  seed: (r: number) => number;
  fmt: (v: number) => string;
};

const FORMATS: Format[] = [
  // Col 1 — signed change, always positive.
  {
    range: [0.1, 4.5],
    tick: 0.15,
    seed: (r) => 0.1 + 4.4 * Math.pow(r, 2.2),
    fmt: (v) => `+${v.toFixed(2)}`,
  },
  // Col 2 — signed percentage, tightly clustered near +5%. Its tick is small
  // relative to the gap between neighbouring rows, so a live update nudges the
  // last digit and only occasionally swaps two adjacent places. A larger tick
  // scrambles the ordering within a few seconds and the leaderboard read is
  // the whole point of the column.
  {
    range: [4.95, 5.3],
    tick: 0.013,
    seed: (r) => 4.95 + 0.35 * r,
    fmt: (v) => `+${v.toFixed(2)}%`,
  },
  // Col 3 — bare percentage, no sign.
  {
    range: [0.2, 8.5],
    tick: 0.4,
    seed: (r) => 0.2 + 8.3 * Math.pow(r, 1.6),
    fmt: (v) => `${v.toFixed(2)}%`,
  },
  // Cols 4–5 — bare price.
  {
    range: [2.5, 65],
    tick: 0.007,
    relative: true,
    seed: (r) => 2.5 + 62.5 * Math.pow(r, 1.4),
    fmt: (v) => v.toFixed(2),
  },
];

const formatFor = (col: number) => FORMATS[Math.min(col, FORMATS.length - 1)];

/**
 * Colour mix for the price columns.
 *
 * Column 4 alternates red and teal with almost no white; column 5 is mostly
 * off-white with a scattering of the other two. Columns 1 and 2 are green
 * without exception — that asymmetry is what makes the board read as a real
 * one rather than as randomly coloured numbers.
 */
const priceColor = (col: number, r: number): RGB => {
  if (col === 3) return r < 0.42 ? RED : r < 0.9 ? TEAL : OFFWHITE;
  return r < 0.22 ? RED : r < 0.36 ? TEAL : OFFWHITE;
};

const colorFor = (col: number, seed: string): RGB => {
  if (col === 0 || col === 1) return GREEN;
  if (col === 2) return OFFWHITE;
  return priceColor(col, random(seed));
};

/**
 * Build every column's cyclic row list.
 *
 * Seeded, and called once behind a useMemo. Regenerating these per frame is
 * what would make every number on the board strobe.
 */
export const buildColumns = (): Cell[][] => {
  const cols: Cell[][] = [];

  const make = (col: number, i: number, r: number) => {
    const f = formatFor(col);
    const v = f.seed(r);
    return cell(f.fmt(v), v, colorFor(col, `k${col}-${i}`));
  };

  cols.push(
    Array.from({ length: ROWS_PER_LOOP[0] }, (_, i) => make(0, i, random(`c0-${i}`))),
  );

  // Column 2 is a sorted leaderboard, descending down the list. It wraps once
  // per cycle, which reads as the page boundary of a longer ranking rather
  // than as an error — every value is "+5.something", so the step back up at
  // the seam is small and there is no header to contradict it.
  cols.push(
    Array.from({ length: ROWS_PER_LOOP[1] }, (_, i) => random(`c1-${i}`))
      .sort((a, b) => b - a)
      .map((r, i) => make(1, i, r)),
  );

  cols.push(
    Array.from({ length: ROWS_PER_LOOP[2] }, (_, i) => make(2, i, random(`c2-${i}`))),
  );

  // Column 4 holds the prices; column 5 shadows them with a fraction of a
  // percent of drift, the way a last/close pair does on a real board. The two
  // scroll at different speeds, so the pairing walks a row at a time.
  const c3 = Array.from({ length: ROWS_PER_LOOP[3] }, (_, i) =>
    make(3, i, random(`c3-${i}`)),
  );
  cols.push(c3);
  cols.push(
    Array.from({ length: ROWS_PER_LOOP[4] }, (_, i) => {
      const v = c3[i % c3.length].value * (1 + (random(`d4-${i}`) - 0.5) * 0.016);
      return cell(formatFor(4).fmt(v), v, colorFor(4, `k4-${i}`));
    }),
  );

  return cols;
};

// ── Live feed ──────────────────────────────────────────────────────────────

export type RerollEvent = { frame: number; cell: Cell };

/** Per-cell reroll history, keyed `column:row`. Cells that never change are absent. */
export type Schedule = Map<string, RerollEvent[]>;

/**
 * One live update: the value ticks off its current level rather than being
 * drawn fresh.
 *
 * This matters for more than realism. Column 2 is a sorted leaderboard and
 * columns 4 and 5 are a matched pair; a uniform redraw would scramble both
 * within a couple of seconds, and the board would stop reading as a board.
 */
const tickCell = (col: number, prev: Cell, seed: string): Cell => {
  const f = formatFor(col);
  const step = (random(seed) - 0.5) * 2 * f.tick;
  const next = clamp(
    f.relative ? prev.value * (1 + step) : prev.value + step,
    f.range[0],
    f.range[1],
  );
  return { text: f.fmt(next), value: next, rgb: prev.rgb };
};

/**
 * Pre-compute every value change in the loop.
 *
 * Roughly four cells per second reroll somewhere on the board, picked by a
 * seeded per-frame hash. Everything keys off `frame % LOOP`, so the schedule
 * repeats identically and the loop closes.
 *
 * The minimum gap between two rerolls of the same cell is enforced cyclically,
 * including across the seam from the last event back to the first, so a cell
 * can never reroll while it is still mid-flash.
 */
export const buildSchedule = (columns: Cell[][]): Schedule => {
  const schedule: Schedule = new Map();
  const lastFire = new Map<string, number>();
  const gate = REROLLS_PER_SEC / FPS;

  for (let f = 0; f < LOOP; f++) {
    if (random(`fire-${f}`) >= gate) continue;

    const col = Math.floor(random(`fire-col-${f}`) * columns.length);
    const row = Math.floor(random(`fire-row-${f}`) * ROWS_PER_LOOP[col]);
    const key = `${col}:${row}`;

    const prev = lastFire.get(key);
    if (prev !== undefined && f - prev < REROLL_MIN_GAP) continue;

    const events = schedule.get(key) ?? [];
    const from = events.length ? events[events.length - 1].cell : columns[col][row];
    events.push({ frame: f, cell: tickCell(col, from, `v-${key}-${f}`) });
    schedule.set(key, events);
    lastFire.set(key, f);
  }

  // Close the seam: if a cell's last event of the loop lands too close to its
  // first, the flash would still be running when the loop restarts and
  // re-fires it. Drop the tail event rather than let the two overlap.
  for (const events of schedule.values()) {
    while (
      events.length > 1 &&
      LOOP - events[events.length - 1].frame + events[0].frame < REROLL_MIN_GAP
    ) {
      events.pop();
    }
  }

  return schedule;
};

/**
 * The cell shown at `frame`, and how long ago it changed.
 *
 * Before a cell's first event of the loop it shows the value from its *last*
 * event — the state carried in from the previous pass — which is what makes
 * the value track cyclic rather than just the schedule.
 */
export const cellAt = (
  events: RerollEvent[] | undefined,
  base: Cell,
  frame: number,
): { cell: Cell; age: number } => {
  if (!events || events.length === 0) return { cell: base, age: Infinity };

  let idx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].frame <= frame) {
      idx = i;
      break;
    }
  }

  if (idx === -1) {
    const last = events[events.length - 1];
    return { cell: last.cell, age: frame + LOOP - last.frame };
  }
  return { cell: events[idx].cell, age: frame - events[idx].frame };
};
