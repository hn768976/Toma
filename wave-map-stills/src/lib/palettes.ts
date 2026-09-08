/**
 * The ONLY place in the project that contains hex colour literals.
 * Every other module receives colours from here.
 */

export type PaletteName =
  | "blue"
  | "cyan"
  | "green"
  | "violet"
  | "amber"
  | "slate";

export type Palette = {
  /** Deep base colour of the frame. */
  bgDeep: string;
  /** Broad radial wash centred on the light source. */
  bgWash: string;
  /** Ocean dots — dim, barely above the background. */
  ocean: string;
  /** Land dots — the main hue of the piece. */
  land: string;
  /** Coastal / crest-lit land dots. */
  landBright: string;
  /** The core of the light source. */
  lightCore: string;
  /** Accent cells. */
  accent: string;
};

export const PALETTES: Record<PaletteName, Palette> = {
  blue: {
    bgDeep: "#020A2E",
    bgWash: "#0A2470",
    ocean: "#12356B",
    land: "#5F9FE8",
    landBright: "#C8E4FF",
    lightCore: "#FFFFFF",
    accent: "#F5C43F",
  },
  cyan: {
    bgDeep: "#01141C",
    bgWash: "#063A50",
    ocean: "#0F4A60",
    land: "#4FC4E8",
    landBright: "#C8F8FF",
    lightCore: "#FFFFFF",
    accent: "#FF7A4F",
  },
  green: {
    bgDeep: "#011408",
    bgWash: "#063A1E",
    ocean: "#0F4A28",
    land: "#4FC47A",
    landBright: "#C8FFD8",
    lightCore: "#FFFFFF",
    accent: "#F5A03F",
  },
  violet: {
    bgDeep: "#0A0424",
    bgWash: "#241058",
    ocean: "#2E1470",
    land: "#9B7FE8",
    landBright: "#E0D4FF",
    lightCore: "#FFFFFF",
    accent: "#4FE8C4",
  },
  amber: {
    bgDeep: "#140A02",
    bgWash: "#3A2008",
    ocean: "#4A2C0C",
    land: "#E8A84F",
    landBright: "#FFE8C8",
    lightCore: "#FFFFFF",
    accent: "#4FC4E8",
  },
  slate: {
    bgDeep: "#0A0C10",
    bgWash: "#1E2430",
    ocean: "#262E3C",
    land: "#8A9AB0",
    landBright: "#E0E8F0",
    lightCore: "#FFFFFF",
    accent: "#F5606B",
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export const isPaletteName = (v: string): v is PaletteName =>
  Object.prototype.hasOwnProperty.call(PALETTES, v);
