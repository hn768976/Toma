/**
 * Every colour used anywhere in the piece lives here. No other module may
 * contain a hex literal — pull a token off the active theme instead.
 */

export type Variant = 'violet' | 'teal';

export type Theme = {
  /** Deepest background value. */
  bgDeep: string;
  /** Slightly lifted background value, used for the ambient gradient. */
  bgMid: string;
  /** Circuit-trace texture in the background plate. */
  circuitTrace: string;
  /** Three fibre hues, mixed across the strand bundle. */
  fibreA: string;
  fibreB: string;
  fibreC: string;
  /** Chip rim + glow. The brightest, most separate element in frame. */
  chip: string;
  /** Panel border stroke. */
  panelBorder: string;
  /** Panel fill (drawn semi-transparent). */
  panelFill: string;
  /** Near-white used for the "Ai" mark and panel text rows. */
  textWhite: string;
  /** Sparse syntax accent, only ever used inside code panels. */
  codeAccent: string;
  /** Pure black, for the vignette. */
  voidBlack: string;
  /** Mid grey, the base value of the film-grain tile. */
  grainGrey: string;
};

export const THEMES: Record<Variant, Theme> = {
  violet: {
    bgDeep: '#04060F',
    bgMid: '#0A1428',
    circuitTrace: '#12244A',
    fibreA: '#7B3FE8',
    fibreB: '#C43FD4',
    fibreC: '#3F6FE8',
    chip: '#3FD8F5',
    panelBorder: '#4FA8E8',
    panelFill: '#0A1A33',
    textWhite: '#E8F4FF',
    codeAccent: '#4FE07F',
    voidBlack: '#000000',
    grainGrey: '#808080',
  },
  teal: {
    // Same value range as `violet` — only the hue cast changes. The field is
    // teal/green, so the chip goes WARM (amber) rather than cool: against
    // these surroundings a cyan rim would sink into the background instead of
    // reading as the brightest, most separate element.
    bgDeep: '#020C0E',
    bgMid: '#06202A',
    circuitTrace: '#0E3846',
    fibreA: '#2ED4C4',
    fibreB: '#4FE87F',
    fibreC: '#3FA8D4',
    chip: '#F5C542',
    panelBorder: '#3FD4B8',
    panelFill: '#06181F',
    textWhite: '#E8FFF8',
    codeAccent: '#9B7FE8',
    voidBlack: '#000000',
    grainGrey: '#808080',
  },
};
