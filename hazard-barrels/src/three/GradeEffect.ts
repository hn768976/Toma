import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector3 } from "three";

/**
 * Final pass: exposure -> tone mapping -> colour grade -> vignette ->
 * film grain -> +-1/255 dither.
 *
 * - Input is linear HDR (half-float buffers upstream, so nothing bands).
 * - Grain is a fixed hash of (pixel, frame): no clock, no Math.random().
 * - Grain fades out in pure black; dither is skipped on exact black and exact
 *   white so flat backgrounds keep their exact value.
 * - Output is handed back in linear; the effect pass does the sRGB encode.
 */
const fragment = /* glsl */ `
uniform float uExposure;
uniform vec3 uWhiteBalance;
uniform float uToneMap;
uniform float uContrast;
uniform float uPivot;
uniform float uSaturation;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uVignette;
uniform float uVignetteStart;
uniform float uGrain;
uniform float uDither;
uniform float uFrame;

uint gradeHashU(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float gradeHash(uvec3 v) { return float(gradeHashU(v) >> 8u) / 16777216.0; }

vec3 gradeRRTODT(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 gradeACES(vec3 color) {
  const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  color = inM * (color / 0.6);
  color = gradeRRTODT(color);
  return clamp(outM * color, 0.0, 1.0);
}
vec3 gradeToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 gradeToLinear(vec3 c) {
  return mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, vec3(0.0)) * uExposure * uWhiteBalance;
  c = uToneMap > 0.5 ? gradeACES(c) : clamp(c, 0.0, 1.0);
  vec3 s = gradeToSRGB(c);

  // grade in display space, the way it would be done on the finished picture
  s = (s - uPivot) * uContrast + uPivot;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(vec3(l), s, uSaturation);
  float t = clamp(l, 0.0, 1.0);
  s += uShadowTint * (1.0 - t) * (1.0 - t) + uHighlightTint * t * t;
  s = uGain * (s + uLift * (1.0 - s));
  s = pow(max(s, vec3(0.0)), 1.0 / uGamma);

  // vignette
  vec2 q = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float d = length(q) / length(vec2(resolution.x / resolution.y, 1.0) * 0.5);
  s *= 1.0 - uVignette * smoothstep(uVignetteStart, 1.0, d);
  s = clamp(s, 0.0, 1.0);

  // film grain: fixed hash of pixel and frame, faded out in black and clipped white
  uvec3 p = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(uFrame));
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float g = gradeHash(p) + gradeHash(p + uvec3(17u, 59u, 113u)) - 1.0;
  s += g * uGrain * smoothstep(0.0, 0.10, lum) * (1.0 - smoothstep(0.92, 1.0, lum));

  // +-1/255 triangular dither against banding; never on pure black / pure white
  float mx = max(s.r, max(s.g, s.b));
  float mn = min(s.r, min(s.g, s.b));
  float pure = step(mx, 0.0) + step(1.0, mn);
  float dth = gradeHash(p + uvec3(101u, 7u, 31u)) + gradeHash(p + uvec3(3u, 211u, 71u)) - 1.0;
  s += dth * (uDither / 255.0) * (1.0 - clamp(pure, 0.0, 1.0));

  outputColor = vec4(gradeToLinear(clamp(s, 0.0, 1.0)), 1.0);
}
`;

export type GradeSettings = {
  exposure: number;
  whiteBalance: [number, number, number];
  toneMapping: "aces" | "none";
  contrast: number;
  pivot: number;
  saturation: number;
  lift: [number, number, number];
  gamma: [number, number, number];
  gain: [number, number, number];
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  vignette: number;
  vignetteStart: number;
  /** grain amplitude in display units (1 = full range) at 1080p */
  grain: number;
  /** dither amplitude in 8-bit steps */
  dither: number;
};

export class GradeEffect extends Effect {
  constructor(g: GradeSettings) {
    super("GradeEffect", fragment, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ["uExposure", new Uniform(g.exposure)],
        ["uWhiteBalance", new Uniform(new Vector3(...g.whiteBalance))],
        ["uToneMap", new Uniform(g.toneMapping === "aces" ? 1 : 0)],
        ["uContrast", new Uniform(g.contrast)],
        ["uPivot", new Uniform(g.pivot)],
        ["uSaturation", new Uniform(g.saturation)],
        ["uLift", new Uniform(new Vector3(...g.lift))],
        ["uGamma", new Uniform(new Vector3(...g.gamma))],
        ["uGain", new Uniform(new Vector3(...g.gain))],
        ["uShadowTint", new Uniform(new Vector3(...g.shadowTint))],
        ["uHighlightTint", new Uniform(new Vector3(...g.highlightTint))],
        ["uVignette", new Uniform(g.vignette)],
        ["uVignetteStart", new Uniform(g.vignetteStart)],
        ["uGrain", new Uniform(g.grain)],
        ["uDither", new Uniform(g.dither)],
        ["uFrame", new Uniform(0)],
      ]),
    });
  }

  setFrame(frame: number) {
    this.uniforms.get("uFrame")!.value = frame;
  }
}
