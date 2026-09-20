import { CYCLE_FRAMES } from '../config';

/**
 * Type-on / hold / erase timing, measured from the reference clips.
 *
 * Frame-by-frame inspection of the type-on (reference frames 98-113) shows
 * whole letters appearing discretely, never a partial-glyph wipe, at roughly
 * 2.45 frames per character. Brightness integration over the whole clip puts
 * the hold at ~70 cycle-frames and the erase finishing at ~92, leaving a
 * short blank before the cycle restarts.
 *
 * All values are in frames within a single 94.333-frame cycle.
 */
export const TYPE_FRAMES_PER_CHAR = 2.45;
export const HOLD_UNTIL = 70;
export const ERASE_FRAMES_PER_CHAR = 2.2;

export type TypeState = {
  /** How many whole characters are currently shown. */
  visibleChars: number;
  /** Position within the cycle, 0..1, useful for subtle secondary motion. */
  cyclePhase: number;
  /** Whether the caret should be drawn at all. */
  caretVisible: boolean;
};

/**
 * Pure function of the absolute frame -> typing state.
 * Because CYCLE_FRAMES is exactly DURATION_IN_FRAMES / 3, this is perfectly
 * periodic over the composition and the clip loops without a seam.
 */
export const getTypeState = (frame: number, charCount: number): TypeState => {
  const cycleFrame = ((frame % CYCLE_FRAMES) + CYCLE_FRAMES) % CYCLE_FRAMES;
  const cyclePhase = cycleFrame / CYCLE_FRAMES;

  const typeDone = charCount * TYPE_FRAMES_PER_CHAR;
  const eraseStart = HOLD_UNTIL;
  const eraseDone = eraseStart + charCount * ERASE_FRAMES_PER_CHAR;

  let visibleChars: number;
  if (cycleFrame < typeDone) {
    visibleChars = Math.floor(cycleFrame / TYPE_FRAMES_PER_CHAR);
  } else if (cycleFrame < eraseStart) {
    visibleChars = charCount;
  } else if (cycleFrame < eraseDone) {
    visibleChars = charCount - Math.floor((cycleFrame - eraseStart) / ERASE_FRAMES_PER_CHAR);
  } else {
    visibleChars = 0;
  }

  visibleChars = Math.max(0, Math.min(charCount, visibleChars));

  // The reference only ever shows the caret on an empty line: it is there at
  // the top of a cycle (frame 190 of the source) and gone once letters exist
  // (frame 141 shows the word ending flush at the N with nothing after it).
  const caretVisible = visibleChars === 0;

  return { visibleChars, cyclePhase, caretVisible };
};

/** Angle in radians that completes `turns` full rotations over the loop. */
export const loopAngle = (frame: number, duration: number, turns: number) =>
  (frame / duration) * Math.PI * 2 * turns;

/** Sine that completes `cycles` periods over the loop (so it wraps cleanly). */
export const loopSin = (frame: number, duration: number, cycles: number, phase = 0) =>
  Math.sin((frame / duration) * Math.PI * 2 * cycles + phase);
