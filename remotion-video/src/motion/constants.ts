// Timing and palettes for the four abstract motion-graphic versions.
//
// Durations mirror the reference clips exactly, re-timed to a clean 30 fps:
//   mosaic  16.183s -> 485 frames
//   streaks  6.006s -> 180 frames
//   bars    20.434s -> 613 frames
//   blocks   3.634s -> 109 frames

export const MOTION_FPS = 30;

/** Delivery size. The 4K compositions render the same scenes at 2x. */
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

export const MOSAIC_DURATION = 485;
export const STREAKS_DURATION = 180;
export const BARS_DURATION = 613;
export const BLOCKS_DURATION = 109;

/** Version 1 - layered blue/cyan mosaic. */
export const MOSAIC_PALETTE = [
  "#FCFDFF", // white
  "#00F0D4", // turquoise
  "#00C8F0", // cyan
  "#00AEEF", // sky
  "#0090FF", // azure
  "#0A62F0", // blue
  "#0A2BEE", // deep blue
  "#04152E", // navy
] as const;

/** Version 2 - streaks, flipping between a dark and a light treatment. */
export const STREAK_DARK = {
  background: "#000000",
  bars: ["#00AEEF", "#0090FF", "#4DC4F5", "#FFFFFF", "#0A62F0"],
} as const;

export const STREAK_LIGHT = {
  background: "#FCFDFF",
  bars: ["#9FDDF7", "#4DC4F5", "#00AEEF", "#E8F6FD", "#00C8F0"],
} as const;

/** Version 3 - pure monochrome. */
export const BARS_BLACK = "#000000";
export const BARS_WHITE = "#FCFCFC";

/** Version 4 - orange / violet / black confetti on white. */
export const BLOCKS_PALETTE = {
  background: "#FCFCFC",
  orange: "#EA5B0C",
  violet: "#5B10E0",
  ink: "#000000",
} as const;

/** Converts "#RRGGBB" to the 0xRRGGBB number Pixi expects. */
export const hexToNumber = (hex: string): number =>
  parseInt(hex.replace("#", ""), 16);

/** Converts "#RRGGBB" to a linear-ish vec3 for shader uniforms. */
export const hexToVec3 = (hex: string): [number, number, number] => {
  const n = hexToNumber(hex);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
