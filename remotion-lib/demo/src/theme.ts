/**
 * Demo palette.
 *
 * Lives HERE, in the demo, not in the library. Every library component takes
 * its colours as parameters; these constants exist only so the demo looks like
 * one piece of work. Swapping them changes the demo and nothing else.
 */
export const THEME = {
  bg: '#05070D',
  panel: '#0B1120',
  accent: '#2E6BFF',
  accentHot: '#EAF4FF',
  cyan: '#22D3EE',
  green: '#34D399',
  amber: '#FBBF24',
  rose: '#FB7185',
  text: '#94A3B8',
  textBright: '#E2E8F0',
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** Frames per component section in the master LibDemo composition. */
export const SECTION = 90;
