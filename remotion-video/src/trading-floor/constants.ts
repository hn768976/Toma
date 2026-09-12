// Timing and layout for the "Trading Floor" motion graphic.
//
// Everything below is authored in a fixed 1920x1080 design space. The
// <Stage> component scales that design space to whatever the composition
// resolution is, so the 1080p and 4K compositions are the same frame at
// different pixel densities (text and vectors stay crisp because the
// scale is a CSS transform, not a raster upscale).

export const FPS = 30;

// The reference clip is 16.96s. 16.96 * 30 = 508.8, so 509 frames is the
// closest whole-frame match at 30fps (16.967s).
export const DURATION_IN_FRAMES = 509;

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const HD = { width: 1920, height: 1080 };
export const UHD = { width: 3840, height: 2160 };

// Four windows in a 2x2 grid, separated by a thin bezel gap.
export const BEZEL = 4;
export const WINDOW_WIDTH = (DESIGN_WIDTH - BEZEL) / 2;
export const WINDOW_HEIGHT = (DESIGN_HEIGHT - BEZEL) / 2;

// Chrome metrics shared by every window.
export const TAB_BAR_HEIGHT = 27;
export const TOOLBAR_HEIGHT = 26;
export const STATUS_BAR_HEIGHT = 18;

export const TABS = [
  "Sum",
  "Watch",
  "Quote",
  "Bids",
  "Ticker",
  "Info",
  "Chart",
] as const;

// Row heights, in design pixels.
export const TAPE_ROW_HEIGHT = 20;
export const SALES_ROW_HEIGHT = 21.5;
export const BOOK_ROW_HEIGHT = 24;

// Arrival rates, in rows per second.
export const TAPE_ROWS_PER_SECOND = 10; // per ticker column
export const SALES_ROWS_PER_SECOND = 7; // time & sales panel

// How often the candle chart ticks / rolls a new bar, in frames.
export const CANDLE_TICK_PERIOD = 11;
export const CANDLE_ROLL_PERIOD = 92;

// Simulated wall-clock shown in the status bars.
export const CLOCK_START_HOUR = 10;
export const CLOCK_START_MINUTE = 19;
export const CLOCK_DATE_LABEL = "Thu 27 Jul";
