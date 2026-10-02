// Style A event schedule. Built ONCE per word at module load from that word's
// seed (mulberry32). At render time we only look up what's active at a frame.
import { WORDS } from "../words";
import { hash01, int, mulberry32, pick, range, Rng } from "../lib/random";

export const A_DURATION = 300;
export const REVEAL_START = 30;
export const REVEAL_END = 75;
// Frames kept free of word glitches so the frame-200 still is always clean.
export const CLEAN_WINDOW: [number, number] = [190, 210];

export const GLITCH_CHARS = "0123456789ABCDEF#$%&@!?<>/\\=+*";
export const CODE_CHARS = "0123456789ABCDEF0123456789ABCDEFxXZKQ";

// Vertical band (fraction of height) that skulls/streaks/blocks never enter,
// so nothing is drawn over the word.
export const WORD_BAND: [number, number] = [0.36, 0.64];

export type SliceEvent = {
  start: number;
  len: number;
  // Horizontal bands, as fractions of cap height around the word (-0.3..1.3),
  // each with an x offset as a fraction of frame width.
  bands: { y0: number; y1: number; dx: number }[];
};
export type WordBurst = {
  start: number;
  len: number;
  kind: "slice" | "rgb" | "swap";
  slice?: SliceEvent["bands"];
  letter?: number;
  char?: string;
};
export type Streak = {
  start: number;
  len: number;
  y: number; // fraction of H
  h: number; // fraction of H
  x: number; // fraction of W
  w: number; // fraction of W
  color: string;
  opacity: number;
  drift: number; // fraction of W per frame
};
export type PixelCluster = {
  start: number;
  len: number;
  x: number; // fraction of W
  y: number; // fraction of H
  cell: number; // fraction of H
  cells: { i: number; j: number; color: string; o: number }[];
};
export type SkullEvent = {
  start: number;
  len: number;
  x: number; // centre, fraction of W
  y: number; // centre, fraction of H
  size: number; // fraction of H
  color: string;
  big: boolean;
};
export type FieldShift = { start: number; len: number; dx: number };
export type LetterReveal = { appear: number; settle: number };

export type AttackSchedule = {
  reveal: LetterReveal[];
  revealSlices: SliceEvent[];
  bursts: WordBurst[];
  streaks: Streak[];
  clusters: PixelCluster[];
  skulls: SkullEvent[];
  shifts: FieldShift[];
};

export const PINK = "#ff2a6d";
export const HOT_PINK = "#ff2bd1";
export const CYAN = "#22f0ff";

const outsideBand = (rng: Rng, half: number) => {
  // A y centre whose [y-half, y+half] stays clear of WORD_BAND.
  const top = rng() < 0.5;
  return top
    ? range(rng, 0.04 + half, WORD_BAND[0] - half)
    : range(rng, WORD_BAND[1] + half, 0.96 - half);
};

const overlaps = (s: number, len: number, w: [number, number]) =>
  s <= w[1] && s + len - 1 >= w[0];

const makeBands = (rng: Rng, n: number, maxDx: number) => {
  const cuts = Array.from({ length: n - 1 }, () => range(rng, -0.1, 1.1)).sort(
    (a, b) => a - b,
  );
  const edges = [-0.6, ...cuts, 1.6];
  return edges.slice(0, -1).map((y0, k) => ({
    y0,
    y1: edges[k + 1],
    dx: rng() < 0.35 ? 0 : range(rng, -maxDx, maxDx),
  }));
};

