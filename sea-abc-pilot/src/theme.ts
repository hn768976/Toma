// Sea ABC palette — flat colours only, NO outlines and no gradients.
// Every part gets a base colour, one darker tone of the same hue (~15-20% darker,
// for shading) and one lighter tone (small highlights). Shapes are separated by tone.
export const C = {
  navy: '#1E2A44', // facial features only (pupils, mouths, brows) — filled shapes
  // background: slightly muted so the warm characters pop
  water: '#336A80',
  waterFar: '#2C5D72',
  shaft: '#E8F1EC',
  sand: '#E8D3A8',
  sandDark: '#D3BB8E',
  sandLight: '#F1E1BF',
  kelp: '#6E9F48',
  kelpDark: '#5A853A',
  kelpBack: '#5C8C46',
  kelpBackDark: '#4B7639',
  bubble: '#CDEBF2',
  // characters / props: bright and warm
  cream: '#FFF3DA',
  creamDark: '#EAD7B2',
  coral: '#FF8A8A', // Nova
  coralDark: '#DB6D74',
  coralLight: '#FFB4AE',
  white: '#FFFFFF',
  rope: '#E0A65A',
  ropeDark: '#BE8A45',
  ropeLight: '#F0C688',
  // letter cycle (also used as accents)
  cyan: '#2EC4E6',
  cyanDark: '#24A0BE',
  cyanLight: '#8FE3F4',
  yellow: '#FFC93C',
  yellowDark: '#DBA62A',
  yellowLight: '#FFE592',
  grape: '#8B5FD0',
  grapeDark: '#6F48AE',
  grapeLight: '#AC8BE3',
  lime: '#8CCB3F',
  limeDark: '#6FA82E',
  limeLight: '#BCE58A',
  orange: '#FF9233',
  orangeDark: '#D9752A',
  orangeLight: '#FFBC7E',
} as const;

export type Tone = { base: string; dark: string; light: string };
export const TONES = {
  cyan: { base: C.cyan, dark: C.cyanDark, light: C.cyanLight },
  yellow: { base: C.yellow, dark: C.yellowDark, light: C.yellowLight },
  grape: { base: C.grape, dark: C.grapeDark, light: C.grapeLight },
  lime: { base: C.lime, dark: C.limeDark, light: C.limeLight },
  orange: { base: C.orange, dark: C.orangeDark, light: C.orangeLight },
} satisfies Record<string, Tone>;

export const LETTER_TONES: Tone[] = [TONES.cyan, TONES.yellow, TONES.grape, TONES.lime, TONES.orange];
export const LETTER_COLORS = LETTER_TONES.map((t) => t.base);

export const FPS = 30;
export const BEAT = 15; // frames per beat @120 BPM
