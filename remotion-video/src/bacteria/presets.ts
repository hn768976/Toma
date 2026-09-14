// The eleven looks.
//
// Each preset is a pure description of one reference clip: its length,
// its backdrop, how the bacilli are lit and shaded, and how thickly
// they are stacked through depth. The geometry is always the supplied
// bacillus GLB, untouched -- only the material and the layout change.

export type LayerSpec = {
  /** Instances in this depth slice. */
  count: number;
  /** Near/far world-space Z the slice occupies (camera looks down -Z). */
  depth: [number, number];
  /** Per-instance uniform scale range. */
  scale: [number, number];
  /** Defocus for this slice, in CSS px at 1080p. 0 = in focus. */
  blurPx: number;
  /** Layer opacity, for haze falloff. */
  opacity: number;
  /** Lateral drift speed, world units per second. */
  drift: number;
  /** Tumble speed, radians per second. */
  spin: number;
  /** Horizontal spread of the slice, world units either side of centre. */
  spreadX: number;
  /** Vertical spread of the slice. */
  spreadY: number;
  /**
   * Pulls instances toward the frame centre (0 = even field,
   * 1 = tight cluster). The violet references cluster hard.
   */
  clustering: number;
};

export type MaterialSpec = {
  /** Body colour under the key light. */
  baseColor: string;
  /** Colour in the shadow terminator / interior. */
  deepColor: string;
  /** Fresnel edge colour. */
  rimColor: string;
  rimPower: number;
  rimStrength: number;
  /** Blinn-Phong highlight. */
  specular: number;
  shininess: number;
  /** Object-space noise bump: nodular surface relief. */
  bumpAmount: number;
  bumpScale: number;
  /** High-frequency surface dots (ribosome speckle). */
  speckleAmount: number;
  speckleScale: number;
  speckleColor: string;
  /** Wrap lighting, for the translucent gel look. */
  translucency: number;
  /** Constant self-illumination added on top of the lit result. */
  emissive: number;
  opacity: number;
  /**
   * Bright-field microscopy: the cells absorb light and read darker
   * than the ground instead of catching it (refs 07 and 09).
   */
  darkField: boolean;
  /** Key-light direction in view space. */
  lightDir: [number, number, number];
  lightColor: string;
  ambient: string;
};

export type BackdropSpec = {
  /** Flat ground colour behind everything. */
  base: string;
  /** Radial wash: colour, centre in %, radius in % of the diagonal. */
  glowColor: string;
  glowX: number;
  glowY: number;
  glowRadius: number;
  /** Secondary wash, used for the two-tone gradients. */
  glow2Color: string;
  glow2X: number;
  glow2Y: number;
  glow2Radius: number;
  /** Out-of-focus granular field behind the swarm. */
  bokehColor: string;
  bokehCount: number;
  bokehOpacity: number;
  bokehBlurPx: number;
  bokehSizePx: [number, number];
};

export type GradeSpec = {
  vignette: number;
  vignetteColor: string;
  grain: number;
  /** Additive bloom pulled from the sharp layer. */
  bloom: number;
  bloomBlurPx: number;
  saturate: number;
  contrast: number;
  brightness: number;
};

export type CameraSpec = {
  fov: number;
  /** Start and end Z, for the slow dolly every reference has. */
  z: [number, number];
  /** Lateral pan across the clip, world units. */
  panX: number;
  panY: number;
};

export type Preset = {
  id: string;
  title: string;
  reference: string;
  /** Reference length in seconds, mirrored exactly at 30fps. */
  durationInFrames: number;
  seed: number;
  camera: CameraSpec;
  backdrop: BackdropSpec;
  material: MaterialSpec;
  layers: LayerSpec[];
  grade: GradeSpec;
  /** Free-floating cocci/vesicles some references scatter through frame. */
  spheres: { count: number; color: string; size: [number, number]; opacity: number };
};

const noSpheres = { count: 0, color: "#ffffff", size: [0.1, 0.2] as [number, number], opacity: 0 };

