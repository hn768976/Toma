// Flip choreography traced from the reference (sampled every 0.2 s).
// The reference runs a ~4 s phrase twice: a handful of single flips around
// the edges of the 4x4 grid, then a dense burst through the middle.

export type Hinge = "T" | "B" | "L" | "R";

export type FlipEvent = {
  row: number; // 0 = top
  col: number; // 0 = left
  hinge: Hinge;
  start: number; // seconds (within the phrase)
  peak: number; // degrees
  dur: number; // open + close time in seconds
};

export const GRID = 4;
export const PHRASE = 4.0;
export const DURATION_FRAMES = 234; // reference: 7.8078 s @ 29.97 -> 234 frames @ 30 fps

const e = (
  row: number,
  col: number,
  hinge: Hinge,
  start: number,
  peak = 82,
  dur = 0.78,
): FlipEvent => ({ row, col, hinge, start, peak, dur });

export const PHRASE_EVENTS: FlipEvent[] = [
  // Sparse edge flips
  e(3, 3, "B", 0.02, 78),
  e(0, 3, "B", 0.2, 84),
  e(3, 0, "B", 0.4, 80),
  e(0, 2, "L", 0.86, 86),
  e(0, 1, "R", 1.04, 80),
  e(1, 2, "L", 1.34, 88),
  e(1, 3, "B", 1.56, 80),
  // Build-up into the burst
  e(0, 0, "B", 2.02, 92, 0.82),
  e(3, 1, "B", 2.08, 84),
  e(1, 0, "R", 2.18, 86),
  e(1, 1, "B", 2.3, 95, 0.74),
  e(2, 2, "L", 2.34, 90, 0.72),
  e(2, 0, "T", 2.38, 82, 0.74),
  e(2, 1, "B", 2.44, 88, 0.7),
  e(2, 3, "B", 2.46, 86, 0.72),
  e(3, 2, "L", 2.5, 92, 0.7),
  e(1, 3, "T", 2.52, 80, 0.7),
  e(0, 2, "L", 2.56, 84, 0.72),
  e(0, 1, "R", 2.62, 90, 0.7),
  e(1, 2, "R", 2.66, 84, 0.68),
];

/** All events covering [-PHRASE, duration] so the clip opens mid-motion. */
export const allEvents = (duration: number): FlipEvent[] => {
  const out: FlipEvent[] = [];
  for (let k = -1; k * PHRASE < duration; k++) {
    for (const ev of PHRASE_EVENTS) out.push({ ...ev, start: ev.start + k * PHRASE });
  }
  return out;
};
