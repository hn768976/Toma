/**
 * The fifteen looks. Each entry is a complete art direction — backdrop,
 * glass chemistry, field layout, camera and grade — and each duration is
 * taken frame-for-frame from its reference clip at 30fps.
 */

export type Motion =
  | 'converge'   // scattered bubbles gather into a tight centre cluster
  | 'macroHero'  // one hero bubble, huge defocused neighbours behind
  | 'rise'       // steady upward float
  | 'fill'       // frame blooms outward from an empty centre
  | 'packed'     // densely tiled spheres, slow parallax drift
  | 'float'      // free drift under heavy depth of field
  | 'swirl'      // orbital churn, as if stirred through liquid
  | 'cell';      // concentric bubble-within-bubble

export type RGB = [number, number, number];

export type VersionConfig = {
  id: string;
  name: string;
  reference: string;
  durationInFrames: number;

  background: {
    inner: RGB;
    outer: RGB;
    center: [number, number];
    radius: number;
    falloff: number;
    rampColor: RGB;
    rampAmount: number;
    rampAngle: number;
    panel: number;
  };

  glass: {
    tint: RGB;
    rimColor: RGB;
    specColor: RGB;
    ior: number;
    refract: number;
    absorb: number;
    fresnelPower: number;
    fresnelStrength: number;
    dispersion: number;
    specPower: number;
    specStrength: number;
    specAniso: number;
    rimWidth: number;
    innerAmount: number;
    innerScale: number;
    innerDensity: number;
    iridescence: number;
    edgeDark: number;
    opacity: number;
    sheen: number;
    shellGap: number;
  };

  field: {
    motion: Motion;
    count: number;
    minRadius: number;
    maxRadius: number;
    spreadX: number;
    spreadY: number;
    spreadZ: number;
    driftSpeed: number;
    rotateSpeed: number;
    /** Overrides the random radius for the hero bubble in `macroHero`. */
    heroRadius?: number;
    /** Fraction of bubbles pushed to the defocused rear layer. */
    farRatio: number;
    /** Fraction pushed to the defocused foreground layer. */
    nearRatio: number;
    seed: number;
  };

  camera: {
    fov: number;
    /** Visible world height at z=0. Camera distance is derived from it, so
     *  every radius and spread below is a plain fraction of the frame. */
    frameHeight: number;
    pushIn: number;
    driftX: number;
    driftY: number;
  };

  grade: {
    farBlur: number;
    nearBlur: number;
    bloom: number;
    bloomThreshold: number;
    chroma: number;
    vignette: number;
    grain: number;
    exposure: number;
    contrast: number;
    saturation: number;
  };
};

/** Shared starting point so each version only states what makes it different. */
const base = {
  glass: {
    ior: 1.34,
    refract: 0.054,
    absorb: 0.96,
    fresnelPower: 2.6,
    fresnelStrength: 0.26,
    dispersion: 0.05,
    specPower: 30,
    specStrength: 0.47,
    specAniso: 3.2,
    rimWidth: 0.62,
    innerAmount: 0.26,
    innerScale: 2.79,
    innerDensity: 0.48,
    iridescence: 0.0,
    edgeDark: 0.09,
    sheen: 0.028,
    opacity: 0.93,
    shellGap: 0.42,
  },
  grade: {
    farBlur: 3.0,
    nearBlur: 5.0,
    bloom: 0.22,
    bloomThreshold: 0.72,
    chroma: 0.016,
    vignette: 0.16,
    grain: 0.012,
    exposure: 1.02,
    contrast: 1.02,
    saturation: 1.05,
  },
  camera: { fov: 38, frameHeight: 10, pushIn: 0.0, driftX: 0.0, driftY: 0.0 },
};

