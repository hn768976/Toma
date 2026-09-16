/**
 * The three colour treatments.
 *
 * Every value here is art direction only -- the geometry, wave field and camera
 * move are identical across the three versions, so they cut together frame for
 * frame. All colours are authored in sRGB and converted to the renderer's
 * working colour space when the scene is built.
 */

export type Theme = {
  id: string;
  label: string;

  /** Metal reflectance at normal incidence (the "colour" of the metal). */
  metal: string;
  /** Per-tile random tint spread, 0 = perfectly uniform. */
  metalVariance: number;

  /**
   * Procedural environment the metal reflects, as four stops against the
   * elevation of the reflected ray: ground below, then horizon, then a bright
   * band (the light itself), then the zenith above it.
   *
   * The band is what a flat tile reflects, so its position has to sit near the
   * elevation the camera's pitch puts a flat tile at -- around 0.55 here. Wave
   * tilt then sweeps each tile in and out of it.
   */
  envZenith: string;
  envHorizon: string;
  envGround: string;
  envBand: string;
  envBandCenter: number;
  envBandWidth: number;
  envIntensity: number;

  /** Broad soft key -- this is what paints the wide diagonal highlight bands. */
  keyColor: string;
  keyDir: [number, number, number];
  keyBroadness: number;
  keyIntensity: number;

  /** Tight specular lobe -- the sparkling pin-points in the far field. */
  sunColor: string;
  sunDir: [number, number, number];
  sunSharpness: number;
  sunIntensity: number;

  /**
   * Broad positional falloff across the field, so one side sits in light and
   * the other rolls off into shadow. The direction is in world XZ; the camera
   * frames it so this reads as a bright upper-left and a dark lower-right.
   */
  lightFalloffDir: [number, number];
  lightFalloffNear: number;
  lightFalloffFar: number;

  /** Aerial perspective. Doubles as the backdrop, so the grid edge never shows. */
  fogColor: string;
  /** Distance at which haze starts. Nearer than this the field stays crisp. */
  fogStart: number;
  fogDensity: number;

  /** How much darker the tile flanks are than the tops. */
  sideDarkening: number;
  /** Ambient occlusion baked down the side of each tile. */
  aoDepth: number;

  exposure: number;
  toneMapping: 'aces' | 'neutral' | 'cineon';

  bloomStrength: number;
  /** Glow radius, as a fraction of frame height (resolution agnostic). */
  bloomRadius: number;
  bloomThreshold: number;

  /** Depth of field. Distances are world units. */
  focusDistance: number;
  focusRange: number;
  /** Maximum blur radius as a fraction of frame height (resolution agnostic). */
  blurStrength: number;

  vignette: number;
  grain: number;
};

/** Version 1 -- matches the supplied reference: warm gold on a dark falloff. */
export const GOLD: Theme = {
  id: 'gold',
  label: 'Gold',

  metal: '#ffcc78',
  metalVariance: 0.1,

  envZenith: '#0a0601',
  envHorizon: '#0d0702',
  envGround: '#040100',
  envBand: '#fff6e8',
  envBandCenter: 0.58,
  envBandWidth: 0.16,
  envIntensity: 1.2,

  keyColor: '#fff0cf',
  keyDir: [-0.38, 0.6, -0.7],
  keyBroadness: 9.0,
  keyIntensity: 2.0,

  sunColor: '#fffaf0',
  sunDir: [-0.26, 0.5, -0.83],
  sunSharpness: 600,
  sunIntensity: 5.0,

  lightFalloffDir: [-1.0, 0.09],
  lightFalloffNear: 0.06,
  lightFalloffFar: 1.6,

  fogColor: '#d9a65c',
  fogStart: 30,
  fogDensity: 0.011,

  sideDarkening: 0.12,
  aoDepth: 0.06,

  exposure: 1.22,
  toneMapping: 'neutral',

  bloomStrength: 0.22,
  bloomRadius: 0.05,
  bloomThreshold: 0.9,

  focusDistance: 17,
  focusRange: 20,
  blurStrength: 0.042,

  vignette: 0.5,
  grain: 0.012,
};

/** Version 2 -- deep navy metal on a near-black field, cool steel highlights. */
export const NAVY: Theme = {
  id: 'navy',
  label: 'Deep Navy',

  // A darker, less saturated blue than the highlight colour: the metal stays
  // navy while the specular rides up to cool steel.
  metal: '#5474a8',
  metalVariance: 0.12,

  envZenith: '#01030a',
  envHorizon: '#020409',
  envGround: '#000102',
  envBand: '#e6f0ff',
  envBandCenter: 0.58,
  envBandWidth: 0.16,
  envIntensity: 1.25,

  keyColor: '#d6e6ff',
  keyDir: [-0.38, 0.6, -0.7],
  keyBroadness: 9.0,
  keyIntensity: 2.1,

  sunColor: '#f4f8ff',
  sunDir: [-0.26, 0.5, -0.83],
  sunSharpness: 600,
  sunIntensity: 7.5,

  lightFalloffDir: [-1.0, 0.09],
  lightFalloffNear: 0.05,
  lightFalloffFar: 1.6,

  fogColor: '#23406e',
  fogStart: 30,
  fogDensity: 0.011,

  sideDarkening: 0.1,
  aoDepth: 0.05,

  exposure: 1.38,
  toneMapping: 'neutral',

  bloomStrength: 0.26,
  bloomRadius: 0.052,
  bloomThreshold: 0.88,

  focusDistance: 17,
  focusRange: 20,
  blurStrength: 0.042,

  vignette: 0.56,
  grain: 0.012,
};

/** Version 3 -- full light: ivory backdrop, pearl/platinum tiles. */
export const PLATINUM: Theme = {
  id: 'platinum',
  label: 'Platinum Light',

  metal: '#e8e5e0',
  metalVariance: 0.06,

  // No near-black stops here: in a light scene the metal has to keep finding
  // something bright to reflect, or the gaps punch holes in the frame.
  envZenith: '#ded8cc',
  envHorizon: '#bdb4a6',
  envGround: '#928878',
  envBand: '#ffffff',
  envBandCenter: 0.58,
  envBandWidth: 0.2,
  envIntensity: 1.0,

  keyColor: '#ffffff',
  keyDir: [-0.38, 0.6, -0.7],
  keyBroadness: 9.0,
  keyIntensity: 1.1,

  sunColor: '#ffffff',
  sunDir: [-0.26, 0.5, -0.83],
  sunSharpness: 600,
  sunIntensity: 3.2,

  // A far gentler swing than the dark versions -- the light treatment wants an
  // airy roll-off, not a black corner.
  lightFalloffDir: [-1.0, 0.09],
  lightFalloffNear: 0.62,
  lightFalloffFar: 1.14,

  fogColor: '#f7f3ea',
  fogStart: 22,
  fogDensity: 0.014,

  sideDarkening: 0.42,
  aoDepth: 0.28,

  exposure: 1.1,
  toneMapping: 'neutral',

  bloomStrength: 0.16,
  bloomRadius: 0.045,
  bloomThreshold: 0.92,

  focusDistance: 17,
  focusRange: 20,
  blurStrength: 0.042,

  vignette: 0.14,
  grain: 0.009,
};

export const THEMES = { gold: GOLD, navy: NAVY, platinum: PLATINUM } as const;
export type ThemeId = keyof typeof THEMES;
