/**
 * Typing timing.
 *
 * Strings are sliced by frame rather than built out of per-character
 * components, and each character gets a seeded dwell so the rhythm reads
 * as a person at a keyboard instead of a metronome. A few characters draw
 * a long dwell, which is what produces the small hesitations.
 */
import { rngFor } from "../random";

/** Frame at which each character index has landed. */
export const typeSchedule = (
  key: string,
  length: number,
  from: number,
  to: number,
): number[] => {
  const rand = rngFor(`type:${key}`);
  const weights: number[] = [];
  for (let i = 0; i < length; i++) {
    const roll = rand();
    // ~1 in 7 keystrokes is a noticeably longer beat.
    weights.push(roll < 0.14 ? 1.9 + rand() * 1.4 : 0.5 + rand() * 0.7);
  }
  const total = weights.reduce((a, b) => a + b, 0);

  let acc = 0;
  return weights.map((w) => {
    acc += w;
    return from + (acc / total) * (to - from);
  });
};

/** How many characters are visible on this frame. */
export const typedCount = (frame: number, schedule: number[]): number => {
  let n = 0;
  for (const t of schedule) {
    if (frame >= t) n++;
    else break;
  }
  return n;
};
