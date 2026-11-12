import { hsl } from "../engine/random";

export type RGB = [number, number, number];

/** A colour "theme" carried by a light wave travelling along the fibres. */
export type Theme = { colors: RGB[]; white: number };

const c = (h: number, s = 1, l = 0.55): RGB => hsl(h / 360, s, l);

// ---- Version 1: reference palette (rainbow -> orange -> ice blue -> magenta ...)
const RAINBOW: Theme = { colors: [c(20), c(130), c(320), c(205), c(48), c(275)], white: 0.15 };
const ORANGE: Theme = { colors: [c(10), c(20), c(30), c(2), c(38), c(16)], white: 0.04 };
const ICE: Theme = { colors: [c(222, 0.75, 0.62), c(200, 0.7, 0.65), c(240, 0.6, 0.7), c(185, 0.8, 0.6)], white: 0.35 };
const MAGENTA: Theme = { colors: [c(318), c(328), c(305), c(335), c(225, 0.8, 0.6)], white: 0.06 };
const MAGENTA_BLUE: Theme = { colors: [c(320), c(228, 0.85, 0.6), c(300), c(240, 0.8, 0.62), c(330)], white: 0.08 };
const TEAL_MIX: Theme = { colors: [c(172), c(135), c(25), c(320), c(195), c(150)], white: 0.08 };
const BLUE: Theme = { colors: [c(225, 0.8, 0.6), c(212, 0.75, 0.62), c(250, 0.7, 0.66), c(290, 0.6, 0.62)], white: 0.22 };

// One theme per second (index = seconds), timed against the reference clip.
export const REFERENCE_SEQUENCE: Theme[] = [
  RAINBOW, RAINBOW, ORANGE, ORANGE, MAGENTA, MAGENTA_BLUE, ICE, ORANGE, TEAL_MIX, MAGENTA,
  MAGENTA_BLUE, BLUE, ORANGE, TEAL_MIX, MAGENTA, ORANGE, ORANGE, RAINBOW,
];

// ---- Version 2: alternative "Aurora" palette (emerald, teal, gold, cyan)
const EMERALD: Theme = { colors: [c(150), c(165), c(135, 0.9), c(175)], white: 0.15 };
const GOLD: Theme = { colors: [c(42), c(36), c(50), c(30, 0.95)], white: 0.18 };
const CYAN: Theme = { colors: [c(188, 0.95, 0.6), c(178), c(198, 0.9, 0.62), c(170, 0.9)], white: 0.3 };
const TEAL_GOLD: Theme = { colors: [c(172), c(45), c(160), c(38), c(190)], white: 0.15 };
const LIME: Theme = { colors: [c(95, 0.9), c(140), c(75, 0.95), c(160)], white: 0.15 };

export const AURORA_SEQUENCE: Theme[] = [
  TEAL_GOLD, TEAL_GOLD, GOLD, CYAN, EMERALD, CYAN, GOLD, LIME, EMERALD, EMERALD,
  CYAN, TEAL_GOLD, GOLD, CYAN, EMERALD, CYAN, GOLD, TEAL_GOLD,
];

/** Colourful bokeh head colours (the bright "photons" at the light-streak tips). */
export const REFERENCE_HEADS: RGB[] = [c(0), c(25), c(50), c(95), c(140), c(185), c(210), c(265), c(295), c(320), c(340)];
export const AURORA_HEADS: RGB[] = [c(40), c(48), c(55), c(150), c(165), c(178), c(190), c(130), c(95)];
