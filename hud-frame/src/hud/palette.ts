export type Palette = {
  /** Field outside the border. */
  surround: string;
  /** Interior fill, or null for a pure-black screen-blend overlay. */
  interior: { inner: string; outer: string } | null;
  vignette: boolean;
  /** Main border stroke. */
  line: string;
  /** Brighter inner edge of the border, and the loudest furniture. */
  bright: string;
  /** Secondary furniture colour. */
  accent: string;
  /** Pale highlight, used sparingly. */
  pale: string;
  /** Colour the bloom pass is tinted with. */
  glow: string;
  grain: { opacity: number; blend: "normal" | "overlay" };
};

const CYAN_FURNITURE = {
  line: "#22d3ee",
  bright: "#7df9ff",
  accent: "#0ea5b7",
  pale: "#d8feff",
  glow: "#22d3ee",
};

export const PALETTES = {
  /** V1 — standalone clip on a dark blue field. */
  blue: {
    // Base tones are pre-darkened by ~6/255 to absorb the mean lift of the
    // normal-blend grain below, so the encoded blacks land where intended.
    surround: "#000412",
    interior: { inner: "#000c24", outer: "#05254f" },
    vignette: true,
    ...CYAN_FURNITURE,
    // Normal-blend dither: the dark blue field bands badly without it.
    grain: { opacity: 0.045, blend: "normal" },
  },
  /** V2 — screen-blend overlay, identical border on pure black. */
  overlayCyan: {
    surround: "#000000",
    interior: null,
    vignette: false,
    ...CYAN_FURNITURE,
    // Overlay blend leaves 0,0,0 exactly 0,0,0, so the untouched area of the
    // clip disappears completely under a screen blend.
    grain: { opacity: 0.13, blend: "overlay" },
  },
  /** V3 — screen-blend overlay, amber / tactical register. */
  overlayAmber: {
    surround: "#000000",
    interior: null,
    vignette: false,
    line: "#f0a020",
    bright: "#ffd27a",
    accent: "#e04a10",
    pale: "#fff0d0",
    glow: "#f0a020",
    grain: { opacity: 0.13, blend: "overlay" },
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;
