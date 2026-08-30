/** Fixed geometry of the composition. The canvas backing store is always 4K. */

export const CANVAS_W = 3840;
export const CANVAS_H = 2160;
export const FPS = 30;
export const DURATION = 900;

/** ~24% of the frame height. */
export const SYMBOL_HEIGHT = Math.round(CANVAS_H * 0.24);

/**
 * Symbol sits left of centre in the unmirrored composition; the `blue` variant
 * flips the whole frame so it lands right of centre instead.
 */
export const SYMBOL_CX = 1420;
export const SYMBOL_CY = 1060;

/** The ring field spans roughly 2.2x the symbol's height. */
export const RING_OUTER = (SYMBOL_HEIGHT * 2.2) / 2;

/**
 * Depth of field: the mid and far buffers are kept at half resolution and
 * blurred once each, which is what makes a 30px blur affordable at 4K.
 */
export const HALF_SCALE = 0.5;
export const MID_BLUR = 10;
export const FAR_BLUR = 28;

export const VIGNETTE_STRENGTH = 0.24;
export const GRAIN_ALPHA = 0.04;

/** Ambient camera drift: a closed lissajous, +/-10px, no zoom. */
export const cameraDrift = (frame: number) => {
  const t = (2 * Math.PI * frame) / DURATION;
  return { x: 10 * Math.sin(t), y: 8 * Math.sin(2 * t) };
};

/** Symbol glow pulses +/-10% six times across the loop (900 / 6 = 150). */
export const glowPulse = (frame: number) =>
  1 + 0.1 * Math.sin((2 * Math.PI * frame * 6) / DURATION);
