/**
 * Look definitions for the two versions.
 *
 * V1 mirrors the dark reference: near-black field, intense blue rim lighting,
 * prismatic dispersion mixed into the blue highlights.
 * V2 mirrors the light reference: bright sky-blue field, soft neutral texture,
 * rainbow chromatic aberration along the refracting edges.
 *
 * Colours written as hex strings are authored in sRGB and converted to linear
 * on load; colours written as number triples are already linear radiance, which
 * is what the HDR environment needs so highlights can exceed 1.0.
 */

/** A soft-box style light painted into the equirectangular environment. */
export type EnvLight = {
  /** Longitude of the centre, 0..1 across the full 360deg. */
  u: number;
  /** Latitude of the centre, 0 (down) .. 1 (up). */
  v: number;
  /** Half-width along longitude, in the same 0..1 units. */
  width: number;
  /** Half-height along latitude, in the same 0..1 units. */
  height: number;
  /** Rotation of the strip, in turns. */
  tilt: number;
  /** Linear RGB radiance of the light. */
  color: [number, number, number];
  /** Peak multiplier; values well above 1 are what make the rims glow. */
  intensity: number;
};

import {
  SHEET_HALF_THICKNESS,
  THREE_CIRCLE_LAYOUT,
  buildField,
  type DiscSpec,
} from "./layout";

export type GlassVariant = {
  id: "v1" | "v2" | "v3" | "v4" | "v5";
  label: string;
  /** The discs this variant puts on screen, and how they move. */
  discs: DiscSpec[];

  backdrop: {
    /** Vertical gradient of the field behind the glass. */
    top: string;
    bottom: string;
    /** Soft light pool drifting across the field. */
    glowColor: string;
    glowIntensity: number;
    glowRadius: number;
    /** Secondary, broader wash. */
    washColor: string;
    washIntensity: number;
    vignette: number;
  };

  environment: {
    /** Linear RGB at the zenith, horizon and nadir of the environment sphere. */
    up: [number, number, number];
    horizon: [number, number, number];
    down: [number, number, number];
    lights: EnvLight[];
    /** Overall multiplier applied to the image-based lighting. */
    intensity: number;
  };

  glass: {
    ior: number;
    /** Strength of the wavelength split inside the glass body. */
    dispersion: number;
    roughness: number;
    /** Physical thickness of the sheet, in world units. */
    thickness: number;
    attenuationColor: string;
    attenuationDistance: number;
    envMapIntensity: number;
  };

  rim: {
    /** Brightness of the hard specular line on the silhouette. */
    specularGain: number;
    /** Brightness of the refracted rainbow crescent just inside it. */
    dispersionGain: number;
    /** How far apart the R/G/B refraction indices sit; drives the rainbow. */
    iorSpread: number;
    /** Tightness of the specular line. Higher is thinner. */
    edgePower: number;
    /** Width of the crescent. Higher is thinner. */
    bandPower: number;
    /** Pushes the crescent inward, opening a gap behind the specular line. */
    innerFalloff: number;
    tint: string;
  };

  bloom: { strength: number; radius: number; threshold: number };

  /**
   * How the disc bodies are shaded. "glass" is physical transmission with
   * dispersion; "film" is tinted stock that multiplies where circles overlap.
   */
  body: "glass" | "film";
  /** Only read when body is "film". */
  film: { edgeDarkness: number; edgeWidth: number };

  /** Fine neutral texture over the whole frame. */
  grain: number;

  toneMapping: "neutral" | "aces" | "none";
  exposure: number;
  /** Clear colour behind the backdrop plane. */
  clearColor: string;
};

