import {
  Application,
  Container,
  Filter,
  GlProgram,
  RenderTexture,
  Sprite,
  Texture,
} from "pixi.js";
import {
  BLUR_FRAG,
  GRADE_FRAG,
  NEBULA_FRAG,
  QUAD_VERT,
  THRESHOLD_FRAG,
} from "./glsl";

const makeFilter = (
  fragment: string,
  uniforms: Record<string, { value: unknown; type: string }>,
  padding = 0,
) =>
  new Filter({
    glProgram: GlProgram.from({ vertex: QUAD_VERT, fragment }),
    resources: { plateUniforms: uniforms },
    padding,
    clipToViewport: true,
  });

/** Convenience accessor for a filter built by `makeFilter`. */
const uniformsOf = (filter: Filter) =>
  (filter.resources.plateUniforms as { uniforms: Record<string, never> })
    .uniforms as unknown as Record<string, number | Float32Array>;

const rgb = (hex: number) =>
  new Float32Array([
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ]);

export type NebulaOptions = {
  colorSky: number;
  colorDeep: number;
  colorMid: number;
  colorHot: number;
  /** Distance the cloud field travels over one full loop, in noise units. */
  drift: [number, number];
  scale: number;
  contrast: number;
  gain: number;
  bandCenter: number;
  bandWidth: number;
  bandTilt: number;
  vignette: number;
  detail: number;
  /**
   * Optional horizontal weighting: the layer is at full strength at `sideStart`
   * and gone by `sideEnd`, both in 0..1 screen space. Defaults to no ramp.
   */
  sideStart?: number;
  sideEnd?: number;
};

/**
 * Full-screen volumetric cloud layer. Implemented as a white quad carrying a
 * custom fragment shader, which keeps it a single draw call at any resolution.
 */
export const createNebulaLayer = (
  width: number,
  height: number,
  options: NebulaOptions,
) => {
  const filter = makeFilter(NEBULA_FRAG, {
    uProgress: { value: 0, type: "f32" },
    uAspect: { value: new Float32Array([width / height, 1]), type: "vec2<f32>" },
    uColorSky: { value: rgb(options.colorSky), type: "vec3<f32>" },
    uColorDeep: { value: rgb(options.colorDeep), type: "vec3<f32>" },
    uColorMid: { value: rgb(options.colorMid), type: "vec3<f32>" },
    uColorHot: { value: rgb(options.colorHot), type: "vec3<f32>" },
    uDrift: { value: new Float32Array(options.drift), type: "vec2<f32>" },
    uScale: { value: options.scale, type: "f32" },
    uContrast: { value: options.contrast, type: "f32" },
    uGain: { value: options.gain, type: "f32" },
    uBandCenter: { value: options.bandCenter, type: "f32" },
    uBandWidth: { value: options.bandWidth, type: "f32" },
    uBandTilt: { value: options.bandTilt, type: "f32" },
    uVignette: { value: options.vignette, type: "f32" },
    uDetail: { value: options.detail, type: "f32" },
    uSideStart: { value: options.sideStart ?? -1, type: "f32" },
    uSideEnd: { value: options.sideEnd ?? 2, type: "f32" },
  });

  const quad = new Sprite(Texture.WHITE);
  quad.width = width;
  quad.height = height;
  quad.filters = [filter];

  const uniforms = uniformsOf(filter);
  return {
    view: quad,
    setProgress: (u: number) => {
      uniforms.uProgress = u;
    },
  };
};

/**
 * Threshold + two-axis Gaussian bloom, run on half-resolution render targets
 * and composited back additively. This is what gives the gold plates their
 * blown-out highlights instead of flat dots.
 */
export const createBloom = (
  app: Application,
  source: Container,
  {
    width,
    height,
    resolution = 0.5,
    radius = 18,
    threshold = 0.22,
    softness = 0.25,
    strength = 1,
  }: {
    width: number;
    height: number;
    resolution?: number;
    radius?: number;
    threshold?: number;
    softness?: number;
    strength?: number;
  },
) => {
  const w = Math.max(2, Math.round(width * resolution));
  const h = Math.max(2, Math.round(height * resolution));

  const rtRaw = RenderTexture.create({ width: w, height: h, antialias: false });
  const rtH = RenderTexture.create({ width: w, height: h, antialias: false });
  const rtV = RenderTexture.create({ width: w, height: h, antialias: false });

  // Taps are spread over the full radius, so `radius` is the real reach of the
  // halo in composition pixels rather than a per-tap step.
  const tap = (radius * resolution) / 4;

  const thresholdFilter = makeFilter(THRESHOLD_FRAG, {
    uThreshold: { value: threshold, type: "f32" },
    uSoftness: { value: softness, type: "f32" },
  });
  const blurH = makeFilter(BLUR_FRAG, {
    uStep: { value: new Float32Array([tap / w, 0]), type: "vec2<f32>" },
  });
  const blurV = makeFilter(BLUR_FRAG, {
    uStep: { value: new Float32Array([0, tap / h]), type: "vec2<f32>" },
  });

  // Pass 1 thresholds the raw glow and blurs it horizontally, pass 2 blurs the
  // result vertically. Both run at `resolution` of the output size.
  const passOne = new Sprite(rtRaw);
  passOne.filters = [thresholdFilter, blurH];
  const passTwo = new Sprite(rtH);
  passTwo.filters = [blurV];

  // The sprite that actually lands on the visible stage.
  const view = new Sprite(rtV);
  view.width = width;
  view.height = height;
  view.blendMode = "add";
  view.alpha = strength;

  return {
    view,
    /** Call once per frame, before the main stage render. */
    update: () => {
      app.renderer.render({ container: source, target: rtRaw, clear: true });
      app.renderer.render({ container: passOne, target: rtH, clear: true });
      app.renderer.render({ container: passTwo, target: rtV, clear: true });
    },
    destroy: () => {
      passOne.destroy();
      passTwo.destroy();
      view.destroy();
      rtRaw.destroy(true);
      rtH.destroy(true);
      rtV.destroy(true);
    },
  };
};

export type GradeOptions = {
  grain?: number;
  dither?: number;
  saturation?: number;
  lift?: number;
};

/** Final film-grade pass applied to the whole stage. */
export const createGrade = (
  width: number,
  height: number,
  { grain = 0.012, dither = 1, saturation = 1, lift = 0 }: GradeOptions = {},
) => {
  const filter = makeFilter(GRADE_FRAG, {
    uResolution: { value: new Float32Array([width, height]), type: "vec2<f32>" },
    uSeed: { value: 0, type: "f32" },
    uGrain: { value: grain, type: "f32" },
    uDither: { value: dither, type: "f32" },
    uSaturation: { value: saturation, type: "f32" },
    uLift: { value: lift, type: "f32" },
  });
  const uniforms = uniformsOf(filter);
  return {
    filter,
    setFrame: (frame: number) => {
      uniforms.uSeed = (frame % 997) * 1.618;
    },
  };
};
