import { FINAL_BUILD_SECONDS, FLASH_FRAMES } from "./theme";

export type CountState = {
  /** Whole seconds left on the clock, 0-`totalSeconds`. */
  remaining: number;
  minutes: number;
  seconds: number;
  /** True once the count has hit zero and the composition is holding. */
  holding: boolean;
  /** True for the first `FLASH_FRAMES` frames of each displayed second. */
  flashing: boolean;
  /**
   * 0 until the last `FINAL_BUILD_SECONDS`, then rising to 1 at zero and
   * staying there through the hold — the subtle build toward 00:00.
   */
  build: number;
};

/**
 * Derives the whole display state from the frame number alone.
 *
 * Deliberately never reads a clock. Remotion renders frames in parallel
 * and out of order, so anything driven by Date.now() would desynchronise
 * from the frames it was drawn on and the countdown would simply be
 * wrong in the output file.
 *
 * At frame 0 no time has elapsed, so the display reads the full
 * `totalSeconds`. It reaches 00:00 exactly on frame
 * `totalSeconds * fps` and holds there for the rest of the composition.
 */
export const countAt = (
  frame: number,
  fps: number,
  totalSeconds: number,
): CountState => {
  const elapsed = Math.floor(frame / fps);
  const remaining = Math.max(0, Math.min(totalSeconds, totalSeconds - elapsed));
  const holding = elapsed >= totalSeconds;

  const build = holding
    ? 1
    : remaining <= FINAL_BUILD_SECONDS
      ? (FINAL_BUILD_SECONDS - remaining) / FINAL_BUILD_SECONDS
      : 0;

  return {
    remaining,
    minutes: Math.floor(remaining / 60),
    seconds: remaining % 60,
    holding,
    // The hold is a rest on zero, so it does not keep flashing.
    flashing: !holding && frame % fps < FLASH_FRAMES,
    build,
  };
};