export const V1: GlassVariant = {
  id: "v1",
  body: "glass" as const,
  film: { edgeDarkness: 1, edgeWidth: 1 },
  label: "Dark field, neon blue rim light",
  discs: THREE_CIRCLE_LAYOUT,
  backdrop: {
    top: "#04060b",
    bottom: "#000103",
    glowColor: "#0a2159",
    glowIntensity: 0.06,
    glowRadius: 5.2,
    washColor: "#061634",
    washIntensity: 0.10,
    vignette: 0.60,
  },
  environment: {
    up: [0.012, 0.019, 0.038],
    horizon: [0.006, 0.011, 0.024],
    down: [0.002, 0.003, 0.008],
    lights: [
      // The hot blue-white core that catches the rims.
      {
        u: 0.2,
        v: 0.6,
        width: 0.09,
        height: 0.024,
        tilt: 0.06,
        color: [0.18, 0.48, 1.0],
        intensity: 45,
      },
      // A broad deep-blue fill that keeps the glass reading as blue.
      {
        u: 0.34,
        v: 0.48,
        width: 0.16,
        height: 0.05,
        tilt: -0.04,
        color: [0.06, 0.22, 0.9],
        intensity: 3.5,
      },
      // Low warm accent: the pink/amber flecks in the dispersion.
      {
        u: 0.72,
        v: 0.38,
        width: 0.05,
        height: 0.016,
        tilt: 0.1,
        color: [1.0, 0.55, 0.3],
        intensity: 1.5,
      },
      // Cool back fill so the far side of each rim is not dead black.
      {
        u: 0.88,
        v: 0.66,
        width: 0.10,
        height: 0.035,
        tilt: 0.0,
        color: [0.2, 0.4, 1.0],
        intensity: 1.5,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.55,
    dispersion: 7.5,
    roughness: 0.10,
    thickness: 0.1,
    attenuationColor: "#5a8cff",
    attenuationDistance: 2.0,
    envMapIntensity: 0.15,
  },
  rim: {
    specularGain: 4.5,
    dispersionGain: 7.0,
    iorSpread: 0.10,
    edgePower: 6.0,
    bandPower: 2.2,
    innerFalloff: 6.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.75, radius: 0.72, threshold: 0.7 },
  grain: 0.018,
  toneMapping: "aces",
  exposure: 1.0,
  clearColor: "#000103",
};

export const V2: GlassVariant = {
  id: "v2",
  body: "glass" as const,
  film: { edgeDarkness: 1, edgeWidth: 1 },
  label: "Bright sky-blue field, soft prismatic glass",
  discs: THREE_CIRCLE_LAYOUT,
  backdrop: {
    top: "#dde8f4",
    bottom: "#9fbcd8",
    glowColor: "#ffffff",
    glowIntensity: 0.07,
    glowRadius: 4.6,
    washColor: "#b9cfe4",
    washIntensity: 0.08,
    vignette: 0.25,
  },
  environment: {
    up: [0.50, 0.56, 0.66],
    horizon: [0.38, 0.44, 0.54],
    down: [0.22, 0.26, 0.33],
    lights: [
      // Large soft key, the source of the bright rim arc.
      {
        u: 0.14,
        v: 0.68,
        width: 0.13,
        height: 0.06,
        tilt: 0.04,
        color: [1.0, 1.0, 1.0],
        intensity: 22,
      },
      // Cool secondary that keeps the sky-blue cast alive.
      {
        u: 0.62,
        v: 0.55,
        width: 0.13,
        height: 0.05,
        tilt: -0.05,
        color: [0.76, 0.88, 1.0],
        intensity: 10,
      },
      // Warm low accent: the amber end of the rainbow fringe.
      {
        u: 0.86,
        v: 0.42,
        width: 0.09,
        height: 0.032,
        tilt: 0.08,
        color: [1.0, 0.86, 0.7],
        intensity: 8,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.52,
    dispersion: 5.5,
    roughness: 0.05,
    thickness: 0.1,
    attenuationColor: "#d8ecff",
    attenuationDistance: 3.0,
    envMapIntensity: 1.35,
  },
  rim: {
    specularGain: 1.8,
    dispersionGain: 18.0,
    iorSpread: 0.13,
    edgePower: 7.0,
    bandPower: 2.0,
    innerFalloff: 5.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.22, radius: 0.6, threshold: 1.1 },
  grain: 0.012,
  toneMapping: "neutral",
  exposure: 1.0,
  clearColor: "#9fbcd8",
};


/**
 * V3 and V4 are the same rig as each other in two palettes. They use exactly
 * the glass of V1 and V2 -- the same round sheet-glass discs at the same
 * constant thickness, with the same thin two-lobe rim -- but many of them,
 * filling the frame edge to edge instead of three hero circles.
 */
const CIRCLE_FIELD = buildField({
  columns: 5,
  rows: 3,
  spread: [3.6, 2.3],
  radius: [0.5, 1.3],
  depth: [-1.1, 1.1],
  halfThickness: SHEET_HALF_THICKNESS,
  jitter: 1.0,
  drift: [0.18, 0.16, 0.12],
  seed: 20240921,
});

export const V3: GlassVariant = {
  id: "v3",
  body: "glass" as const,
  film: { edgeDarkness: 1, edgeWidth: 1 },
  label: "Violet field, cyan and green crescent light",
  discs: CIRCLE_FIELD,
  backdrop: {
    top: "#2e1257",
    bottom: "#160726",
    glowColor: "#5a2596",
    glowIntensity: 0.12,
    glowRadius: 5.4,
    washColor: "#24094a",
    washIntensity: 0.12,
    vignette: 0.45,
  },
  environment: {
    up: [0.03, 0.02, 0.07],
    horizon: [0.02, 0.012, 0.05],
    down: [0.01, 0.005, 0.022],
    lights: [
      // Cyan-green key: the bright crescent through the body of each sphere.
      {
        u: 0.17,
        v: 0.62,
        width: 0.08,
        height: 0.025,
        tilt: 0.05,
        color: [0.25, 1.0, 0.85],
        intensity: 8,
      },
      // Electric blue fill, which is what most of the crescents read as.
      {
        u: 0.33,
        v: 0.5,
        width: 0.15,
        height: 0.05,
        tilt: -0.03,
        color: [0.25, 0.4, 1.0],
        intensity: 1.2,
      },
      // Magenta counter-light on the opposite edge.
      {
        u: 0.74,
        v: 0.44,
        width: 0.07,
        height: 0.022,
        tilt: 0.07,
        color: [1.0, 0.25, 0.85],
        intensity: 2.5,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.55,
    dispersion: 7.0,
    roughness: 0.1,
    thickness: 0.1,
    attenuationColor: "#7a4ad0",
    attenuationDistance: 0.2,
    envMapIntensity: 0.015,
  },
  rim: {
    specularGain: 3.0,
    dispersionGain: 4.5,
    iorSpread: 0.09,
    edgePower: 6.0,
    bandPower: 2.2,
    innerFalloff: 6.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.35, radius: 0.7, threshold: 0.8 },
  grain: 0.014,
  toneMapping: "aces",
  exposure: 1.0,
  clearColor: "#160726",
};

export const V4: GlassVariant = {
  id: "v4",
  body: "glass" as const,
  film: { edgeDarkness: 1, edgeWidth: 1 },
  label: "Near-black field, cyan crescents against crimson rims",
  discs: CIRCLE_FIELD,
  backdrop: {
    top: "#0a0410",
    bottom: "#040107",
    glowColor: "#5e0c1a",
    glowIntensity: 0.07,
    glowRadius: 4.8,
    washColor: "#10030a",
    washIntensity: 0.10,
    vignette: 0.5,
  },
  environment: {
    up: [0.015, 0.018, 0.035],
    horizon: [0.01, 0.011, 0.024],
    down: [0.005, 0.004, 0.011],
    lights: [
      // Cool key: the wide cyan-white crescent.
      {
        u: 0.2,
        v: 0.64,
        width: 0.085,
        height: 0.026,
        tilt: 0.04,
        color: [0.45, 0.85, 1.0],
        intensity: 9,
      },
      // Deep blue fill so the bodies do not go flat black.
      {
        u: 0.36,
        v: 0.5,
        width: 0.16,
        height: 0.05,
        tilt: -0.03,
        color: [0.2, 0.32, 1.0],
        intensity: 1.0,
      },
      // Crimson counter-light: the hot thin line on the far silhouette.
      {
        u: 0.72,
        v: 0.42,
        width: 0.06,
        height: 0.02,
        tilt: 0.08,
        color: [1.0, 0.1, 0.22],
        intensity: 6,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.55,
    dispersion: 7.0,
    roughness: 0.1,
    thickness: 0.1,
    attenuationColor: "#3a5ad0",
    attenuationDistance: 0.2,
    envMapIntensity: 0.015,
  },
  rim: {
    specularGain: 3.2,
    dispersionGain: 4.8,
    iorSpread: 0.09,
    edgePower: 6.0,
    bandPower: 2.2,
    innerFalloff: 6.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.38, radius: 0.7, threshold: 0.8 },
  grain: 0.016,
  toneMapping: "aces",
  exposure: 1.05,
  clearColor: "#040107",
};


/**
 * V5 is the same round glass again, but as coloured stock on a white field.
 *
 * The reference's defining behaviour is that overlaps compound: two circles
 * crossing make a third, darker colour, the way gels do. That is a multiply,
 * not a refraction, so the bodies here are tinted film rather than clear glass
 * -- see createFilmMaterial. The geometry, the field and the motion are
 * unchanged from V3 and V4.
 */
const FILM_TINTS = [
  { from: "#ff5577", to: "#ffc44d" },
  { from: "#ff8a4d", to: "#ff4d6a" },
  { from: "#4dd6b0", to: "#4d96ff" },
  { from: "#ff6ad0", to: "#ffa84d" },
  { from: "#5fd0ff", to: "#5f7aff" },
  { from: "#ffd45f", to: "#9fd45f" },
  { from: "#ff5fa5", to: "#b06aff" },
  { from: "#ffa15f", to: "#ffe07a" },
];

const FILM_FIELD = buildField({
  columns: 5,
  rows: 3,
  spread: [3.6, 2.3],
  radius: [0.5, 1.3],
  depth: [-1.1, 1.1],
  halfThickness: SHEET_HALF_THICKNESS,
  jitter: 1.0,
  drift: [0.18, 0.16, 0.12],
  tints: FILM_TINTS,
  seed: 20240922,
});

export const V5: GlassVariant = {
  id: "v5",
  body: "film" as const,
  film: { edgeDarkness: 0.55, edgeWidth: 0.28 },
  label: "White field, overlapping coloured film",
  discs: FILM_FIELD,
  backdrop: {
    top: "#ffffff",
    bottom: "#f4f6f9",
    glowColor: "#ffffff",
    glowIntensity: 0.04,
    glowRadius: 5.5,
    washColor: "#eef2f7",
    washIntensity: 0.05,
    vignette: 0.06,
  },
  environment: {
    up: [0.25, 0.26, 0.3],
    horizon: [0.18, 0.19, 0.22],
    down: [0.1, 0.1, 0.12],
    lights: [
      {
        u: 0.18,
        v: 0.66,
        width: 0.1,
        height: 0.04,
        tilt: 0.04,
        color: [1.0, 1.0, 1.0],
        intensity: 6,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.5,
    dispersion: 0,
    roughness: 0.12,
    thickness: 0.1,
    attenuationColor: "#ffffff",
    attenuationDistance: 4.0,
    envMapIntensity: 0.1,
  },
  // The rim stays, but quietly: the reference shows a thin bright catch on a
  // few edges rather than the neon arcs of the darker pieces.
  rim: {
    specularGain: 0.22,
    dispersionGain: 0.3,
    iorSpread: 0.06,
    edgePower: 7.0,
    bandPower: 2.6,
    innerFalloff: 8.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.0, radius: 0.5, threshold: 2.0 },
  grain: 0.008,
  toneMapping: "neutral",
  exposure: 1.0,
  clearColor: "#ffffff",
};

export const VARIANTS: Record<GlassVariant["id"], GlassVariant> = {
  v1: V1,
  v2: V2,
  v3: V3,
  v4: V4,
  v5: V5,
};
