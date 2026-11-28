/**
 * Every "look" setting: exposure, light, atmosphere, depth of field, glow,
 * grain and the colour palettes. Version 1 and Version 2 share all of it and
 * differ only in which palette they pick.
 *
 * Lengths are world units (1 = camera height); blur sizes are fractions of the
 * frame height so the look is identical at 1080p and 4K.
 */

export type RampStop = { at: number; color: string };
export type Palette = { name: string; ramp: RampStop[] };

/**
 * A palette is a colour ramp indexed by displayed brightness (0 = black,
 * 1 = brightest highlight). Stops are sRGB hex values.
 */
export const PALETTES = {
  /** Version 1: sampled from the reference (pure black -> deep teal -> pale cyan). */
  teal: {
    name: "teal",
    ramp: [
      { at: 0.0, color: "#000000" },
      { at: 0.03, color: "#02050a" },
      { at: 0.1, color: "#091e25" },
      { at: 0.32, color: "#235f6b" },
      { at: 0.62, color: "#5fabbf" },
      { at: 0.8, color: "#9cd2e2" },
      { at: 1.0, color: "#d3eef5" },
    ],
  },
  /** Version 2: same brightness steps, warm ember hues (black -> oxblood -> amber -> pale gold). */
  ember: {
    name: "ember",
    ramp: [
      { at: 0.0, color: "#000000" },
      { at: 0.03, color: "#0a0306" },
      { at: 0.1, color: "#260d07" },
      { at: 0.32, color: "#7a3a16" },
      { at: 0.62, color: "#d1954a" },
      { at: 0.8, color: "#ecc98a" },
      { at: 1.0, color: "#fbeccd" },
    ],
  },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

export const LOOK = {
  /** 1. Exposure and tone mapping. */
  exposure: 7.4,
  /** Filmic shoulder: displayed = 1 - exp(-exposure * light). */
  blackPoint: 0.02,

  /** 2. Light. The surface is a dark mirror lit edge-on (fresnel rim light). */
  light: {
    /** Higher = thinner, harder rim lines; lower = broader, softer sheen. */
    fresnelPower: 9.0,
    /** Light arrives from the far end: the near field is dimmed by this factor... */
    nearLevel: 0.34,
    /** ...between these distances from the camera. */
    falloffStart: 2.3,
    falloffEnd: 7.0,
    /** ...and eases off again in the far distance, so the horizon band keeps colour and detail. */
    farLevel: 0.8,
    farStart: 8.0,
    farEnd: 22.0,
  },

  /** 3. Atmosphere: additive haze that lifts the far field. */
  haze: { amount: 0.0, start: 7.0, end: 16.0 },

  /** Lens: depth of field. */
  dof: {
    focusDistance: 4.8,
    /** Blur radius (fraction of frame height) per unit of |1 - focus/dist|. */
    nearBlur: 0.028,
    farBlur: 0.032,
    maxBlur: 0.045,
    /** Gaussian sigma of the in-focus anti-aliasing blur (about 1.2 px at 1080p). */
    minBlur: 0.0015,
    /** The half-resolution blurred picture fades in between these blur sizes. */
    blendStart: 0.002,
    blendEnd: 0.006,
  },

  /** 4. Glow: wide soft halo added on top of the focused picture. */
  glow: { strength: 0.16, radius: 0.012 },

  /** 5. Texture: fixed film grain (hash of pixel + frame), faded out in black. */
  grain: 0.014,
  /** Banding guard: +-1/255 dither in the final pass, off on pure black. */
  dither: 1.0 / 255.0,

  /** 6. Lens: vignette strength (0 = none; the reference shows none). */
  vignette: 0.0,
} as const;

export const hexToSrgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
