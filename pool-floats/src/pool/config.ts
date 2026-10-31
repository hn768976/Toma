/**
 * Scene configuration shared by all four compositions.
 * Every value that differs between versions lives in a SceneConfig, so the
 * renderer itself stays identical for V1 and V2.
 */

export type RGB = [number, number, number];

export type FloatKind = "stripes" | "watermelon";

export type CameraKind = "static" | "craneOrbit";

export type Palette = {
  /** Pool floor tint where it is fully lit (sRGB 0-255). */
  floorLit: RGB;
  /** Pool floor tint inside dark caustic cells. */
  floorDark: RGB;
  /** Colour of the floor in the float's shadow. */
  shadow: RGB;
  /** Colour of the caustic light lines. */
  caustic: RGB;
  /** Water absorption tint applied to submerged things. */
  waterTint: RGB;
  /** Sky colour used for reflections and fill light. */
  sky: RGB;
  /** Float colours: stripes use A/B; watermelon uses A=flesh B=rind C=skin. */
  floatA: RGB;
  floatB: RGB;
  floatC: RGB;
  seeds: RGB;
};

export type SceneConfig = {
  kind: FloatKind;
  camera: CameraKind;
  palette: Palette;
};

export const FPS = 30;
export const DURATION_FRAMES = 300; // 10.0 s, identical to both references
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Torus geometry (scene units). */
export const RING_R = 1.0;
export const RING_r = 0.44;
/** Inflatables are slightly squashed: vertical scale of the tube. */
export const RING_FLATTEN = 0.88;
/** Depth of the pool floor below the water surface. */
export const POOL_DEPTH = 2.3;

export const POOL_PALETTE: Omit<Palette, "floatA" | "floatB" | "floatC" | "seeds"> = {
  floorLit: [138, 203, 244],
  floorDark: [62, 160, 226],
  shadow: [0, 118, 204],
  caustic: [236, 248, 255],
  waterTint: [70, 170, 225],
  sky: [205, 230, 255],
};

export const STRIPES_V1: SceneConfig = {
  kind: "stripes",
  camera: "static",
  palette: {
    ...POOL_PALETTE,
    floatA: [246, 44, 74], // red
    floatB: [246, 244, 242], // white
    floatC: [0, 0, 0],
    seeds: [0, 0, 0],
  },
};

/**
 * Composition 1 – Version 2: alternative colour palette.
 * Golden-hour light over a deep turquoise pool, navy / sunflower stripes.
 */
export const STRIPES_V2: SceneConfig = {
  kind: "stripes",
  camera: "static",
  palette: {
    floorLit: [48, 196, 186],
    floorDark: [16, 140, 150],
    shadow: [6, 100, 120],
    caustic: [255, 226, 160],
    waterTint: [20, 130, 140],
    sky: [255, 214, 170],
    floatA: [24, 48, 128], // navy
    floatB: [255, 196, 46], // sunflower
    floatC: [0, 0, 0],
    seeds: [0, 0, 0],
  },
};

export const WATERMELON_V1: SceneConfig = {
  kind: "watermelon",
  camera: "static",
  palette: {
    ...POOL_PALETTE,
    floorLit: [180, 224, 248],
    floorDark: [124, 198, 238],
    shadow: [0, 138, 210],
    floatA: [252, 34, 52], // flesh
    floatB: [222, 236, 44], // rind (yellow-green)
    floatC: [18, 104, 66], // skin (green)
    seeds: [22, 14, 14],
  },
};

/** Composition 2 – Version 2: same look, alternative crane / orbit camera move. */
export const WATERMELON_V2: SceneConfig = {
  ...WATERMELON_V1,
  camera: "craneOrbit",
};
