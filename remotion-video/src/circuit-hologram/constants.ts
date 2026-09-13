// Timing, sizing and palette for the "circuit board hologram" pieces
// (the glowing cloud recreation of the reference clip, and the AI-chip
// variant). Everything is designed at 1x (1920x1080 "design units") and
// the whole scene is uniformly scaled up for the 4K compositions, so the
// 1080p and 4K renders are pixel-for-pixel the same picture.

export const FPS = 30;
// The reference clip is 30.03 s long; at 30 fps that is 900 frames.
export const DURATION_IN_FRAMES = 900;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// Size of the flat circuit-board plane (in design units) before it is
// tilted into perspective. Larger than the frame so the tilted edges
// never show.
export const BOARD_WIDTH = 4200;
export const BOARD_HEIGHT = 3000;

// Where the hologram (cloud / chip) sits on the board and on screen.
export const BOARD_CENTER_X = BOARD_WIDTH / 2;
export const BOARD_CENTER_Y = BOARD_HEIGHT / 2;

export const BACKGROUND_COLOR = "#02050f";

export const TRACE_COLOR = "#1d5fd6";
export const TRACE_BRIGHT_COLOR = "#3f8dff";
export const TRACE_GLOW_COLOR = "#2a6df5";

// Pulse (light packet) palette, weighted roughly like the reference:
// mostly cyan/blue with warm orange-red accents and the odd magenta.
export const PULSE_COLORS: { color: string; weight: number }[] = [
  { color: "#4fe3ff", weight: 3 },
  { color: "#dcf7ff", weight: 2 },
  { color: "#ff8a3d", weight: 3 },
  { color: "#ff4d4d", weight: 2 },
  { color: "#ff6ad5", weight: 1 },
];

export const NODE_COLORS = ["#ff8a3d", "#4fe3ff", "#ff4d4d", "#7fb4ff", "#ff6ad5"];

// Chip-block colours used inside the hologram (the little "circuitry"
// tiles that flicker inside the cloud in the reference).
export const CHIP_COLORS = ["#3ee86e", "#4fe3ff", "#a56bff", "#3f8dff", "#ffb23d"];

export const HOLOGRAM_CORE_COLOR = "#ffffff";
export const HOLOGRAM_MID_COLOR = "#7df0ff";
export const HOLOGRAM_OUTER_COLOR = "#1fb8ff";

export const LABEL_COLOR = "#63b0ff";
