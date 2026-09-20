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

export type GlassVariant = {
  id: "v1" | "v2";
  label: string;

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

export const VARIANTS: Record<"v1" | "v2", GlassVariant> = { v1: V1, v2: V2 };
