/**
 * Flicker schedule: fixed frames inside the 600-frame loop (seeded, module level).
 * Each event dims one stroke region (bar, stem, diagonal) of one letter for a few frames.
 */
import { mulberry32 } from "./random";
import { LOOP, SEED } from "./constants";

// Stroke regions inside a letter's ink box, (u0, v0, u1, v1) with top-left origin.
const SEGMENTS: [number, number, number, number][] = [
  [0.1, 0.0, 0.9, 0.11], // top
  [0.1, 0.89, 0.9, 1.0], // bottom
  [0.06, 0.44, 0.5, 0.56], // middle left
  [0.5, 0.44, 0.94, 0.56], // middle right
  [0.0, 0.05, 0.16, 0.49], // upper left
  [0.84, 0.05, 1.0, 0.49], // upper right
  [0.0, 0.51, 0.16, 0.95], // lower left
  [0.84, 0.51, 1.0, 0.95], // lower right
  [0.42, 0.08, 0.58, 0.46], // upper centre
  [0.42, 0.54, 0.58, 0.92], // lower centre
  [0.14, 0.1, 0.44, 0.45], // upper-left diagonal
  [0.56, 0.1, 0.86, 0.45], // upper-right diagonal
  [0.14, 0.55, 0.44, 0.9], // lower-left diagonal
  [0.56, 0.55, 0.86, 0.9], // lower-right diagonal
];

type FlickerEvent = { start: number; levels: number[]; letter: number; seg: number };

const build = (): FlickerEvent[] => {
  const rand = mulberry32(SEED ^ 0x2545f491);
  const events: FlickerEvent[] = [];
  const COUNT = 11;
  for (let e = 0; e < COUNT; e++) {
    // Spread events across the loop; each finishes before frame 600.
    const slot = LOOP / COUNT;
    const len = 3 + Math.floor(rand() * 6);
    const start = Math.floor(e * slot + rand() * (slot - len - 2));
    const levels = Array.from({ length: len }, (_, k) =>
      k % 2 === 0 ? 0.08 + rand() * 0.3 : 0.6 + rand() * 0.4,
    );
    events.push({ start, levels, letter: Math.floor(rand() * 64), seg: Math.floor(rand() * SEGMENTS.length) });
  }
  return events;
};

export const FLICKER = build();

/** Active flicker rects (uv, top-left origin) and their brightness factors for a frame. */
export const flickerAt = (
  frame: number,
  cells: { x0: number; x1: number; y0: number; y1: number }[],
) => {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const rects: [number, number, number, number][] = [];
  const amts: number[] = [];
  for (const ev of FLICKER) {
    const k = f - ev.start;
    if (k < 0 || k >= ev.levels.length || rects.length >= 3) continue;
    const c = cells[ev.letter % cells.length];
    const s = SEGMENTS[ev.seg];
    const w = c.x1 - c.x0;
    const h = c.y1 - c.y0;
    rects.push([c.x0 + s[0] * w, c.y0 + s[1] * h, c.x0 + s[2] * w, c.y0 + s[3] * h]);
    amts.push(ev.levels[k]);
  }
  while (rects.length < 3) {
    rects.push([2, 2, 2, 2]);
    amts.push(1);
  }
  return { rects, amts };
};
