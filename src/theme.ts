/**
 * Every colour in the piece lives here. No hex literal exists anywhere else.
 * A v2 palette is a new entry in THEMES + `variant` prop — nothing else changes.
 */
export type Theme = {
  /** Very dark plum page/scene background — deliberately not black. */
  bgDeep: string;
  /** The horizon glow band. */
  bgHaze: string;
  /** Base wireframe contour colour. */
  contour: string;
  /** Nearer contour lines. */
  contourBright: string;
  /** Pin stems and rings. */
  pin: string;
  /** The brightest pin glow (flashes, ring highlights). */
  pinHot: string;
  /** Avatar disc fill — the majority of avatars. */
  avatarWarm: string;
  /** Avatar disc fill — a minority of avatars. */
  avatarCool: string;
  /** Terrain floor surface, low areas — the dark neon red ground. */
  floorDeep: string;
  /** Terrain floor surface, high areas — subtle relief tint. */
  floorHigh: string;
  /** The bright dots traveling along the contour ropes. */
  ropeDot: string;
};

export const THEMES = {
  violet: {
    bgDeep: '#200C2B',
    bgHaze: '#43183A',
    contour: '#9126EE',
    contourBright: '#BC5CFF',
    pin: '#FF6A28',
    pinHot: '#FF9440',
    avatarWarm: '#FFD4A8',
    avatarCool: '#A8C4E8',
    floorDeep: '#1C0718',
    floorHigh: '#2C0A24',
    ropeDot: '#FFC4EE',
  },
} as const satisfies Record<string, Theme>;

export type VariantName = keyof typeof THEMES;
