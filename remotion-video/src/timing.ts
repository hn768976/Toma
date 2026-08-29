// Single source of truth for the caption timeline.
//
// FPS mismatch is the classic failure in the transcribe → animate workflow:
// captions are in milliseconds, Remotion works in frames. The frame rate is
// hardcoded here and nowhere else — everything else imports it.

export const FPS = 30;

/** Caption timestamp (ms) → absolute frame number in the composition. */
export const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);

/** Frame number → milliseconds, for reading a caption back off the timeline. */
export const frameToMs = (frame: number) => (frame / FPS) * 1000;

/**
 * Frames a caption occupies, floored at 1 so a very short word never collapses
 * to a zero-length sequence.
 */
export const captionDurationInFrames = (caption: {
  startMs: number;
  endMs: number;
}) => Math.max(1, msToFrame(caption.endMs) - msToFrame(caption.startMs));
