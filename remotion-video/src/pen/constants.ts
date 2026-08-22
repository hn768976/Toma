// "the alarm" — a MinutePhysics-style explainer: ballpoint pen on white.
//
// The sheet is one long horizontal strip. Everything is drawn on it in
// sequence, left to right, and the camera pans across. Nothing is ever
// erased except once, at frame 1479.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 1740; // 58s

/** The sheet. Wide, not tall. */
export const SHEET_WIDTH = 7680;
export const SHEET_HEIGHT = 1080;

export const INK = "#000000";
export const PAPER = "#FFFFFF";
/** Fat / energy — the through-line. */
export const MUSTARD = "#E8B923";
/** Death and alarm. */
export const RED = "#D62828";

/** Ballpoint: thin, fast, confident. Never thicker than this. */
export const STROKE_WIDTH = 2.4;
export const THIN_STROKE = 2;

export const FONT_FAMILY = "Caveat Pen";
export const FONT_STACK = `"${FONT_FAMILY}", Caveat, "Reenie Beanie", "Bradley Hand", cursive`;
export const TYPE_SIZE = 56;

/** Rule: land each visual 6 frames before the words explain it. */
export const LEAD = 6;
export const lead = (cueFrame: number) => Math.max(0, cueFrame - LEAD);

/** The single erase in the whole video (scene 6). */
export const ERASE_FRAME = lead(1485);

export const SCENE = {
  s1: 0,
  s2: 240,
  s3: 585,
  s4: 855,
  s5: 1140,
  s6: 1485,
  end: DURATION_IN_FRAMES,
} as const;