export const VERSIONS: VersionConfig[] = [
  {
    id: 'v01-crystal-merge',
    name: 'Crystal Merge',
    reference: '01098b60 — clear glass bubbles gathering on white',
    durationInFrames: 299,
    background: {
      inner: [1.0, 1.0, 1.0], outer: [0.93, 0.94, 0.96],
      center: [0.5, 0.55], radius: 0.95, falloff: 1.6,
      rampColor: [0.97, 0.98, 1.0], rampAmount: 0.15, rampAngle: 1.57, panel: 0.13,
    },
    glass: {
      ...base.glass, tint: [0.9, 0.93, 0.97], rimColor: [0.99, 1.0, 1.0],
      specColor: [1, 1, 1], refract: 0.068, absorb: 0.44, fresnelStrength: 0.31,
      dispersion: 0.07, specStrength: 0.61, innerAmount: 0.16,
      innerDensity: 0.26, edgeDark: 0.23, specPower: 38, rimWidth: 0.55, sheen: 0.033, opacity: 0.93,
    },
    field: {
      motion: 'converge', count: 80, minRadius: 0.62, maxRadius: 1.3,
      spreadX: 3.8, spreadY: 2.5, spreadZ: 2.8, driftSpeed: 0.3, rotateSpeed: 0.12,
      farRatio: 0.2, nearRatio: 0.1, seed: 1011,
    },
    camera: { ...base.camera, fov: 40, frameHeight: 10 },
    grade: { ...base.grade, vignette: 0.06, saturation: 0.96, contrast: 1.03, farBlur: 2.6 },
  },
  {
    id: 'v02-golden-elixir',
    name: 'Golden Elixir',
    reference: '0b765f20 — golden oil macro with a hero bubble',
    durationInFrames: 300,
    background: {
      inner: [0.98, 0.86, 0.45], outer: [0.93, 0.78, 0.33],
      center: [0.45, 0.5], radius: 1.05, falloff: 1.3,
      rampColor: [1.0, 0.92, 0.58], rampAmount: 0.2, rampAngle: 2.2, panel: 0.09,
    },
    glass: {
      ...base.glass, tint: [1.0, 0.85, 0.42], rimColor: [1.0, 0.94, 0.72],
      specColor: [1, 0.99, 0.9], refract: 0.044, absorb: 1.36, fresnelStrength: 0.21,
      specStrength: 0.41, innerAmount: 0.3, innerScale: 3.77, innerDensity: 0.48,
      edgeDark: 0.15, specPower: 26, rimWidth: 0.66, sheen: 0.028, opacity: 0.93,
    },
    field: {
      motion: 'macroHero', heroRadius: 3.2, count: 24, minRadius: 0.7, maxRadius: 3.4,
      spreadX: 7.5, spreadY: 5.0, spreadZ: 7.0, driftSpeed: 0.12, rotateSpeed: 0.05,
      farRatio: 0.78, nearRatio: 0.0, seed: 2022,
    },
    camera: { ...base.camera, fov: 34, frameHeight: 10, pushIn: 0.6 },
    grade: { ...base.grade, farBlur: 6.5, bloom: 0.26, vignette: 0.2, saturation: 1.12 },
  },
  {
    id: 'v03-lavender-serum',
    name: 'Lavender Serum',
    reference: '1925e8eb — lavender macro hero bubble',
    durationInFrames: 300,
    background: {
      inner: [0.82, 0.72, 0.95], outer: [0.72, 0.6, 0.92],
      center: [0.48, 0.5], radius: 1.05, falloff: 1.3,
      rampColor: [0.9, 0.84, 0.99], rampAmount: 0.22, rampAngle: 2.2, panel: 0.09,
    },
    glass: {
      ...base.glass, tint: [0.72, 0.52, 0.95], rimColor: [0.93, 0.89, 1.0],
      specColor: [1, 1, 1], refract: 0.044, absorb: 1.20, fresnelStrength: 0.22,
      specStrength: 0.43, innerAmount: 0.3, innerScale: 3.77, innerDensity: 0.48,
      edgeDark: 0.15, specPower: 26, rimWidth: 0.66, sheen: 0.028, opacity: 0.93,
    },
    field: {
      motion: 'macroHero', heroRadius: 3.2, count: 24, minRadius: 0.7, maxRadius: 3.4,
      spreadX: 7.5, spreadY: 5.0, spreadZ: 7.0, driftSpeed: 0.12, rotateSpeed: 0.05,
      farRatio: 0.78, nearRatio: 0.0, seed: 3033,
    },
    camera: { ...base.camera, fov: 34, frameHeight: 10, pushIn: 0.6 },
    grade: { ...base.grade, farBlur: 6.5, bloom: 0.24, vignette: 0.2, saturation: 1.1 },
  },
  {
    id: 'v04-champagne-rise',
    name: 'Champagne Rise',
    reference: '19ad4cf0 — cream bubbles rising with trapped micro-bubbles',
    durationInFrames: 360,
    background: {
      inner: [0.96, 0.91, 0.79], outer: [0.9, 0.83, 0.68],
      center: [0.5, 0.45], radius: 1.1, falloff: 1.4,
      rampColor: [0.99, 0.96, 0.87], rampAmount: 0.18, rampAngle: 1.9, panel: 0.1,
    },
    glass: {
      ...base.glass, tint: [0.99, 0.9, 0.62], rimColor: [1.0, 0.97, 0.87],
      specColor: [1, 1, 0.96], refract: 0.041, absorb: 1.25, fresnelStrength: 0.20,
      specStrength: 0.47, innerAmount: 0.34, innerScale: 4.43, innerDensity: 0.55,
      edgeDark: 0.16, specPower: 30, rimWidth: 0.62, sheen: 0.033, opacity: 0.93,
    },
    field: {
      motion: 'rise', count: 30, minRadius: 1.9, maxRadius: 2.8,
      spreadX: 8.0, spreadY: 5.0, spreadZ: 5.0, driftSpeed: 0.5, rotateSpeed: 0.06,
      farRatio: 0.4, nearRatio: 0.12, seed: 4044,
    },
    camera: { ...base.camera, fov: 36, frameHeight: 10 },
    grade: { ...base.grade, farBlur: 5.2, bloom: 0.2, vignette: 0.14, saturation: 1.04 },
  },
  {
    id: 'v05-amber-bloom',
    name: 'Amber Bloom',
    reference: '1b05cea5 — amber oil beads filling the frame',
    durationInFrames: 250,
    background: {
      inner: [0.99, 0.95, 0.85], outer: [0.95, 0.89, 0.76],
      center: [0.5, 0.5], radius: 0.7, falloff: 1.1,
      rampColor: [1.0, 0.95, 0.83], rampAmount: 0.12, rampAngle: 1.57, panel: 0.035,
    },
    glass: {
      ...base.glass, tint: [1.0, 0.76, 0.24], rimColor: [1.0, 0.9, 0.6],
      specColor: [1, 0.98, 0.88], refract: 0.048, absorb: 1.60, fresnelStrength: 0.19,
      specStrength: 0.41, innerAmount: 0.3, innerScale: 4.10, innerDensity: 0.53,
      edgeDark: 0.21, specPower: 28, rimWidth: 0.6, sheen: 0.028, opacity: 0.93,
    },
    field: {
      motion: 'fill', count: 78, minRadius: 1.35, maxRadius: 2.15,
      spreadX: 8.5, spreadY: 5.2, spreadZ: 4.5, driftSpeed: 0.28, rotateSpeed: 0.07,
      farRatio: 0.35, nearRatio: 0.1, seed: 5055,
    },
    camera: { ...base.camera, fov: 40, frameHeight: 10, pushIn: -0.5 },
    grade: { ...base.grade, farBlur: 4.6, bloom: 0.20, vignette: 0.1, saturation: 1.14, contrast: 1.02 },
  },
  {
    id: 'v06-aqua-gel',
    name: 'Aqua Gel',
    reference: '44b34ffc — dense blue gel spheres, macro',
    durationInFrames: 300,
    background: {
      inner: [0.95, 0.98, 1.0], outer: [0.78, 0.88, 0.95],
      center: [0.42, 0.42], radius: 1.0, falloff: 1.3,
      rampColor: [0.86, 0.93, 0.99], rampAmount: 0.2, rampAngle: 2.4, panel: 0.14,
    },
    glass: {
      ...base.glass, tint: [0.5, 0.76, 0.93], rimColor: [0.93, 0.98, 1.0],
      specColor: [1, 1, 1], refract: 0.065, absorb: 1.7, fresnelStrength: 0.25,
      dispersion: 0.06, specStrength: 0.55, innerAmount: 0.28, innerScale: 4.92,
      innerDensity: 0.60, edgeDark: 0.3, specPower: 34, rimWidth: 0.58, sheen: 0.033, opacity: 0.93,
    },
    field: {
      motion: 'packed', count: 44, minRadius: 1.95, maxRadius: 2.6,
      spreadX: 8.8, spreadY: 5.2, spreadZ: 3.5, driftSpeed: 0.18, rotateSpeed: 0.09,
      farRatio: 0.3, nearRatio: 0.05, seed: 6066,
    },
    camera: { ...base.camera, fov: 36, frameHeight: 10, pushIn: 0.35 },
    grade: { ...base.grade, farBlur: 4.0, bloom: 0.24, vignette: 0.12, saturation: 1.08, contrast: 1.03 },
  },
  {
    id: 'v07-peach-nectar',
    name: 'Peach Nectar',
    reference: '54161323 — peach macro hero bubble',
    durationInFrames: 300,
    background: {
      inner: [0.99, 0.74, 0.54], outer: [0.96, 0.63, 0.42],
      center: [0.48, 0.5], radius: 1.05, falloff: 1.3,
      rampColor: [1.0, 0.83, 0.66], rampAmount: 0.2, rampAngle: 2.2, panel: 0.09,
    },
    glass: {
      ...base.glass, tint: [1.0, 0.66, 0.4], rimColor: [1.0, 0.89, 0.79],
      specColor: [1, 0.99, 0.95], refract: 0.044, absorb: 1.24, fresnelStrength: 0.21,
      specStrength: 0.41, innerAmount: 0.3, innerScale: 3.77, innerDensity: 0.48,
      edgeDark: 0.15, specPower: 26, rimWidth: 0.66, sheen: 0.028, opacity: 0.93,
    },
    field: {
      motion: 'macroHero', heroRadius: 3.2, count: 24, minRadius: 0.7, maxRadius: 3.4,
      spreadX: 7.5, spreadY: 5.0, spreadZ: 7.0, driftSpeed: 0.12, rotateSpeed: 0.05,
      farRatio: 0.78, nearRatio: 0.0, seed: 7077,
    },
    camera: { ...base.camera, fov: 34, frameHeight: 10, pushIn: 0.6 },
    grade: { ...base.grade, farBlur: 6.5, bloom: 0.25, vignette: 0.2, saturation: 1.1 },
  },
  {
    id: 'v08-porcelain-drift',
    name: 'Porcelain Drift',
    reference: '7bb50051 — blue-white droplets under heavy defocus',
    durationInFrames: 300,
    background: {
      inner: [0.94, 0.95, 0.97], outer: [0.85, 0.87, 0.91],
      center: [0.55, 0.4], radius: 0.9, falloff: 1.5,
      rampColor: [0.91, 0.94, 0.99], rampAmount: 0.24, rampAngle: 1.2, panel: 0.1,
    },
    glass: {
      ...base.glass, tint: [0.45, 0.6, 0.88], rimColor: [0.98, 0.99, 1.0],
      specColor: [1, 1, 1], refract: 0.051, absorb: 1.04, fresnelStrength: 0.19,
      specStrength: 0.49, innerAmount: 0.14, innerScale: 4.10, innerDensity: 0.24,
      edgeDark: 0.18, specPower: 33, rimWidth: 0.6, sheen: 0.039, opacity: 0.93,
    },
    field: {
      motion: 'float', count: 30, minRadius: 1.0, maxRadius: 2.1,
      spreadX: 8.0, spreadY: 5.0, spreadZ: 7.0, driftSpeed: 0.26, rotateSpeed: 0.06,
      farRatio: 0.42, nearRatio: 0.2, seed: 8088,
    },
    camera: { ...base.camera, fov: 35, frameHeight: 10 },
    grade: { ...base.grade, farBlur: 8.0, nearBlur: 9.0, bloom: 0.3, vignette: 0.1, saturation: 0.98 },
  },
  {
    id: 'v09-violet-gel',
    name: 'Violet Gel',
    reference: '8c0043b9 — dense violet gel spheres, macro',
    durationInFrames: 300,
    background: {
      inner: [0.97, 0.95, 0.99], outer: [0.8, 0.74, 0.93],
      center: [0.42, 0.42], radius: 1.0, falloff: 1.3,
      rampColor: [0.87, 0.82, 0.96], rampAmount: 0.2, rampAngle: 2.4, panel: 0.14,
    },
    glass: {
      ...base.glass, tint: [0.52, 0.36, 0.86], rimColor: [0.95, 0.92, 1.0],
      specColor: [1, 1, 1], refract: 0.065, absorb: 1.8, fresnelStrength: 0.25,
      dispersion: 0.06, specStrength: 0.55, innerAmount: 0.28, innerScale: 4.92,
      innerDensity: 0.60, edgeDark: 0.3, specPower: 34, rimWidth: 0.58, sheen: 0.033, opacity: 0.93,
    },
    field: {
      motion: 'packed', count: 44, minRadius: 1.95, maxRadius: 2.6,
      spreadX: 8.8, spreadY: 5.2, spreadZ: 3.5, driftSpeed: 0.18, rotateSpeed: 0.09,
      farRatio: 0.3, nearRatio: 0.05, seed: 9099,
    },
    camera: { ...base.camera, fov: 36, frameHeight: 10, pushIn: 0.35 },
    grade: { ...base.grade, farBlur: 4.0, bloom: 0.24, vignette: 0.12, saturation: 1.1, contrast: 1.03 },
  },
  {
    id: 'v10-rose-quartz',
    name: 'Rose Quartz',
    reference: '97628445 — pink bubbles floating under shallow focus',
    durationInFrames: 300,
    background: {
      inner: [0.94, 0.94, 0.95], outer: [0.86, 0.86, 0.88],
      center: [0.5, 0.5], radius: 0.95, falloff: 1.5,
      rampColor: [0.99, 0.96, 0.97], rampAmount: 0.16, rampAngle: 1.57, panel: 0.11,
    },
    glass: {
      ...base.glass, tint: [0.98, 0.62, 0.7], rimColor: [1.0, 0.95, 0.96],
      specColor: [1, 1, 1], refract: 0.051, absorb: 0.96, fresnelStrength: 0.21,
      specStrength: 0.51, innerAmount: 0.2, innerScale: 4.27, innerDensity: 0.36,
      edgeDark: 0.09,
    sheen: 0.039, specPower: 33, rimWidth: 0.58, opacity: 0.93,
    },
    field: {
      motion: 'float', count: 46, minRadius: 0.3, maxRadius: 1.85,
      spreadX: 8.0, spreadY: 5.0, spreadZ: 7.0, driftSpeed: 0.3, rotateSpeed: 0.07,
      farRatio: 0.4, nearRatio: 0.18, seed: 1100,
    },
    camera: { ...base.camera, fov: 36, frameHeight: 10 },
    grade: { ...base.grade, farBlur: 7.2, nearBlur: 8.0, bloom: 0.28, vignette: 0.08, saturation: 1.04 },
  },
  {
    id: 'v11-rose-merge',
    name: 'Rose Merge',
    reference: 'a888ac6d — pink glass bubbles gathering on white',
    durationInFrames: 330,
    background: {
      inner: [1.0, 1.0, 1.0], outer: [0.96, 0.94, 0.95],
      center: [0.5, 0.55], radius: 0.95, falloff: 1.6,
      rampColor: [1.0, 0.98, 0.99], rampAmount: 0.14, rampAngle: 1.57, panel: 0.13,
    },
    glass: {
      ...base.glass, tint: [0.99, 0.55, 0.72], rimColor: [1.0, 0.93, 0.95],
      specColor: [1, 1, 1], refract: 0.068, absorb: 0.72, fresnelStrength: 0.29,
      dispersion: 0.07, specStrength: 0.61, innerAmount: 0.18, innerDensity: 0.29,
      edgeDark: 0.23, specPower: 38, rimWidth: 0.55, sheen: 0.033, opacity: 0.93,
    },
    field: {
      motion: 'converge', count: 80, minRadius: 0.62, maxRadius: 1.3,
      spreadX: 3.8, spreadY: 2.5, spreadZ: 2.8, driftSpeed: 0.3, rotateSpeed: 0.12,
      farRatio: 0.2, nearRatio: 0.1, seed: 1111,
    },
    camera: { ...base.camera, fov: 40, frameHeight: 10 },
    grade: { ...base.grade, vignette: 0.06, saturation: 1.06, contrast: 1.03, farBlur: 2.6 },
  },
  {
    id: 'v12-marine-swirl',
    name: 'Marine Swirl',
    reference: 'b0291dca — pale blue bubbles churning in clear liquid',
    durationInFrames: 201,
    background: {
      inner: [0.95, 0.98, 1.0], outer: [0.84, 0.91, 0.98],
      center: [0.5, 0.45], radius: 1.0, falloff: 1.4,
      rampColor: [0.9, 0.95, 1.0], rampAmount: 0.18, rampAngle: 1.8, panel: 0.14,
    },
    glass: {
      ...base.glass, tint: [0.62, 0.84, 0.97], rimColor: [0.82, 0.92, 1.0],
      specColor: [1, 1, 1], refract: 0.058, absorb: 1.3, fresnelStrength: 0.27,
      dispersion: 0.06, specStrength: 0.60, innerAmount: 0.2, innerScale: 4.59,
      innerDensity: 0.31, edgeDark: 0.26, specPower: 37, rimWidth: 0.56, sheen: 0.033, opacity: 0.93,
    },
    field: {
      motion: 'swirl', count: 100, minRadius: 0.32, maxRadius: 1.25,
      spreadX: 7.6, spreadY: 4.7, spreadZ: 6.0, driftSpeed: 0.55, rotateSpeed: 0.14,
      farRatio: 0.26, nearRatio: 0.10, seed: 1212,
    },
    camera: { ...base.camera, fov: 38, frameHeight: 10 },
    grade: { ...base.grade, farBlur: 5.6, nearBlur: 6.5, bloom: 0.26, vignette: 0.1, saturation: 1.02 },
  },
  {
    id: 'v13-iridescent-orbs',
    name: 'Iridescent Orbs',
    reference: 'e16ffea3 — soap bubbles with iridescent rims on blue',
    durationInFrames: 450,
    background: {
      inner: [0.93, 0.96, 0.99], outer: [0.24, 0.48, 0.7],
      center: [0.3, 0.62], radius: 1.15, falloff: 1.25,
      rampColor: [0.16, 0.38, 0.62], rampAmount: 0.3, rampAngle: 4.3, panel: 0.16,
    },
    glass: {
      ...base.glass, tint: [0.86, 0.94, 1.0], rimColor: [0.95, 0.99, 1.0],
      specColor: [1, 1, 1], ior: 1.28, refract: 0.075, absorb: 0.48,
      fresnelPower: 3.0, fresnelStrength: 0.25, dispersion: 0.11,
      specPower: 41, specStrength: 0.66, innerAmount: 0.34, innerScale: 5.74,
      innerDensity: 0.60, iridescence: 0.3, edgeDark: 0.28, rimWidth: 0.54, sheen: 0.028, opacity: 0.93,
    },
    field: {
      motion: 'packed', count: 36, minRadius: 1.8, maxRadius: 2.4,
      spreadX: 8.5, spreadY: 5.0, spreadZ: 3.5, driftSpeed: 0.15, rotateSpeed: 0.06,
      farRatio: 0.3, nearRatio: 0.06, seed: 1313,
    },
    camera: { ...base.camera, fov: 36, frameHeight: 10, pushIn: 0.4 },
    grade: { ...base.grade, farBlur: 4.4, bloom: 0.34, bloomThreshold: 0.66, chroma: 0.025, vignette: 0.2, saturation: 1.12, contrast: 1.03 },
  },
  {
    id: 'v14-cellular-pink',
    name: 'Cellular Pink',
    reference: 'e30f1b04 — pink bubble-within-bubble biotech cells',
    durationInFrames: 241,
    background: {
      inner: [1.0, 0.94, 0.95], outer: [0.97, 0.87, 0.89],
      center: [0.5, 0.5], radius: 1.0, falloff: 1.4,
      rampColor: [1.0, 0.91, 0.93], rampAmount: 0.16, rampAngle: 1.9, panel: 0.11,
    },
    glass: {
      ...base.glass, tint: [0.99, 0.6, 0.68], rimColor: [1.0, 0.92, 0.94],
      specColor: [1, 1, 1], refract: 0.048, absorb: 1.05, fresnelPower: 3.2,
      fresnelStrength: 0.31, specStrength: 0.49, innerAmount: 0.12,
      innerScale: 2.46, innerDensity: 0.19, edgeDark: 0.23, specPower: 35, rimWidth: 0.56, sheen: 0.044, opacity: 0.93,
      shellGap: 0.3,
    },
    field: {
      motion: 'cell', count: 30, minRadius: 1.2, maxRadius: 1.8,
      spreadX: 7.5, spreadY: 4.6, spreadZ: 4.5, driftSpeed: 0.24, rotateSpeed: 0.05,
      farRatio: 0.34, nearRatio: 0.12, seed: 1414,
    },
    camera: { ...base.camera, fov: 36, frameHeight: 10 },
    grade: { ...base.grade, farBlur: 5.4, nearBlur: 6.0, bloom: 0.2, vignette: 0.1, saturation: 1.0 },
  },
  {
    id: 'v15-magenta-churn',
    name: 'Magenta Churn',
    reference: 'f8391601 — magenta bubbles swirling on pink',
    durationInFrames: 281,
    background: {
      inner: [1.0, 0.78, 0.82], outer: [0.98, 0.66, 0.73],
      center: [0.5, 0.5], radius: 1.05, falloff: 1.2,
      rampColor: [1.0, 0.72, 0.78], rampAmount: 0.18, rampAngle: 2.0, panel: 0.04,
    },
    glass: {
      ...base.glass, tint: [0.98, 0.3, 0.55], rimColor: [1.0, 0.82, 0.88],
      specColor: [1, 1, 1], refract: 0.061, absorb: 1.44, fresnelStrength: 0.25,
      dispersion: 0.07, specStrength: 0.53, innerAmount: 0.26, innerScale: 3.93,
      innerDensity: 0.46, edgeDark: 0.21, specPower: 35, rimWidth: 0.58, sheen: 0.028, opacity: 0.93,
    },
    field: {
      motion: 'swirl', count: 68, minRadius: 0.6, maxRadius: 1.7,
      spreadX: 8.5, spreadY: 5.2, spreadZ: 5.5, driftSpeed: 0.42, rotateSpeed: 0.13,
      farRatio: 0.34, nearRatio: 0.14, seed: 1515,
    },
    camera: { ...base.camera, fov: 38, frameHeight: 10 },
    grade: { ...base.grade, farBlur: 5.0, nearBlur: 6.0, bloom: 0.28, vignette: 0.12, saturation: 1.14, contrast: 1.02 },
  },
];

export const VERSION_BY_ID = Object.fromEntries(
  VERSIONS.map((v) => [v.id, v]),
) as Record<string, VersionConfig>;
