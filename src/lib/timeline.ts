export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Seconds -> whole frames. */
export const sec = (s: number) => Math.round(s * FPS);

/**
 * Scene boundaries from the script. Hard cuts only -- every scene owns a
 * contiguous, non-overlapping frame range so nothing can crossfade.
 */
export const SCENES = {
  cut: {from: sec(0), duration: sec(16)}, // 0:00 - 0:16
  route: {from: sec(16), duration: sec(22)}, // 0:16 - 0:38
  reassembly: {from: sec(38), duration: sec(18)}, // 0:38 - 0:56
} as const;

export const TOTAL_FRAMES = SCENES.reassembly.from + SCENES.reassembly.duration;
