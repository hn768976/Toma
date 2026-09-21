import { ToneMappingMode } from 'postprocessing';

export type Vec3 = [number, number, number];

/**
 * A light placed in the CAMERA's frame rather than the world's.
 *
 * `dir` is [right, up, back] in camera basis: +right is screen right, +up is
 * screen up, +back is toward the camera (so a negative back value puts the light
 * behind the subject). Placing lights this way means "key from screen upper
 * right" stays true if the camera is re-framed, instead of silently becoming a
 * side light — which is exactly the kind of drift that is invisible until you
 * compare against the reference.
 */
export type LightSpec = {
  dir: Vec3;
  distance: number;
  intensity: number;
  color: string;
};

export type VersionConfig = {
  id: 'light' | 'dark';

  /** Backdrop gradient, authored in LINEAR space and tuned against the encoded
   *  output — the tone mapper sits between these values and the final pixels. */
  bgTop: Vec3;
  bgBottom: Vec3;
  /** Extra darkening toward the lower corners, 0..1. */
  bgCornerFalloff: number;
  /** Cool shift applied with the corner falloff. */
  bgCoolShift: number;

  material: {
    color: string;
    roughness: number;
    metalness: number;
    /** Slight extra tightness on the thin edge faces comes from the clearcoat. */
    clearcoat: number;
    clearcoatRoughness: number;
    envMapIntensity: number;
  };

  lights: {
    key: LightSpec;
    fill: LightSpec;
    /** Rim lights. A single rim tracks the silhouette at some rotations and
     *  loses it at others, so the dark version carries a weaker counter-rim to
     *  keep the edge line continuous all the way round the loop. */
    rims: LightSpec[];
    ambient: { intensity: number; color: string };
    hemi: { sky: string; ground: string; intensity: number };
  };

  /** Procedural equirect environment — soft wrap light and specular response. */
  env: {
    top: Vec3;
    bottom: Vec3;
    /** Soft box lights baked into the env map. */
    blobs: { dir: Vec3; size: number; color: Vec3 }[];
    intensity: number;
  };

  shadow: {
    /** PCSS blur radius in world units at the light's focus plane. */
    size: number;
    focus: number;
    samples: number;
    /** Opacity of the cast shadow on the backdrop. */
    backdropOpacity: number;
    bias: number;
    normalBias: number;
  };

  post: {
    toneMapping: ToneMappingMode;
    exposure: number;
    bokehScale: number;
    focalLength: number;
    bloom: { intensity: number; threshold: number; smoothing: number } | null;
    grain: number;
    dither: number;
  };
};

/** Shared across both versions — the two must read as the same object. */
export const CAMERA = {
  fov: 30, // ~45mm equivalent on full frame (2*atan(12/45) = 29.9 deg)
  // Below the loop, looking up into it, close enough that the band runs out of
  // frame on all four edges at every rotation.
  position: [-1.7483, -0.9624, 0.4684] as Vec3,
  lookAt: [0, 0, 0] as Vec3,
  near: 0.05,
  far: 40,
};

/** Where the depth of field focuses: on the near band, at the loop radius the
 *  band passes through as it crosses over itself. */
export const FOCUS_RADIUS = 0.98;
export const FOCUS_Y = -0.1;

/** Backdrop distance in front of the camera. Far enough to sit well outside
 *  the depth of field, so it stays a soft wash behind the band. */
export const BACKDROP_DISTANCE = 5.2;

