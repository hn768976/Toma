import { random } from "remotion";
import type { Timing } from "./variants";

/**
 * The typing engine. One implementation, driven by a term string and a timing
 * schedule — every version uses it unchanged.
 *
 * A person does not type on a metronome, so the schedule is built from three
 * ingredients and only then stretched to fill the window it has been given:
 *   · a base interval that varies between 2 and 11 frames per character,
 *   · a 12-20 frame hesitation at word boundaries — thinking about the next
 *     word,
 *   · occasional bursts of 3-4 characters at 2 frames each, the way a familiar
 *     word comes out in one movement.
 *
 * The stretch is a single multiplier applied to every interval, so the
 * relative rhythm — the contrast between a burst and a hesitation — survives
 * intact while the phase still lands exactly on the frame the cycle asks for.
 */

export type Schedule = {
  /** appear[i] = frame at which character i becomes visible. */
  appear: number[];
  /** Frames between successive deletions. */
  deleteInterval: number;
  /** Every frame at which the visible text changes, ascending. */
  changes: number[];
};

const BASE_MIN = 2;
const BASE_SPREAD = 10; // 2..11 inclusive
const PAUSE_MIN = 12;
const PAUSE_SPREAD = 9; // 12..20 inclusive
const BURST_INTERVAL = 2;
const BURST_CHANCE = 0.25;
const BURST_COOLDOWN = 3; // characters that must pass before another burst

/** Raw, unstretched frame intervals before each character. */
const rawIntervals = (term: string, seed: string): number[] => {
  const n = term.length;
  const out: number[] = [];
  let burstLeft = 0;
  let cooldown = 0;

  for (let i = 0; i < n; i++) {
    if (cooldown > 0) {
      cooldown--;
    }
    if (term.charAt(i) === " ") {
      // The hesitation lands on the space, so the gap opens after a completed
      // word rather than in the middle of the next one.
      out.push(PAUSE_MIN + Math.floor(random(`${seed}:pause:${i}`) * PAUSE_SPREAD));
      burstLeft = 0;
      continue;
    }
    if (burstLeft > 0) {
      out.push(BURST_INTERVAL);
      burstLeft--;
      if (burstLeft === 0) {
        cooldown = BURST_COOLDOWN;
      }
      continue;
    }
    const nextSpace = term.indexOf(" ", i);
    const runLeft = nextSpace === -1 ? n - i : nextSpace - i;
    if (cooldown === 0 && runLeft >= 4 && random(`${seed}:burst:${i}`) < BURST_CHANCE) {
      // 3 or 4 characters at the burst interval, this one included.
      burstLeft = 2 + Math.round(random(`${seed}:burstlen:${i}`));
      out.push(BURST_INTERVAL);
      continue;
    }
    out.push(BASE_MIN + Math.floor(random(`${seed}:gap:${i}`) * BASE_SPREAD));
  }
  return out;
};

export const buildSchedule = (term: string, timing: Timing, seed: string): Schedule => {
  const n = term.length;
  const intervals = rawIntervals(term, seed);

  // The first character lands on typeStart; the rest share the window.
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += intervals[i];
  }
  const span = timing.typeEnd - timing.typeStart;
  const stretch = total === 0 ? 1 : span / total;

  const appear: number[] = [timing.typeStart];
  let cumulative = 0;
  for (let i = 1; i < n; i++) {
    cumulative += intervals[i];
    const frame = timing.typeStart + Math.round(cumulative * stretch);
    // Guard against a collision if a term is ever too long for its window.
    const previous = appear[i - 1];
    appear.push(frame > previous ? frame : previous + 1);
  }

  // Deletion is quicker and perfectly even — no hesitations on the way out.
  const deleteInterval =
    timing.deletion === null ? 0 : (timing.deletion.end - timing.deletion.start) / n;

  const changes = appear.slice();
  if (timing.deletion !== null) {
    for (let i = 1; i <= n; i++) {
      changes.push(timing.deletion.start + i * deleteInterval);
    }
  }

  return { appear, deleteInterval, changes };
};

/** How many characters of the term are on screen at this frame. */
export const visibleCount = (frame: number, term: string, timing: Timing, s: Schedule): number => {
  const n = term.length;
  if (frame < timing.typeStart) {
    return 0;
  }
  // With no deletion the finished term simply stays up.
  if (timing.deletion === null || frame < timing.deletion.start) {
    let count = 0;
    while (count < n && s.appear[count] <= frame) {
      count++;
    }
    return count;
  }
  if (frame >= timing.deletion.end) {
    return 0;
  }
  const removed = Math.floor((frame - timing.deletion.start) / s.deleteInterval);
  const left = n - removed;
  return left < 0 ? 0 : left;
};

/** Frames of stillness after which the cursor is allowed to start blinking. */
const SOLID_HOLD = 12;
export const BLINK_CYCLE = 30; // divides 480 evenly, so the loop closes

/**
 * Solid while characters are actively appearing or disappearing, blinking only
 * once the field has been still for a moment. That is what separates a text
 * field from a caption.
 */
export const cursorOpacity = (frame: number, s: Schedule): number => {
  let lastChange = -Infinity;
  for (let i = 0; i < s.changes.length; i++) {
    if (s.changes[i] <= frame && s.changes[i] > lastChange) {
      lastChange = s.changes[i];
    }
  }
  if (frame - lastChange < SOLID_HOLD) {
    return 1;
  }
  return frame % BLINK_CYCLE < BLINK_CYCLE / 2 ? 1 : 0;
};
