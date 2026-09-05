// Composition + look constants.
//
// All geometry is expressed as a FRACTION OF FRAME HEIGHT, and dot sizes
// in pixels-at-2160p, so the composition is resolution independent: the
// 4K master and the 1080p preview (--scale=0.5) are the same picture.

export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10s
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const REFERENCE_HEIGHT = 2160; // dot sizes below are quoted at this height

export const TAU = Math.PI * 2;

// Disc centre: slightly left of frame centre, a touch above the middle.
export const CENTER_X_FRACTION = 0.455; // of frame WIDTH
export const CENTER_Y_FRACTION = 0.465; // of frame HEIGHT

// --- Radii (fractions of frame height) -----------------------------------
// The empty centre. This is the composition's anchor: no dots at all
// inside it, which is what makes the field read as a vortex rather than a
// starburst, and it doubles as title space.
export const HOLE_RADIUS = 0.15;
// Rim of the main densely-packed disc.
export const MAIN_RADIUS = 0.80;
// Isolated dots keep going well past the disc, out beyond the corners
// (the far corner sits at ~1.10 of frame height from the centre).
export const SCATTER_RADIUS = 1.45;

// --- Ring layout ---------------------------------------------------------
export const MAIN_RINGS = 78;
export const SCATTER_RINGS = 22; // 100 rings total
// Angular dot spacing as a multiple of the radial ring spacing. Below 1,
// so dots sit closer along an arc than the arcs sit apart: that is what
// makes the field read as concentric arcs rather than a dotted grid.
// Dot count per ring still rises with radius, keeping angular spacing
// even across the disc.
export const ANGULAR_SPACING_RATIO = 0.72;
// Dots thin out towards the rim: angular spacing is stretched by up to
// this factor across the scatter band.
export const SCATTER_THINNING = 4.2;

// Progressive per-ring phase offset, in radians across the full radius.
// Small on purpose — the spiral arms should be felt, not obvious.
export const SPIRAL_TWIST = 2.6;

// --- Motion --------------------------------------------------------------
// Total rotation over one loop, in radians, for the innermost and
// outermost ring. Inner turns faster, so the spiral arms wind gently.
// Each ring's actual rotation is snapped to a whole number of its own dot
// spacings (see layout.ts) so the loop closes invisibly.
export const ROTATION_INNER = 0.2269; // 13.0 degrees over 10s
export const ROTATION_OUTER = 0.1396; // 8.0 degrees over 10s

// Radial breathing: the whole disc scales by this much over the loop.
export const BREATHE_AMOUNT = 0.015; // +/- 1.5%

// --- Dots ----------------------------------------------------------------
export const DOT_SIZE_MIN = 1.0; // px at 2160p
export const DOT_SIZE_MAX = 4.0; // px at 2160p
export const DOT_SIZE_RING_VARIATION = 0.16; // +/- per-ring size wobble

// Anti-moire jitter. Concentric rings of regular dots beat against the
// pixel grid at 4K; a small break-up in both axes kills it. Kept under
// 4% of the local spacing so the arc structure stays clean.
export const RADIAL_JITTER = 0.038; // fraction of ring spacing, per ring
export const ANGULAR_JITTER = 0.038; // fraction of dot spacing, per dot

// --- Brightness ----------------------------------------------------------
export const BRIGHTNESS_BUCKETS = 32;
// Most dots must sit dim: the field is pushed through this gamma, which
// pulls the bulk of the population down and leaves the brighter patches.
export const BRIGHTNESS_GAMMA = 1.9;
// Below this a dot is not drawn at all. Deliberately high: the reference
// is mostly black, and dropping the dim tail entirely is what opens up
// the dark sectors between the bright patches. Brightness above the
// cutoff is renormalised over the full ramp, so the survivors stay
// punchy rather than all crowding into the bottom buckets.
export const BRIGHTNESS_CUTOFF = 0.095;

// Weights for the three brightness terms: clustered noise, a slow angular
// sweep, and a radial pulse. The two animated terms complete exactly one
// cycle per loop, so they are seamless by construction.
export const NOISE_WEIGHT = 0.76;
export const SWEEP_WEIGHT = 0.14;
export const PULSE_WEIGHT = 0.10;
export const SWEEP_LOBES = 2; // integer, so the sweep is continuous in theta
export const PULSE_WAVES = 2.5;

// --- Sparkles ------------------------------------------------------------
export const SPARKLE_FRACTION = 0.02; // 2% of dots carry a sparkle cross
export const SPARKLE_FADE = 0.09; // width of the smooth fade at the threshold
export const SPARKLE_SIZE = 0.072; // cross span, fraction of frame height
// Twinkle periods in frames. Both divide DURATION_IN_FRAMES, and dots are
// split between them so the twinkling is staggered rather than in unison.
export const TWINKLE_PERIODS = [60, 100] as const;

// --- Grain ---------------------------------------------------------------
// A pure black field bands around the disc's glow without this.
export const GRAIN_STRENGTH = 0.013; // ~1.5% peak lift of a grain pixel
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_TILE_COUNT = 12; // tile cycle
export const GRAIN_OFFSET_CYCLE = 25; // lcm(12, 25) = 300 -> no repeat in a loop

// --- Seeds ---------------------------------------------------------------
export const SEED_RING = 20250905;
export const SEED_BRIGHTNESS = 1337;
export const SEED_SPARKLE = 90210;
export const SEED_TWINKLE = 4242;
export const SEED_JITTER = 777;
export const SEED_GRAIN = 5150;

// --- Palettes ------------------------------------------------------------
export type Palette = {
  background: string;
  /** Dot colour ramp, darkest (dimmest dot) to brightest. */
  stops: [number, number, number][];
  /**
   * How fast brightness climbs the ramp. Below 1 pushes dots towards the
   * bright end, above 1 holds them in the saturated middle. The cyan ramp
   * tops out near white, so it needs a higher bias than gold to read as
   * cyan rather than as silver.
   */
  rampBias: number;
  /** Sparkle cross / core colour. */
  sparkle: [number, number, number];
  /** Very faint lift where the disc is densest. */
  glow: [number, number, number];
  glowStrength: number;
};

export const PALETTES: Record<string, Palette> = {
  // V1 - gold/amber, the reference match.
  gold: {
    background: "#000000",
    stops: [
      [0x6a, 0x4a, 0x10], // #6a4a10 deep bronze
      [0xc4, 0x9a, 0x2a], // #c49a2a mid gold
      [0xff, 0xe8, 0xa0], // #ffe8a0 bright gold
    ],
    rampBias: 0.8,
    sparkle: [0xff, 0xe9, 0xb0], // clips to white-gold
    glow: [0xc4, 0x9a, 0x2a],
    glowStrength: 0.012,
  },
  // V2 - cyan/white, cooler and cleaner.
  cyan: {
    background: "#000000",
    stops: [
      [0x0d, 0x3a, 0x4a], // #0d3a4a deep teal
      [0x22, 0xa8, 0xc8], // #22a8c8 mid cyan
      [0xc0, 0xf4, 0xff], // #c0f4ff bright ice
    ],
    rampBias: 1.45,
    // The sprite lightens its own core to pure white, so a faintly cyan
    // sparkle colour still reads as a white sparkle — with a cool halo
    // instead of a neutral one.
    sparkle: [0xcd, 0xf3, 0xff], // white, cool halo
    glow: [0x22, 0xa8, 0xc8],
    glowStrength: 0.011,
  },
};

export type VariantName = keyof typeof PALETTES;
