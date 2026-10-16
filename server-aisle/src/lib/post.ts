import {
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from "postprocessing";
import {
  Camera,
  HalfFloatType,
  Scene,
  Texture,
  Uniform,
  Vector3,
  WebGLRenderer,
} from "three";
import { makeBlueNoiseTexture } from "./bluenoise";

// Final pass: exposure -> ACES tone map -> grade (display space) -> vignette
// -> grain (faded out below 3% luminance) -> optional white mix -> dither.
// The dither is applied in display (sRGB) space, then converted back to
// linear because the pipeline re-encodes the last pass to sRGB.
const finalFrag = /* glsl */ `
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform vec3 lift;
uniform vec3 gain;
uniform float vignette;
uniform float vignetteSoft;
uniform float grain;
uniform float seed;
uniform float whiteMix;
uniform float ditherAmt;
uniform float toneMap;
uniform sampler2D blueNoise;

vec3 acesFit(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0) * exposure;
  c = toneMap > 0.5 ? acesFit(c) : clamp(c, 0.0, 1.0);
  vec3 s = toSRGB(c);
  // Grade in display space.
  s = (s - 0.5) * contrast + 0.5;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(vec3(l), s, saturation);
  s = s * gain + lift * (1.0 - s);
  // Vignette.
  vec2 q = uv - 0.5;
  q.x *= 1.25;
  float v = smoothstep(0.75, 0.75 - vignetteSoft, length(q) * 1.15);
  s *= mix(1.0, v, vignette);
  s = clamp(s, 0.0, 1.0);
  // Grain from a fixed formula of pixel position and frame (seed).
  vec2 px = floor(gl_FragCoord.xy);
  float g1 = hash12(px + vec2(seed * 13.17, seed * 7.31));
  float g2 = hash12(px.yx + vec2(seed * 3.71 + 19.0, seed * 11.3 + 5.0));
  float g = (g1 + g2 - 1.0);
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s += g * grain * smoothstep(0.03, 0.08, lum);
  s = mix(s, vec3(1.0), whiteMix);
  // Blue-noise dither, +-1/255, animated by a golden-ratio offset per frame.
  float bn = texture2D(blueNoise, px / 64.0).r;
  bn = fract(bn + seed * 0.61803398875);
  s += (bn - 0.5) * (2.0 / 255.0) * ditherAmt;
  s = clamp(s, 0.0, 1.0);
  outputColor = vec4(toLinear(s), 1.0);
}
`;

export type GradeParams = {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  lift?: [number, number, number];
  gain?: [number, number, number];
  vignette?: number;
  vignetteSoft?: number;
  grain?: number;
  toneMap?: boolean;
};

export class FinalEffect extends Effect {
  constructor(blueNoise: Texture, p: GradeParams) {
    super("FinalEffect", finalFrag, {
      uniforms: new Map<string, Uniform>([
        ["exposure", new Uniform(p.exposure ?? 1)],
        ["contrast", new Uniform(p.contrast ?? 1)],
        ["saturation", new Uniform(p.saturation ?? 1)],
        ["lift", new Uniform(new Vector3(...(p.lift ?? [0, 0, 0])))],
        ["gain", new Uniform(new Vector3(...(p.gain ?? [1, 1, 1])))],
        ["vignette", new Uniform(p.vignette ?? 0.4)],
        ["vignetteSoft", new Uniform(p.vignetteSoft ?? 0.55)],
        ["grain", new Uniform(p.grain ?? 0.015)],
        ["seed", new Uniform(0)],
        ["whiteMix", new Uniform(0)],
        ["ditherAmt", new Uniform(1)],
        ["toneMap", new Uniform(p.toneMap === false ? 0 : 1)],
        ["blueNoise", new Uniform(blueNoise)],
      ]),
    });
  }
  set(name: string, value: number) {
    this.uniforms.get(name)!.value = value;
  }
}

export type PipelineOptions = {
  grade: GradeParams;
  bloom?: { threshold: number; smoothing: number; intensity: number; radius: number; levels?: number };
  dof?: { focusDistance: number; focusRange: number; bokehScale: number; resolutionScale?: number };
  multisampling?: number;
};

export type Pipeline = {
  composer: EffectComposer;
  final: FinalEffect;
  bloom: BloomEffect | null;
  dof: DepthOfFieldEffect | null;
  render: () => void;
  dispose: () => void;
};

export const makePipeline = (
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  opts: PipelineOptions,
): Pipeline => {
  const composer = new EffectComposer(gl, {
    frameBufferType: HalfFloatType,
    multisampling: opts.multisampling ?? 4,
    stencilBuffer: false,
  });
  composer.addPass(new RenderPass(scene, camera));
  let dof: DepthOfFieldEffect | null = null;
  if (opts.dof) {
    dof = new DepthOfFieldEffect(camera, {
      focusDistance: opts.dof.focusDistance,
      focusRange: opts.dof.focusRange,
      bokehScale: opts.dof.bokehScale,
      resolutionScale: opts.dof.resolutionScale ?? 0.5,
    });
    composer.addPass(new EffectPass(camera, dof));
  }
  let bloom: BloomEffect | null = null;
  const blueNoise = makeBlueNoiseTexture();
  const final = new FinalEffect(blueNoise, opts.grade);
  if (opts.bloom) {
    bloom = new BloomEffect({
      mipmapBlur: true,
      luminanceThreshold: opts.bloom.threshold,
      luminanceSmoothing: opts.bloom.smoothing,
      intensity: opts.bloom.intensity,
      radius: opts.bloom.radius,
      levels: opts.bloom.levels ?? 8,
    });
    composer.addPass(new EffectPass(camera, bloom, final));
  } else {
    composer.addPass(new EffectPass(camera, final));
  }
  return {
    composer,
    final,
    bloom,
    dof,
    render: () => composer.render(0),
    dispose: () => {
      composer.dispose();
      blueNoise.dispose();
    },
  };
};
