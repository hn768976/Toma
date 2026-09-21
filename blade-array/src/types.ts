/** One stop on the environment gradient, positioned around the light cylinder. */
export type GradientStop = {
  /** Position around the environment, 0..1, wrapping. */
  p: number;
  /** Colour at this stop, linear, normalised to roughly 0..1. */
  c: [number, number, number];
  /** Intensity at this stop. Values above 1 are HDR and will bloom. */
  i: number;
};

/**
 * Everything that distinguishes one composition from another.
 *
 * Adding a colourway is one of these objects: gradient stops, wave amplitude,
 * blade width, blade count. See README.md.
 */
export type BladeArrayConfig = {
  id: string;
  outName: string;
  /** Frame to export the still from. */
  stillFrame: number;

  // --- array ---
  /** Blades across the visible frame width. Sets blade width too. */
  bladesPerFrame: number;
  /** Fraction of the pitch the blade occupies. The rest is the seam. */
  fill: number;
  /** Cross-section arc in degrees. This spreads the gradient across a blade. */
  arcDeg: number;
  /** Blade thickness as a fraction of its width. Never zero: the thin edge
   *  catches a bright line when a blade turns. */
  thickness: number;
  /** Vertical segments. Look 2 needs >= 64 for the twist to read smoothly. */
  segY: number;

  // --- twist (look 2; look 1 and 3A/3B set twistAmpDeg to 0) ---
  /** A: maximum rotation about the blade's own vertical axis, degrees. */
  twistAmpDeg: number;
  /** c: twist accumulated up the blade, radians. Makes the crossing line. */
  twistC: number;
  /** k: wave cycles visible across the frame. */
  twistK: number;
  /** f: wave passes per loop. Must be an integer. */
  twistF: number;
  /**
   * Warps the wave phase so the edge-on crossing line bends into an S instead
   * of a straight diagonal. 0 is the plain travelling wave.
   */
  twistW: number;

  // --- bowing (looks 3A and 3B; static geometry, does not animate) ---
  /** B: peak horizontal displacement as a fraction of frame width. */
  bowAmp: number;
  /** Lit-column centres in 0..1 that the bow is confined to. Empty = whole array. */
  bowCenters: number[];
  /** Gaussian half-width of each column, in units of normalised array position. */
  bowWidth: number;

  // --- environment ---
  stops: GradientStop[];
  /** N: complete gradient passes over the loop. Must be an integer. */
  scrollN: number;
  /** Radius of the light cylinder. Smaller = more parallax = more colour
   *  change across the frame relative to across one blade. */
  wallRadius: number;
  /** How much of the gradient is visible at once. */
  azimZoom: number;
  /**
   * How much of the gradient swings across a single blade. 1 = pure reflection,
   * the whole gradient sweeps inside every blade; low values pin the large-scale
   * structure to position so lit zones read as columns spanning many blades.
   * Never 0 - colour has to vary across the width of a single blade.
   */
  parallax: number;
  /** Gaussian blur of the gradient for the glossy reflection, in LUT widths. */
  specBlur: number;
  /** Much wider blur, standing in for diffuse irradiance. */
  diffBlur: number;
  specGain: number;
  diffGain: number;
  /** Soft key. Low: most of the image is environment reflection. */
  keyIntensity: number;
  /** Fill light, so unlit blades still read as solid geometry. */
  ambient: number;

  // --- value shaping ---
  /** Environment brightness at the bottom / top of the lit field. */
  elevLo: number;
  elevHi: number;
  /** Undulation of the vertical falloff. elevFreq must be an integer. */
  elevTilt: number;
  elevFreq: number;
  /** 0 = falls off with height; 1 = folds about the centre line into an
   *  hourglass, bright top and bottom with a dark waist. */
  elevSym: number;
  /** How much of a bright-core-to-dark-edge ramp the key direction paints
   *  across each blade, and how tight that ramp is. */
  shadeMix: number;
  shadePow: number;
  /** 3C: confines light to one horizontal band. null = off. */
  band: null | {
    /** Half-width of the band, in normalised elevation. */
    half: number;
    /** Soft edge beyond the half-width. */
    soft: number;
    /** S-curve amplitude. */
    amp: number;
    /** S-curve cycles. Must be an integer. */
    freq: number;
    zoom: number;
    /** Scales reflected elevation to roughly -1..1 over the frame height. */
    elev: number;
  };

  /** Brightness of the wall behind the array, as a fraction of the gradient.
   *  0 leaves the gaps genuinely black. */
  backdrop: number;

  exposure: number;
  bloomIntensity: number;
  bloomThreshold: number;
  /** Film grain, as a fraction of full scale. */
  grain: number;
};
