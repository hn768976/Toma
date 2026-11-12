// Sea ABC palette — flat colours only, no gradients.
export const C = {
  navy: '#1D2B53', // the one outline colour
  water: '#2B6F8F',
  waterFar: '#25617D',
  sand: '#F3D9A4',
  sandDark: '#E2BF82',
  cream: '#FFF3DA',
  coral: '#FF8A8A', // Nova
  coralDark: '#F0697A',
  white: '#FFFFFF',
  bubble: '#CDEFF7',
  // letter cycle (also used as accents on the set)
  cyan: '#2EC4E6',
  yellow: '#FFC93C',
  grape: '#8B5FD0',
  lime: '#8CCB3F',
  orange: '#FF9233',
} as const;

export const LETTER_COLORS = [C.cyan, C.yellow, C.grape, C.lime, C.orange];

/** Outline width in final 1080p pixels. */
export const OUTLINE = 3;

export const FPS = 30;
export const BEAT = 15; // frames per beat @120 BPM
