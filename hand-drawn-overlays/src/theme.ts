/**
 * Every colour and pen size in one place. Change an ink colour here and
 * re-render; nothing else needs editing.
 */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

export const BG = {
  /** Pure black for Screen-blend clips: exactly (0,0,0). */
  black: "#000000",
  /** Chroma green: exactly (0,255,0). */
  green: "#00FF00",
};

export const INK = {
  /** Lines on black. */
  white: "#F5F5F5",
  /** Dark ink on green screen (neutral grey, no green cast). */
  dark: "#141414",
  /** Scribble wipe marker. */
  marker: "#FFD43A",
  /** Darker rim where marker strokes overlap. */
  markerStreak: "#E9B62C",
  /** Scribble wipe black ink. */
  ink: "#141414",
  inkStreak: "#2A2A2A",
  /** Notebook ballpoint. */
  ballpoint: "#2A3A8A",
  /** Clip-art inks. */
  sheetBlack: "#141414",
  sheetWhite: "#F5F5F5",
  sheetRed: "#D8343A",
};

export const PAPER = {
  paper: "#FBFAF5",
  rule: "#9AB8D8",
  margin: "#D86A6A",
};

/** Bold marker, about 14 px at 4K. */
export const MARKER_SIZE = 14;
