/**
 * Every measurement in this project is authored in 1080p pixels and the whole
 * screen is scaled by `useVideoConfig().width / DESIGN_WIDTH`, so the 1080p
 * preview and the 4K render are the same layout at two resolutions.
 */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const TITLE_BAR_H = 43; // ~4% of frame height

export const COL_EXPLORER = 0.18;
export const COL_EDITOR = 0.57;
export const COL_ASSISTANT = 0.25;

export const BODY_H = DESIGN_HEIGHT - TITLE_BAR_H;

export const TAB_STRIP_H = 36;
export const TERMINAL_H = Math.round(BODY_H * 0.2);
export const CODE_AREA_H = BODY_H - TAB_STRIP_H - TERMINAL_H;

export const CODE_SIZE = 12;
export const CODE_LINE_H = 17;
export const CODE_PAD_TOP = 10;
export const GUTTER_W = 46;

/** Whole code lines that fit the editor viewport at once. */
export const VISIBLE_LINES = Math.floor((CODE_AREA_H - CODE_PAD_TOP) / CODE_LINE_H);

// Beat sheet (frames @ 30fps, 600 total).
export const T = {
  explorerStart: 0,
  explorerStagger: 1.2,
  explorerFade: 10,
  typeStart: 20,
  typeEnd: 330,
  blobIn: 55,
  blobInEnd: 85,
  chat1: 120,
  chat2: 170,
  chat2TypeEnd: 238,
  chat2Code: 240,
  chat2CodeEnd: 260,
  chat3: 300,
  termCmd: 332,
  termWarn1: 348,
  termWarn2: 378,
  termSummary: 404,
  scrollStart: 380,
  scrollEnd: 430,
} as const;

export const BLOB_CYCLE = 150;
