/**
 * Two looks share one scene graph: the reference violet/magenta grade and a
 * cooler dark-blue grade. A theme is pure data — no component branches on the
 * theme name, they only read these values.
 */
export type Theme = {
  id: 'violet' | 'darkBlue';
  /** Background gradient, painted bottom-left to top-right. */
  bgInner: string;
  bgOuter: string;
  bgDeep: string;
  /**
   * Digit tint ramp sampled left-to-right across the frame. The reference runs
   * cyan on the left through violet to hot magenta on the right.
   */
  digitRamp: string[];
  /** The occasional near-white digit that punctuates the field. */
  digitHighlight: string;
  /** Colour of the large soft light source on the right. */
  glow: string;
  glowCore: string;
  /** Horizontal light bands drifting through the data field. */
  streak: string;
  /** Globe dots + orbit ring. */
  globe: string;
  globeRim: string;
  ring: string;
  /** Faint sphere body behind the dots. */
  sphere: string;
  vignette: string;
};

export const VIOLET: Theme = {
  id: 'violet',
  bgDeep: '#07061c',
  bgInner: '#221156',
  bgOuter: '#3a1f86',
  digitRamp: ['#2fd6e8', '#3f8ae8', '#6a6ff0', '#9a5ce8', '#d94ad2', '#ff6fc4'],
  digitHighlight: '#e8ecff',
  glow: '#4f8dff',
  glowCore: '#bfe0ff',
  streak: '#7b5ce0',
  globe: '#ffffff',
  globeRim: '#dfe9ff',
  ring: '#eef2ff',
  sphere: '#2b1a66',
  vignette: '#050418',
};

export const DARK_BLUE: Theme = {
  id: 'darkBlue',
  bgDeep: '#010613',
  bgInner: '#062043',
  bgOuter: '#0c3b7d',
  digitRamp: ['#1b4fb8', '#2a6fd6', '#3d92e8', '#54b6f2', '#7fd2fa', '#a8e4ff'],
  digitHighlight: '#eef7ff',
  glow: '#2f86ff',
  glowCore: '#cfe8ff',
  streak: '#2f6fc8',
  globe: '#f2f9ff',
  globeRim: '#cfe6ff',
  ring: '#e6f3ff',
  sphere: '#08224c',
  vignette: '#01040f',
};

/** Sample the digit ramp at t in [0,1] and return a CSS colour. */
export const sampleRamp = (ramp: string[], t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = Math.min(ramp.length - 1, Math.floor(clamped * (ramp.length - 1) + 0.5));
  return ramp[idx];
};
