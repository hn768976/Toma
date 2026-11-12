/**
 * Global knobs. Each is one data row (see README "Tweaking").
 * Changing any of them keeps every clip deterministic and the 600-frame loop seamless.
 */

/** Flicker speed: a card is held for this many frames (min, max) before swapping. */
export const HOLD_FRAMES: [number, number] = [2, 4];

/** Texture density multiplier per look (1 = as designed; 0.5 = sparser; 1.5 = busier). */
export const DENSITY = { ScratchGrunge: 1, PhotocopyGrunge: 1, CharcoalGrunge: 1, BrushFrame: 1 };

/** Background of CharcoalGrunge_Orange. */
export const ORANGE = "#E0920A";

// ---------------------------------------------------------------------------
// Fixed format (the compositions are defined at 4K; render previews with --scale).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** Loop length: the card schedule repeats exactly every LOOP_FRAMES frames. */
export const LOOP_FRAMES = 600;
/** Number of texture cards per look. */
export const CARD_COUNT = 12;
/** How many rendered cards are kept in memory at once. */
export const CARD_CACHE_SIZE = 4;
/** Cards are generated this much larger than the frame on every side, so gate weave never shows an edge. */
export const BLEED = 0.02;
