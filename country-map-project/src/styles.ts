/**
 * The three style versions. Colour is not the version axis beyond these — the
 * country is — so nothing here is per-country.
 */

export interface MapStyle {
  label: string;
  /** Relief palette endpoints. `dark` is deepest shading, `light` is flat ground.
   *  The warp bakes this in, so the relief raster arrives already in palette. */
  relief: {dark: string; light: string} | null;
  water: string;
  /** Lakes and inland water, very slightly lifted off the sea. */
  inlandWater: string;
  coast: string;
  borders: string;
  neighbourLabel: string;
  marineLabel: string;
  subjectFill: string;
  subjectEdge: string;
  cityMarker: string;
  cityRing: string;
  cityLabel: string;
  title: string;
  shadowOpacity: number;
  grainOpacity: number;
  vignetteOpacity: number;
}

/**
 * Relief variants baked per country. `v1` and `v2` arrive already in palette, so
 * the compositions just draw them. `shade` is neutral and full-contrast: it is
 * multiplied back through the subject's fill in both styles, which is what stops
 * the highlighted country reading as a flat sticker.
 */
export const RELIEF_VARIANTS = {
  v1: {dark: '#c8c8c6', light: '#e8e8e6'},
  v2: {dark: '#14171a', light: '#242a30'},
  shade: {dark: '#8c8c8c', light: '#ffffff'},
} as const;

export type ReliefVariant = keyof typeof RELIEF_VARIANTS;

export const STYLES = {
  v1: {
    label: 'Light relief',
    relief: {dark: '#c8c8c6', light: '#e8e8e6'},
    water: '#4a6a80',
    inlandWater: '#54748a',
    coast: '#9aa8b2',
    borders: '#b0b0ae',
    neighbourLabel: '#70706e',
    marineLabel: '#ccd8e2',
    subjectFill: '#d93a2b',
    subjectEdge: '#a82a1e',
    cityMarker: '#ffffff',
    cityRing: '#2b2b2b',
    cityLabel: '#ffffff',
    title: '#ffffff',
    shadowOpacity: 0.4,
    grainOpacity: 0.01,
    vignetteOpacity: 0,
  },
  v2: {
    label: 'Dark mode',
    relief: {dark: '#14171a', light: '#242a30'},
    water: '#0a1420',
    inlandWater: '#0e1a28',
    coast: '#2c353f',
    borders: '#3a4149',
    neighbourLabel: '#848c94',
    marineLabel: '#50698a',
    subjectFill: '#d93a2b',
    subjectEdge: '#a82a1e',
    cityMarker: '#ffffff',
    cityRing: '#0a0d10',
    cityLabel: '#ffffff',
    title: '#ffffff',
    shadowOpacity: 0.55,
    grainOpacity: 0.02,
    vignetteOpacity: 0.22,
  },
} as const satisfies Record<string, MapStyle>;

export type StyleKey = keyof typeof STYLES;

/** V3 has its own, deliberately minimal, palette. */
export const SATELLITE_STYLE = {
  ocean: '#08121f',
  outline: '#ffffff',
  /** The white fill has to separate the country from its neighbours while the
   *  terrain still reads through it. */
  whiteFillOpacity: 0.5,
  flagFillOpacity: 0.85,
  title: '#ffffff',
  grainOpacity: 0.012,
} as const;
