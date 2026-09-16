/**
 * The two colourways. `blue` recreates the reference clip; `violet` is the
 * same scene re-skinned into a violet/magenta brand palette.
 *
 * Every colour the scene draws comes from here — swapping the palette is the
 * only difference between the two delivered versions.
 */
export type Palette = {
  /** Flat backdrop colour, behind the radial glow. */
  background: string;
  /** Colour of the soft radial glow behind the cables. */
  backgroundGlow: string;
  /** Body tint of the translucent cable sheath. */
  sheath: string;
  /** Fresnel rim light along the silhouette of the sheath and sleeve. */
  rim: string;
  /** The scrolling 0/1 digits printed on the sheath and sleeve. */
  digits: string;
  /** Bright specks embedded in the sheath. */
  sparkle: string;
  /** Dark ferrule rings between sheath and sleeve. */
  ferrule: string;
  /** Fiber strand colour where it leaves the sleeve. */
  fiberRoot: string;
  /** Fiber strand colour at the cut tip. */
  fiberTip: string;
  /** Glow dot sitting on each cut tip. */
  tipGlow: string;
};

export const BLUE_PALETTE: Palette = {
  background: "#02050e",
  backgroundGlow: "#0a2350",
  sheath: "#1750d6",
  rim: "#6fc4ff",
  digits: "#cdeaff",
  sparkle: "#e8f6ff",
  ferrule: "#05080f",
  fiberRoot: "#0d34c4",
  fiberTip: "#4fd2ff",
  tipGlow: "#a8f2ff",
};

// Violet is not a hue rotation of the blue values. The blue fibers brighten
// towards cyan, whose channels are already near the top, so pushing them past
// 1.0 clips to a clean white highlight. Doing the same to a violet clips red
// and blue first and lands on a washed-out grey, so the violet tip colours are
// held more saturated and a little darker to leave the highlight headroom.
export const VIOLET_PALETTE: Palette = {
  background: "#07030f",
  backgroundGlow: "#210a4f",
  sheath: "#6a24e2",
  rim: "#b264ff",
  digits: "#ecd8ff",
  sparkle: "#f6e4ff",
  ferrule: "#08040e",
  fiberRoot: "#400aa8",
  fiberTip: "#a63dff",
  tipGlow: "#df9dff",
};

export const PALETTES = {
  blue: BLUE_PALETTE,
  violet: VIOLET_PALETTE,
} as const;

export type PaletteName = keyof typeof PALETTES;
