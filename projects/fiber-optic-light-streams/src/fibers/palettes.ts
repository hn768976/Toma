import { hsl } from "../engine/random";

export type RGB = [number, number, number];

/** A colour "theme" carried by a light wave travelling along the fibres. */
export type Theme = { colors: RGB[]; white: number };

const c = (h: number, s = 1, l = 0.55): RGB => hsl(h / 360, s, l);

// ---- Version 1: reference palette (rainbow -> orange -> ice blue -> magenta ...)

// Reference colour timeline, measured from the reference clip (mean hue / chroma per frame):
// a 5-second cycle of red-orange -> neutral -> magenta -> blue, one entry per 0.5 s.
const RED: Theme = { colors: [c(4), c(12), c(18), c(358), c(24)], white: 0.02 };
const NEUTRAL: Theme = { colors: [c(185, 0.5), c(200, 0.45), c(165, 0.5), c(40, 0.55), c(210, 0.4)], white: 0.2 };
const PURPLE: Theme = { colors: [c(300), c(306), c(312), c(294), c(318)], white: 0.08 };
const ROYAL: Theme = { colors: [c(234, 0.85, 0.58), c(240, 0.8, 0.6), c(228, 0.85, 0.58), c(246, 0.75, 0.62)], white: 0.12 };
export const REFERENCE_SEQUENCE: Theme[] = [
  PURPLE, PURPLE, RED, RED, RED, NEUTRAL, NEUTRAL, PURPLE, PURPLE, PURPLE, // 0.0 - 4.5 s
  ROYAL, ROYAL, ROYAL, RED, RED, NEUTRAL, NEUTRAL, PURPLE, PURPLE, PURPLE, // 5.0 - 9.5 s
  ROYAL, ROYAL, ROYAL, RED, RED, NEUTRAL, NEUTRAL, PURPLE, PURPLE, PURPLE, // 10.0 - 14.5 s
  ROYAL, ROYAL, ROYAL, ROYAL, // 15.0 - 16.5 s
];

// ---- Version 2: alternative "Aurora" palette (emerald, teal, gold, cyan)
const EMERALD: Theme = { colors: [c(150), c(165), c(135, 0.9), c(175)], white: 0.15 };
const GOLD: Theme = { colors: [c(42), c(36), c(50), c(30, 0.95)], white: 0.18 };
const CYAN: Theme = { colors: [c(188, 0.95, 0.6), c(178), c(198, 0.9, 0.62), c(170, 0.9)], white: 0.3 };
const TEAL_GOLD: Theme = { colors: [c(172), c(45), c(160), c(38), c(190)], white: 0.15 };
const LIME: Theme = { colors: [c(95, 0.9), c(140), c(75, 0.95), c(160)], white: 0.15 };

// Same 0.5 s slot timing as the reference sequence, with the alternative palette.
export const AURORA_SEQUENCE: Theme[] = [
  TEAL_GOLD, TEAL_GOLD, GOLD, GOLD, GOLD, CYAN, CYAN, EMERALD, EMERALD, EMERALD,
  CYAN, CYAN, CYAN, GOLD, GOLD, LIME, LIME, EMERALD, EMERALD, EMERALD,
  CYAN, CYAN, CYAN, GOLD, GOLD, TEAL_GOLD, TEAL_GOLD, EMERALD, EMERALD, EMERALD,
  CYAN, CYAN, CYAN, CYAN,
];

/** Colourful bokeh head colours (the bright "photons" at the light-streak tips). */
export const REFERENCE_HEADS: RGB[] = [c(0), c(25), c(50), c(95), c(140), c(185), c(210), c(265), c(295), c(320), c(340)];
export const AURORA_HEADS: RGB[] = [c(40), c(48), c(55), c(150), c(165), c(178), c(190), c(130), c(95)];