export const PRESETS: Preset[] = [
  {
    id: "Bacteria01ElectricCyan",
    title: "01 — Electric cyan bloom",
    reference: "istockphoto-2233372852",
    durationInFrames: 240, // 8.000s
    seed: 1013,
    camera: { fov: 38, z: [8.0, 6.8], panX: 0.5, panY: -0.25 },
    backdrop: {
      base: "#01040e",
      glowColor: "rgba(24,150,255,0.55)",
      glowX: 46,
      glowY: 44,
      glowRadius: 58,
      glow2Color: "rgba(6,40,120,0.5)",
      glow2X: 78,
      glow2Y: 74,
      glow2Radius: 70,
      bokehColor: "#0d5fbe",
      bokehCount: 90,
      bokehOpacity: 0.3,
      bokehBlurPx: 26,
      bokehSizePx: [30, 120],
    },
    material: {
      baseColor: "#1fa8ff",
      deepColor: "#05254f",
      rimColor: "#8ef0ff",
      rimPower: 1.7,
      rimStrength: 1.35,
      specular: 0.5,
      shininess: 34,
      bumpAmount: 0.32,
      bumpScale: 7.5,
      speckleAmount: 0.85,
      speckleScale: 42,
      speckleColor: "#d5fbff",
      translucency: 0.75,
      emissive: 0.3,
      opacity: 0.96,
      darkField: false,
      lightDir: [-0.35, 0.5, 0.78],
      lightColor: "#bfe6ff",
      ambient: "#0a2f66",
    },
    layers: [
      { count: 39, depth: [-9, -5.5], scale: [0.5, 0.83], blurPx: 16, opacity: 0.5, drift: 0.09, spin: 0.09, spreadX: 5.6, spreadY: 3.3, clustering: 0.1 },
      { count: 30, depth: [-4.8, -2.2], scale: [0.68, 1.08], blurPx: 5, opacity: 0.85, drift: 0.13, spin: 0.13, spreadX: 4.6, spreadY: 2.7, clustering: 0.12 },
      { count: 20, depth: [-1.8, 0.6], scale: [0.83, 1.33], blurPx: 0, opacity: 1, drift: 0.17, spin: 0.17, spreadX: 3.9, spreadY: 2.3, clustering: 0.14 },
    ],
    grade: { vignette: 0.5, vignetteColor: "rgba(0,2,10,0.85)", grain: 0.05, bloom: 0.55, bloomBlurPx: 30, saturate: 1.2, contrast: 1.1, brightness: 1.03 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria02VioletCluster",
    title: "02 — Violet dark cluster",
    reference: "istockphoto-2278455892 (colour pass)",
    durationInFrames: 396, // 13.200s
    seed: 2027,
    camera: { fov: 34, z: [9.1, 8.1], panX: 0.22, panY: 0.14 },
    backdrop: {
      base: "#000000",
      glowColor: "rgba(38,26,92,0.65)",
      glowX: 50,
      glowY: 50,
      glowRadius: 42,
      glow2Color: "rgba(10,8,34,0.8)",
      glow2X: 50,
      glow2Y: 50,
      glow2Radius: 78,
      bokehColor: "#312a7d",
      bokehCount: 260,
      bokehOpacity: 0.42,
      bokehBlurPx: 9,
      bokehSizePx: [14, 58],
    },
    material: {
      baseColor: "#5a5ad2",
      deepColor: "#14103c",
      rimColor: "#9f8cff",
      rimPower: 2.2,
      rimStrength: 0.7,
      specular: 0.3,
      shininess: 26,
      bumpAmount: 0.22,
      bumpScale: 6.5,
      speckleAmount: 0.2,
      speckleScale: 30,
      speckleColor: "#b7b0ff",
      translucency: 0.42,
      emissive: 0.06,
      opacity: 1,
      darkField: false,
      lightDir: [-0.3, 0.62, 0.72],
      lightColor: "#8f8ae0",
      ambient: "#100c30",
    },
    layers: [
      { count: 42, depth: [-8.5, -5], scale: [0.28, 0.47], blurPx: 9, opacity: 0.45, drift: 0.06, spin: 0.07, spreadX: 4.6, spreadY: 2.8, clustering: 0.4 },
      { count: 34, depth: [-4.4, -2], scale: [0.38, 0.57], blurPx: 3, opacity: 0.8, drift: 0.08, spin: 0.1, spreadX: 4.0, spreadY: 2.4, clustering: 0.44 },
      { count: 23, depth: [-1.6, 0.4], scale: [0.45, 0.68], blurPx: 0, opacity: 1, drift: 0.1, spin: 0.12, spreadX: 3.5, spreadY: 2.1, clustering: 0.46 },
    ],
    grade: { vignette: 0.78, vignetteColor: "rgba(0,0,0,0.95)", grain: 0.06, bloom: 0.22, bloomBlurPx: 22, saturate: 1.05, contrast: 1.18, brightness: 0.86 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria03PaleBlueSoftFocus",
    title: "03 — Pale blue soft focus",
    reference: "istockphoto-2278455755",
    durationInFrames: 360, // 12.000s
    seed: 3041,
    camera: { fov: 32, z: [7.4, 6.4], panX: 0.7, panY: 0.3 },
    backdrop: {
      base: "#08163a",
      glowColor: "rgba(28,66,150,0.75)",
      glowX: 42,
      glowY: 40,
      glowRadius: 62,
      glow2Color: "rgba(4,10,34,0.75)",
      glow2X: 82,
      glow2Y: 86,
      glow2Radius: 72,
      bokehColor: "#1b3f8d",
      bokehCount: 240,
      bokehOpacity: 0.4,
      bokehBlurPx: 14,
      bokehSizePx: [20, 86],
    },
    material: {
      baseColor: "#8db0e2",
      deepColor: "#22406f",
      rimColor: "#d5e8ff",
      rimPower: 2.6,
      rimStrength: 0.6,
      specular: 0.24,
      shininess: 22,
      bumpAmount: 0.09,
      bumpScale: 5.5,
      speckleAmount: 0.38,
      speckleScale: 52,
      speckleColor: "#f2f8ff",
      translucency: 0.6,
      emissive: 0.04,
      opacity: 0.97,
      darkField: false,
      lightDir: [-0.42, 0.5, 0.76],
      lightColor: "#cfe0ff",
      ambient: "#1d3a6b",
    },
    layers: [
      { count: 38, depth: [-8.5, -5], scale: [0.4, 0.65], blurPx: 22, opacity: 0.55, drift: 0.07, spin: 0.06, spreadX: 4.4, spreadY: 2.6, clustering: 0.12 },
      { count: 26, depth: [-4.6, -2.4], scale: [0.5, 0.8], blurPx: 8, opacity: 0.85, drift: 0.1, spin: 0.09, spreadX: 3.8, spreadY: 2.3, clustering: 0.14 },
      { count: 14, depth: [-2, 0.3], scale: [0.6, 0.95], blurPx: 1.5, opacity: 1, drift: 0.12, spin: 0.11, spreadX: 3.2, spreadY: 2, clustering: 0.16 },
    ],
    grade: { vignette: 0.58, vignetteColor: "rgba(2,7,24,0.9)", grain: 0.05, bloom: 0.3, bloomBlurPx: 34, saturate: 1.02, contrast: 1.06, brightness: 0.98 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria04SaturatedCobalt",
    title: "04 — Saturated cobalt",
    reference: "istockphoto-2270723498",
    durationInFrames: 240, // 8.000s
    seed: 4093,
    camera: { fov: 40, z: [7.3, 6.2], panX: -0.6, panY: 0.2 },
    backdrop: {
      base: "#041a4e",
      glowColor: "rgba(28,110,235,0.85)",
      glowX: 34,
      glowY: 36,
      glowRadius: 64,
      glow2Color: "rgba(2,8,32,0.72)",
      glow2X: 86,
      glow2Y: 88,
      glow2Radius: 66,
      bokehColor: "#1a5ad2",
      bokehCount: 70,
      bokehOpacity: 0.26,
      bokehBlurPx: 30,
      bokehSizePx: [40, 150],
    },
    material: {
      baseColor: "#2f74e8",
      deepColor: "#071d52",
      rimColor: "#9fd2ff",
      rimPower: 1.9,
      rimStrength: 0.9,
      specular: 0.62,
      shininess: 40,
      bumpAmount: 0.62,
      bumpScale: 9,
      speckleAmount: 0.7,
      speckleScale: 34,
      speckleColor: "#cfe9ff",
      translucency: 0.4,
      emissive: 0.08,
      opacity: 1,
      darkField: false,
      lightDir: [-0.44, 0.56, 0.7],
      lightColor: "#dcecff",
      ambient: "#0d3a86",
    },
    layers: [
      { count: 25, depth: [-8, -4.6], scale: [0.42, 0.72], blurPx: 15, opacity: 0.55, drift: 0.1, spin: 0.11, spreadX: 4.8, spreadY: 2.9, clustering: 0.08 },
      { count: 18, depth: [-4, -1.8], scale: [0.6, 0.93], blurPx: 4, opacity: 0.9, drift: 0.13, spin: 0.14, spreadX: 4, spreadY: 2.4, clustering: 0.1 },
      { count: 13, depth: [-1.4, 0.8], scale: [0.78, 1.26], blurPx: 0, opacity: 1, drift: 0.16, spin: 0.18, spreadX: 3.4, spreadY: 2.1, clustering: 0.12 },
    ],
    grade: { vignette: 0.44, vignetteColor: "rgba(1,5,22,0.8)", grain: 0.04, bloom: 0.34, bloomBlurPx: 26, saturate: 1.24, contrast: 1.08, brightness: 1.02 },
    spheres: { count: 16, color: "#2a6ee0", size: [0.09, 0.22], opacity: 0.9 },
  },
  {
    id: "Bacteria05IndigoDrift",
    title: "05 — Indigo drift",
    reference: "istockphoto-2278455892 (second read)",
    durationInFrames: 396, // 13.200s
    // A different seed from 02 so the two share a source clip without
    // sharing a layout.
    seed: 5087,
    camera: { fov: 36, z: [8.4, 7.0], panX: -0.45, panY: -0.3 },
    backdrop: {
      base: "#050718",
      glowColor: "rgba(52,64,190,0.6)",
      glowX: 44,
      glowY: 42,
      glowRadius: 58,
      glow2Color: "rgba(6,6,28,0.85)",
      glow2X: 84,
      glow2Y: 90,
      glow2Radius: 72,
      bokehColor: "#2f3aa0",
      bokehCount: 200,
      bokehOpacity: 0.36,
      bokehBlurPx: 14,
      bokehSizePx: [18, 78],
    },
    material: {
      baseColor: "#6f7bf0",
      deepColor: "#161c5e",
      rimColor: "#b9c6ff",
      rimPower: 2.1,
      rimStrength: 0.95,
      specular: 0.46,
      shininess: 34,
      bumpAmount: 0.3,
      bumpScale: 7,
      speckleAmount: 0.5,
      speckleScale: 34,
      speckleColor: "#e2e8ff",
      translucency: 0.6,
      emissive: 0.16,
      opacity: 0.97,
      darkField: false,
      lightDir: [-0.36, 0.56, 0.75],
      lightColor: "#ccd6ff",
      ambient: "#1b2470",
    },
    // Where 02 holds its cells in a tight knot, this one lets them
    // spread across the frame and drift through it.
    layers: [
      { count: 34, depth: [-9, -5.2], scale: [0.4, 0.72], blurPx: 15, opacity: 0.5, drift: 0.1, spin: 0.1, spreadX: 5.6, spreadY: 3.3, clustering: 0.09 },
      { count: 24, depth: [-4.8, -2.2], scale: [0.55, 0.95], blurPx: 5, opacity: 0.85, drift: 0.13, spin: 0.13, spreadX: 4.8, spreadY: 2.9, clustering: 0.1 },
      { count: 15, depth: [-1.8, 0.7], scale: [0.7, 1.3], blurPx: 0, opacity: 1, drift: 0.16, spin: 0.16, spreadX: 4.0, spreadY: 2.4, clustering: 0.12 },
    ],
    grade: { vignette: 0.6, vignetteColor: "rgba(1,2,12,0.9)", grain: 0.05, bloom: 0.42, bloomBlurPx: 30, saturate: 1.14, contrast: 1.08, brightness: 1.0 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria06MagentaBloom",
    title: "06 — Magenta bloom",
    reference: "istockphoto-2279714697",
    durationInFrames: 360, // 12.000s
    seed: 6089,
    camera: { fov: 36, z: [7.0, 6.0], panX: 0.55, panY: -0.3 },
    backdrop: {
      base: "#2a0b4a",
      glowColor: "rgba(150,44,196,0.7)",
      glowX: 44,
      glowY: 42,
      glowRadius: 62,
      glow2Color: "rgba(24,4,44,0.8)",
      glow2X: 84,
      glow2Y: 84,
      glow2Radius: 70,
      bokehColor: "#7a2bb0",
      bokehCount: 150,
      bokehOpacity: 0.36,
      bokehBlurPx: 20,
      bokehSizePx: [24, 110],
    },
    material: {
      baseColor: "#c257e0",
      deepColor: "#4a1070",
      rimColor: "#ffc9ff",
      rimPower: 2,
      rimStrength: 0.95,
      specular: 0.42,
      shininess: 30,
      bumpAmount: 0.55,
      bumpScale: 8.5,
      speckleAmount: 0.72,
      speckleScale: 38,
      speckleColor: "#ffe6ff",
      translucency: 0.6,
      emissive: 0.12,
      opacity: 0.98,
      darkField: false,
      lightDir: [-0.36, 0.54, 0.76],
      lightColor: "#ffd9ff",
      ambient: "#4c1274",
    },
    layers: [
      { count: 31, depth: [-8.2, -4.8], scale: [0.43, 0.72], blurPx: 20, opacity: 0.5, drift: 0.08, spin: 0.09, spreadX: 4.6, spreadY: 2.8, clustering: 0.1 },
      { count: 21, depth: [-4.2, -2], scale: [0.58, 0.93], blurPx: 6, opacity: 0.88, drift: 0.11, spin: 0.12, spreadX: 3.9, spreadY: 2.4, clustering: 0.12 },
      { count: 14, depth: [-1.6, 0.5], scale: [0.72, 1.16], blurPx: 0, opacity: 1, drift: 0.14, spin: 0.15, spreadX: 3.3, spreadY: 2, clustering: 0.14 },
    ],
    grade: { vignette: 0.56, vignetteColor: "rgba(14,2,26,0.88)", grain: 0.05, bloom: 0.3, bloomBlurPx: 30, saturate: 1.06, contrast: 1.08, brightness: 0.93 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria07GoldenField",
    title: "07 — Golden fluid field",
    reference: "bacteria-cells-floating-in-a-golden-fluid",
    durationInFrames: 841, // 28.035s
    seed: 7079,
    camera: { fov: 42, z: [6.2, 5.0], panX: 0.9, panY: 0.5 },
    backdrop: {
      base: "#8a4a06",
      glowColor: "rgba(255,186,62,0.92)",
      glowX: 50,
      glowY: 46,
      glowRadius: 60,
      glow2Color: "rgba(96,38,2,0.75)",
      glow2X: 14,
      glow2Y: 90,
      glow2Radius: 74,
      bokehColor: "#c97a12",
      bokehCount: 120,
      bokehOpacity: 0.3,
      bokehBlurPx: 28,
      bokehSizePx: [40, 170],
    },
    material: {
      baseColor: "#5c3104",
      deepColor: "#190b01",
      rimColor: "#ffd58a",
      rimPower: 2.4,
      rimStrength: 0.5,
      specular: 0.3,
      shininess: 24,
      bumpAmount: 0.4,
      bumpScale: 8,
      speckleAmount: 0.4,
      speckleScale: 40,
      speckleColor: "#3a1e02",
      translucency: 0.3,
      emissive: 0,
      opacity: 0.97,
      darkField: true,
      lightDir: [-0.3, 0.55, 0.78],
      lightColor: "#ffe0a8",
      ambient: "#5c3204",
    },
    layers: [
      { count: 54, depth: [-9.5, -5.5], scale: [0.32, 0.65], blurPx: 11, opacity: 0.62, drift: 0.13, spin: 0.16, spreadX: 6.2, spreadY: 3.7, clustering: 0.06 },
      { count: 36, depth: [-5, -2.4], scale: [0.47, 0.89], blurPx: 3.5, opacity: 0.9, drift: 0.17, spin: 0.2, spreadX: 5.2, spreadY: 3.1, clustering: 0.07 },
      { count: 20, depth: [-2, 0.9], scale: [0.63, 1.42], blurPx: 0, opacity: 1, drift: 0.22, spin: 0.24, spreadX: 4.4, spreadY: 2.7, clustering: 0.08 },
    ],
    grade: { vignette: 0.46, vignetteColor: "rgba(52,20,0,0.72)", grain: 0.1, bloom: 0.2, bloomBlurPx: 26, saturate: 1.16, contrast: 1.12, brightness: 1.04 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria08LavenderProbiotic",
    title: "08 — Lavender probiotic",
    reference: "lactobacillus-bacteria-probiotic",
    durationInFrames: 251, // 8.366s
    seed: 8117,
    camera: { fov: 40, z: [6.5, 5.6], panX: -0.7, panY: 0.35 },
    backdrop: {
      base: "#9a94f2",
      glowColor: "rgba(205,198,255,0.9)",
      glowX: 40,
      glowY: 34,
      glowRadius: 66,
      glow2Color: "rgba(86,74,196,0.55)",
      glow2X: 88,
      glow2Y: 90,
      glow2Radius: 68,
      bokehColor: "#c3bdff",
      bokehCount: 60,
      bokehOpacity: 0.3,
      bokehBlurPx: 34,
      bokehSizePx: [50, 190],
    },
    material: {
      baseColor: "#6f62c8",
      deepColor: "#39308a",
      rimColor: "#ffffff",
      rimPower: 2.2,
      rimStrength: 0.85,
      specular: 0.55,
      shininess: 36,
      bumpAmount: 0.5,
      bumpScale: 8,
      speckleAmount: 0.55,
      speckleScale: 36,
      speckleColor: "#efecff",
      translucency: 0.55,
      emissive: 0.02,
      opacity: 1,
      darkField: false,
      lightDir: [-0.38, 0.6, 0.7],
      lightColor: "#ffffff",
      ambient: "#8f88e0",
    },
    layers: [
      { count: 34, depth: [-8.4, -4.8], scale: [0.41, 0.7], blurPx: 17, opacity: 0.6, drift: 0.11, spin: 0.12, spreadX: 5, spreadY: 3, clustering: 0.08 },
      { count: 24, depth: [-4.2, -2], scale: [0.55, 0.9], blurPx: 5, opacity: 0.9, drift: 0.14, spin: 0.15, spreadX: 4.3, spreadY: 2.6, clustering: 0.1 },
      { count: 15, depth: [-1.6, 0.7], scale: [0.7, 1.13], blurPx: 0, opacity: 1, drift: 0.17, spin: 0.18, spreadX: 3.6, spreadY: 2.2, clustering: 0.12 },
    ],
    grade: { vignette: 0.3, vignetteColor: "rgba(58,48,140,0.5)", grain: 0.04, bloom: 0.3, bloomBlurPx: 28, saturate: 1.1, contrast: 1.04, brightness: 1.03 },
    spheres: { count: 12, color: "#8d84e2", size: [0.06, 0.15], opacity: 0.8 },
  },
  {
    id: "Bacteria09BrightfieldGrey",
    title: "09 — Bright-field grey",
    reference: "microscopic-view-of-infectious-bacteria-cells",
    durationInFrames: 901, // 30.030s
    seed: 9133,
    camera: { fov: 34, z: [7.0, 6.6], panX: 1.1, panY: 0.6 },
    backdrop: {
      base: "#b3bcb0",
      glowColor: "rgba(206,212,202,0.85)",
      glowX: 48,
      glowY: 44,
      glowRadius: 70,
      glow2Color: "rgba(126,136,124,0.4)",
      glow2X: 88,
      glow2Y: 92,
      glow2Radius: 72,
      bokehColor: "#96a094",
      bokehCount: 220,
      bokehOpacity: 0.16,
      bokehBlurPx: 8,
      bokehSizePx: [8, 34],
    },
    material: {
      baseColor: "#69745d",
      deepColor: "#3c4636",
      rimColor: "#cdd4c8",
      rimPower: 3,
      rimStrength: 0.32,
      specular: 0.12,
      shininess: 16,
      bumpAmount: 0.18,
      bumpScale: 6,
      speckleAmount: 0.16,
      speckleScale: 28,
      speckleColor: "#5c664f",
      translucency: 0.42,
      emissive: 0,
      opacity: 0.93,
      darkField: true,
      lightDir: [-0.2, 0.45, 0.87],
      lightColor: "#e6ebe2",
      ambient: "#848d80",
    },
    layers: [
      { count: 46, depth: [-9, -5.2], scale: [0.34, 0.6], blurPx: 6, opacity: 0.55, drift: 0.05, spin: 0.05, spreadX: 6, spreadY: 3.6, clustering: 0.04 },
      { count: 32, depth: [-4.8, -2.4], scale: [0.46, 0.78], blurPx: 2.5, opacity: 0.8, drift: 0.07, spin: 0.06, spreadX: 5.4, spreadY: 3.2, clustering: 0.05 },
      { count: 24, depth: [-2, 0.4], scale: [0.55, 0.95], blurPx: 0.8, opacity: 0.95, drift: 0.09, spin: 0.08, spreadX: 4.8, spreadY: 2.9, clustering: 0.06 },
    ],
    grade: { vignette: 0.3, vignetteColor: "rgba(88,96,86,0.5)", grain: 0.14, bloom: 0.06, bloomBlurPx: 18, saturate: 0.8, contrast: 1.12, brightness: 0.97 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria10CrimsonSalmonella",
    title: "10 — Crimson salmonella",
    reference: "microscopic-salmonella-bacteria",
    durationInFrames: 469, // 15.625s
    seed: 10151,
    camera: { fov: 44, z: [5.9, 4.8], panX: -0.5, panY: -0.4 },
    backdrop: {
      base: "#0e0410",
      glowColor: "rgba(104,38,132,0.62)",
      glowX: 26,
      glowY: 20,
      glowRadius: 66,
      glow2Color: "rgba(72,4,32,0.85)",
      glow2X: 66,
      glow2Y: 96,
      glow2Radius: 72,
      bokehColor: "#8a0c3c",
      bokehCount: 80,
      bokehOpacity: 0.3,
      bokehBlurPx: 30,
      bokehSizePx: [44, 170],
    },
    material: {
      baseColor: "#f4285e",
      deepColor: "#4d0417",
      rimColor: "#ff96b4",
      rimPower: 1.8,
      rimStrength: 0.58,
      specular: 0.8,
      shininess: 54,
      bumpAmount: 0.15,
      bumpScale: 7,
      speckleAmount: 0.5,
      speckleScale: 30,
      speckleColor: "#ff7a9c",
      translucency: 0.42,
      emissive: 0.11,
      opacity: 1,
      darkField: false,
      lightDir: [-0.4, 0.58, 0.71],
      lightColor: "#ffd2dd",
      ambient: "#4a0418",
    },
    layers: [
      { count: 22, depth: [-8, -4.6], scale: [0.6, 1.0], blurPx: 18, opacity: 0.55, drift: 0.1, spin: 0.1, spreadX: 4.6, spreadY: 2.8, clustering: 0.08 },
      { count: 12, depth: [-4, -1.8], scale: [0.9, 1.45], blurPx: 5, opacity: 0.9, drift: 0.13, spin: 0.13, spreadX: 3.8, spreadY: 2.3, clustering: 0.1 },
      { count: 7, depth: [-1.4, 1.1], scale: [1.3, 2.1], blurPx: 0, opacity: 1, drift: 0.16, spin: 0.16, spreadX: 3.2, spreadY: 1.9, clustering: 0.12 },
    ],
    grade: { vignette: 0.58, vignetteColor: "rgba(8,0,6,0.88)", grain: 0.05, bloom: 0.28, bloomBlurPx: 28, saturate: 1.22, contrast: 1.12, brightness: 0.98 },
    spheres: noSpheres,
  },
  {
    id: "Bacteria11SteelTeal",
    title: "11 — Steel teal swarm",
    reference: "antibiotic-resistant-bacteria",
    durationInFrames: 274, // 9.120s
    seed: 11173,
    camera: { fov: 38, z: [7.4, 6.2], panX: 0.4, panY: 0.5 },
    backdrop: {
      base: "#062a3c",
      glowColor: "rgba(26,124,166,0.75)",
      glowX: 44,
      glowY: 40,
      glowRadius: 72,
      glow2Color: "rgba(1,8,16,0.85)",
      glow2X: 50,
      glow2Y: 98,
      glow2Radius: 70,
      bokehColor: "#11607f",
      bokehCount: 110,
      bokehOpacity: 0.28,
      bokehBlurPx: 26,
      bokehSizePx: [34, 140],
    },
    material: {
      baseColor: "#a9cfe0",
      deepColor: "#2b5c74",
      rimColor: "#eaf8ff",
      rimPower: 2.6,
      rimStrength: 0.42,
      specular: 0.34,
      shininess: 30,
      bumpAmount: 0.06,
      bumpScale: 5,
      speckleAmount: 0.04,
      speckleScale: 26,
      speckleColor: "#ffffff",
      translucency: 0.62,
      emissive: 0.03,
      opacity: 0.97,
      darkField: false,
      lightDir: [-0.32, 0.52, 0.79],
      lightColor: "#dff2ff",
      ambient: "#14495f",
    },
    layers: [
      { count: 74, depth: [-9.5, -5.4], scale: [0.21, 0.4], blurPx: 9, opacity: 0.6, drift: 0.12, spin: 0.14, spreadX: 6.2, spreadY: 3.7, clustering: 0.05 },
      { count: 44, depth: [-5, -2.4], scale: [0.24, 0.44], blurPx: 3, opacity: 0.85, drift: 0.15, spin: 0.17, spreadX: 5.4, spreadY: 3.2, clustering: 0.06 },
      { count: 22, depth: [-2, 1.4], scale: [0.3, 0.86], blurPx: 0, opacity: 1, drift: 0.19, spin: 0.2, spreadX: 4.6, spreadY: 2.8, clustering: 0.07 },
    ],
    grade: { vignette: 0.5, vignetteColor: "rgba(0,8,16,0.85)", grain: 0.05, bloom: 0.15, bloomBlurPx: 30, saturate: 1.04, contrast: 1.05, brightness: 1.0 },
    spheres: { count: 10, color: "#9cc4d8", size: [0.05, 0.13], opacity: 0.8 },
  },
];

export const getPreset = (id: string): Preset => {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) {
    throw new Error(`Unknown bacteria preset: ${id}`);
  }
  return found;
};