export const LIGHT: VersionConfig = {
  id: 'light',
  bgTop: [0.672, 0.706, 0.765],
  bgBottom: [0.6, 0.63, 0.686],
  bgCornerFalloff: 0.135,
  bgCoolShift: 0.024,
  material: {
    // Cool near-white: the reference's highlights stay slightly blue, which is
    // what makes it read as a cool studio rather than plain grey.
    color: '#eff3fd',
    roughness: 0.56,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42,
    envMapIntensity: 1.35,
  },
  lights: {
    // Measured off the reference: it is keyed from the RIGHT and slightly above
    // (bottom-right quadrant is its brightest, bottom-left its darkest).
    key: {
      dir: [0.72, 0.66, 0.55],
      distance: 7,
      intensity: 7.6,
      color: '#edf3ff',
    },
    fill: {
      dir: [-0.8, -0.35, 0.5],
      distance: 6,
      intensity: 0.6,
      color: '#eef3ff',
    },
    rims: [
      {
        dir: [0.35, 0.45, -0.85],
        distance: 7,
        intensity: 1.2,
        color: '#ffffff',
      },
    ],
    ambient: { intensity: 0.09, color: '#e6edfb' },
    hemi: { sky: '#f4f8ff', ground: '#ccd6e6', intensity: 0.3 },
  },
  env: {
    top: [0.95, 0.98, 1.06],
    bottom: [0.6, 0.63, 0.71],
    blobs: [{ dir: [0.62, 0.66, 0.42], size: 0.75, color: [3.3, 3.4, 3.6] }],
    intensity: 0.62,
  },
  shadow: {
    size: 10,
    focus: 0.32,
    samples: 17,
    backdropOpacity: 0.16,
    // normalBias must stay well under the band THICKNESS (0.015 * width), or it
    // offsets the shadow lookup clean off the band and self-shadowing vanishes.
    bias: -0.00035,
    normalBias: 0.0022,
  },
  post: {
    toneMapping: ToneMappingMode.ACES_FILMIC,
    exposure: 1.0,
    bokehScale: 17.0,
    focalLength: 0.035,
    bloom: null,
    grain: 0.016,
    dither: 0.5,
  },
};

export const DARK: VersionConfig = {
  id: 'dark',
  // Not an inversion of V1: the band reads by its edges and sheen, not albedo.
  bgTop: [0.022, 0.0245, 0.0305],
  bgBottom: [0.013, 0.0144, 0.0178],
  bgCornerFalloff: 0.1,
  bgCoolShift: 0.0,
  material: {
    color: '#2a2d33',
    roughness: 0.35,
    metalness: 0.15,
    clearcoat: 0.35,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.0,
  },
  lights: {
    // Not an inversion of V1. The key describes the wide faces rather than
    // flooding them; the rim is what actually makes the shape read.
    key: {
      dir: [0.68, 0.62, 0.5],
      distance: 7,
      intensity: 1.5,
      color: '#ffffff',
    },
    fill: {
      dir: [-0.75, -0.4, 0.45],
      distance: 6,
      intensity: 0.38,
      color: '#93a8cc',
    },
    // The most important light in this version: it separates the silhouette
    // from the background and lines the thin edge faces.
    rims: [
      {
        dir: [0.62, 0.3, -0.9],
        distance: 6,
        intensity: 9.0,
        color: '#ffffff',
      },
      // Counter-rim: without it the edge line drops out entirely at the
      // rotations where the main rim rakes past the silhouette.
      {
        dir: [-0.7, 0.25, -0.85],
        distance: 6,
        intensity: 4.0,
        color: '#eaf0ff',
      },
      {
        dir: [0.05, -0.55, -0.95],
        distance: 6,
        intensity: 2.2,
        color: '#c9d6ee',
      },
    ],
    ambient: { intensity: 0.06, color: '#9fb0cc' },
    hemi: { sky: '#8093ad', ground: '#0a0b0d', intensity: 0.26 },
  },
  env: {
    top: [0.028, 0.031, 0.04],
    bottom: [0.004, 0.0045, 0.006],
    blobs: [
      { dir: [0.6, 0.66, 0.45], size: 0.55, color: [0.6, 0.6, 0.66] },
      { dir: [0.62, 0.3, -0.78], size: 0.48, color: [3.0, 3.0, 3.15] },
      { dir: [-0.68, 0.22, -0.7], size: 0.42, color: [1.5, 1.5, 1.62] },
    ],
    intensity: 0.6,
  },
  shadow: {
    size: 9,
    focus: 0.32,
    samples: 17,
    backdropOpacity: 0.12,
    bias: -0.00035,
    normalBias: 0.0022,
  },
  post: {
    toneMapping: ToneMappingMode.ACES_FILMIC,
    exposure: 1.0,
    bokehScale: 5.0,
    focalLength: 0.035,
    bloom: { intensity: 0.5, threshold: 0.72, smoothing: 0.22 },
    grain: 0.012,
    dither: 0.5,
  },
};

export const VERSIONS = { light: LIGHT, dark: DARK };
