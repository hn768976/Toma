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

import { THREE_CIRCLE_LAYOUT, buildField, type DiscSpec } from "./layout";

export type GlassVariant = {
  id: "v1" | "v2" | "v3" | "v4";
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

  /** Fine neutral texture over the whole frame. */
  grain: number;

  toneMapping: "neutral" | "aces";
  exposure: number;
  /** Clear colour behind the backdrop plane. */
  clearColor: string;
};

export const V1: GlassVariant = {
  id: "v1",
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
 * V3 and V4 are the same rig as each other in two palettes, and a different rig
 * from V1/V2: instead of three thin sheet-glass discs they are a dense field of
 * thick, sphere-like bodies filling the frame edge to edge.
 *
 * Their signature is a wide crescent of light inside each body -- light caught
 * by the fat rounded rim -- with a thin contrasting line hugging the outer
 * silhouette on the opposite side. That is the same two-lobe rim shader V1/V2
 * use, opened right up: a low band power widens the crescent from a hairline to
 * a third of the body.
 */
const SPHERE_FIELD = buildField({
  columns: 5,
  rows: 3,
  spread: [3.6, 2.3],
  radius: [0.62, 1.15],
  depth: [-1.1, 1.1],
  thicknessRatio: 0.36,
  jitter: 0.85,
  drift: [0.18, 0.16, 0.12],
  seed: 20240921,
});

export const V3: GlassVariant = {
  id: "v3",
  label: "Violet field, cyan and green crescent light",
  discs: SPHERE_FIELD,
  backdrop: {
    top: "#3b1b6b",
    bottom: "#1a0730",
    glowColor: "#6a2ea8",
    glowIntensity: 0.34,
    glowRadius: 5.4,
    washColor: "#2a0f52",
    washIntensity: 0.22,
    vignette: 0.42,
  },
  environment: {
    up: [0.05, 0.03, 0.12],
    horizon: [0.03, 0.02, 0.08],
    down: [0.015, 0.008, 0.035],
    lights: [
      // Cyan-green key: the bright crescent through the body of each sphere.
      {
        u: 0.17,
        v: 0.62,
        width: 0.13,
        height: 0.05,
        tilt: 0.05,
        color: [0.25, 1.0, 0.85],
        intensity: 26,
      },
      // Electric blue fill, which is what most of the crescents read as.
      {
        u: 0.33,
        v: 0.5,
        width: 0.18,
        height: 0.07,
        tilt: -0.03,
        color: [0.3, 0.45, 1.0],
        intensity: 16,
      },
      // Magenta counter-light on the opposite edge.
      {
        u: 0.74,
        v: 0.44,
        width: 0.12,
        height: 0.045,
        tilt: 0.07,
        color: [1.0, 0.25, 0.85],
        intensity: 12,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.48,
    dispersion: 2.5,
    roughness: 0.08,
    thickness: 0.5,
    attenuationColor: "#7a4ad0",
    attenuationDistance: 1.6,
    envMapIntensity: 0.55,
  },
  rim: {
    specularGain: 2.2,
    dispersionGain: 5.0,
    iorSpread: 0.05,
    edgePower: 5.0,
    // A low band power is what turns the hairline into a broad crescent.
    bandPower: 1.0,
    innerFalloff: 3.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.5, radius: 0.7, threshold: 0.8 },
  grain: 0.014,
  toneMapping: "aces",
  exposure: 1.0,
  clearColor: "#1a0730",
};

export const V4: GlassVariant = {
  id: "v4",
  label: "Near-black field, cyan crescents against crimson rims",
  discs: SPHERE_FIELD,
  backdrop: {
    top: "#0a0410",
    bottom: "#050108",
    glowColor: "#6b0f1e",
    glowIntensity: 0.42,
    glowRadius: 4.8,
    washColor: "#12030a",
    washIntensity: 0.25,
    vignette: 0.5,
  },
  environment: {
    up: [0.02, 0.025, 0.05],
    horizon: [0.012, 0.014, 0.032],
    down: [0.006, 0.005, 0.014],
    lights: [
      // Cool key: the wide cyan-white crescent.
      {
        u: 0.2,
        v: 0.64,
        width: 0.14,
        height: 0.055,
        tilt: 0.04,
        color: [0.45, 0.85, 1.0],
        intensity: 30,
      },
      // Deep blue fill so the bodies do not go flat black.
      {
        u: 0.36,
        v: 0.5,
        width: 0.2,
        height: 0.08,
        tilt: -0.03,
        color: [0.2, 0.32, 1.0],
        intensity: 10,
      },
      // Crimson counter-light: the hot thin line on the far silhouette.
      {
        u: 0.72,
        v: 0.42,
        width: 0.1,
        height: 0.04,
        tilt: 0.08,
        color: [1.0, 0.1, 0.22],
        intensity: 22,
      },
    ],
    intensity: 1.0,
  },
  glass: {
    ior: 1.5,
    dispersion: 2.0,
    roughness: 0.07,
    thickness: 0.5,
    attenuationColor: "#3a5ad0",
    attenuationDistance: 1.4,
    envMapIntensity: 0.5,
  },
  rim: {
    specularGain: 2.6,
    dispersionGain: 5.5,
    iorSpread: 0.05,
    edgePower: 5.5,
    bandPower: 1.0,
    innerFalloff: 3.0,
    tint: "#ffffff",
  },
  bloom: { strength: 0.6, radius: 0.72, threshold: 0.75 },
  grain: 0.016,
  toneMapping: "aces",
  exposure: 1.05,
  clearColor: "#050108",
};

export const VARIANTS: Record<GlassVariant["id"], GlassVariant> = {
  v1: V1,
  v2: V2,
  v3: V3,
  v4: V4,
};