export const buildAttackSchedule = (
  seed: number,
  letterCount: number,
): AttackSchedule => {
  const rng = mulberry32(seed);

  // Reveal: letters appear out of order between 30 and ~62, settle by 74.
  const reveal = Array.from({ length: letterCount }, () => {
    const appear = int(rng, REVEAL_START, 60);
    const settle = Math.min(REVEAL_END - 1, appear + int(rng, 6, 16));
    return { appear, settle };
  });
  const revealSlices: SliceEvent[] = [];
  for (let f = REVEAL_START; f < REVEAL_END - 4; ) {
    const len = int(rng, 1, 3);
    const t = (f - REVEAL_START) / (REVEAL_END - REVEAL_START);
    revealSlices.push({
      start: f,
      len,
      bands: makeBands(rng, int(rng, 3, 6), 0.05 * (1 - 0.7 * t)),
    });
    f += len + (rng() < 0.75 - 0.5 * t ? 0 : int(rng, 1, 3));
  }

  // Hold bursts: about once a second, 2-4 frames each.
  const bursts: WordBurst[] = [];
  for (let f = REVEAL_END + int(rng, 14, 26); f < A_DURATION - 3; ) {
    const len = int(rng, 2, 4);
    if (!overlaps(f, len, CLEAN_WINDOW)) {
      const r = rng();
      const kind = r < 0.45 ? "slice" : r < 0.75 ? "rgb" : "swap";
      bursts.push({
        start: f,
        len,
        kind,
        slice: kind === "slice" ? makeBands(rng, int(rng, 2, 4), 0.018) : undefined,
        letter: int(rng, 0, letterCount - 1),
        char: pick(rng, GLITCH_CHARS.split("")),
      });
    }
    f += len + int(rng, 24, 40);
  }

  // Streak bars and pixel clusters: heavy in the intro, then occasional.
  const streaks: Streak[] = [];
  const clusters: PixelCluster[] = [];
  for (let f = 0; f < A_DURATION; f++) {
    const heavy = f < REVEAL_START;
    const nS = rng() < (heavy ? 0.95 : 0.3) ? int(rng, 1, heavy ? 3 : 1) : 0;
    for (let k = 0; k < nS; k++) {
      const h = range(rng, 0.0015, heavy ? 0.022 : 0.012);
      streaks.push({
        start: f,
        len: int(rng, 1, 4),
        y: outsideBand(rng, h),
        h,
        x: range(rng, -0.2, 0.7),
        w: range(rng, 0.15, heavy ? 1.1 : 0.7),
        color: rng() < 0.55 ? HOT_PINK : CYAN,
        opacity: range(rng, 0.45, 0.95),
        drift: range(rng, -0.05, 0.05),
      });
    }
    if (rng() < (heavy ? 0.8 : 0.18)) {
      const cell = range(rng, 0.008, 0.02);
      const cols = int(rng, 3, 9);
      const rows = int(rng, 2, 4);
      const cells = [];
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++)
          if (rng() < 0.55)
            cells.push({
              i,
              j,
              color: rng() < 0.55 ? HOT_PINK : CYAN,
              o: range(rng, 0.3, 0.9),
            });
      clusters.push({
        start: f,
        len: int(rng, 2, 6),
        x: range(rng, 0.0, 0.95),
        y: outsideBand(rng, (rows * cell) / 2 + 0.01),
        cell,
        cells,
      });
    }
  }

  // Skulls: a few at a time, plus 2-3 big ones near the word.
  const skulls: SkullEvent[] = [];
  for (let f = int(rng, 0, 6); f < A_DURATION; f += int(rng, 5, 13)) {
    const cyan = rng() < 0.3;
    const size = cyan ? range(rng, 0.022, 0.045) : range(rng, 0.03, 0.075);
    skulls.push({
      start: f,
      len: int(rng, 16, 46),
      x: range(rng, 0.04, 0.96),
      y: outsideBand(rng, size * 0.55),
      size,
      color: cyan ? CYAN : PINK,
      big: false,
    });
  }
  const bigTimes = [int(rng, 40, 90), int(rng, 130, 175), int(rng, 225, 265)];
  bigTimes.forEach((t) => {
    const size = range(rng, 0.15, 0.2);
    const above = rng() < 0.5;
    skulls.push({
      start: t,
      len: int(rng, 16, 28),
      x: range(rng, 0.3, 0.7),
      y: above ? WORD_BAND[0] - size * 0.56 : WORD_BAND[1] + size * 0.56,
      size,
      color: PINK,
      big: true,
    });
  });

  // Whole-field jolts.
  const shifts: FieldShift[] = [];
  for (let f = 0; f < A_DURATION; f++) {
    if (rng() < (f < REVEAL_START ? 0.35 : 0.06)) {
      shifts.push({ start: f, len: int(rng, 1, 2), dx: range(rng, -0.02, 0.02) });
    }
  }

  return { reveal, revealSlices, bursts, streaks, clusters, skulls, shifts };
};

// Module level: every Style A word's schedule, built once.
export const ATTACK_SCHEDULES = new Map<number, AttackSchedule>(
  WORDS.filter((w) => w.style === "AttackGlitch").map((w) => [
    w.seed,
    buildAttackSchedule(w.seed, [...w.word].length),
  ]),
);

export const active = <T extends { start: number; len: number }>(
  list: T[],
  frame: number,
) => list.filter((e) => frame >= e.start && frame < e.start + e.len);

// Per-frame "noise" during a letter's reveal, from a pure hash.
export const revealNoise = (seed: number, letter: number, frame: number) =>
  hash01(seed, letter * 131 + 7, Math.floor(frame / 2));
