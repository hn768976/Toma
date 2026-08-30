/**
 * The palette is shared by all three versions without modification. The three
 * compositions are a matched set — a buyer must be able to cut between them
 * with no colour shift — so nothing here is ever varied per variant.
 */
export const THEME = {
  bg: "#000000",
  bright: "#F0F0F0",
  mid: "#9A9A9A",
  dim: "#4A4A4A",
  faint: "#262626",
  textWhite: "#E8E8E8",
  textDim: "#6A6A6A",
  /** The only colour in the piece. Reserved for the radar dial's readout. */
  accent: "#6FD4E8",
} as const;

/**
 * Stroke weights are a property of the piece, not of element size. They step up
 * by 1px in the sparse variant because everything there is larger, but they are
 * never scaled proportionally — that would lose the thin-line identity.
 */
export type StrokeSet = {
  structure: number;
  emphasis: number;
};

export const FRAME_WIDTH = 3840;
export const FRAME_HEIGHT = 2160;
export const DURATION = 600;
export const FPS = 30;
