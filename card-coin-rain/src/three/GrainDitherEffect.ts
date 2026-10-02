import { Effect } from "postprocessing";
import { Uniform } from "three";

/**
 * Runs after tonemapping. Works in display (sRGB) space: adds film grain of
 * `amount` (2% by default) and a +/-1/255 triangular dither, then converts
 * back to linear so the pass's final sRGB encode lands exactly where we put
 * it. Noise is an integer hash of (pixel x, pixel y, frame % 600): no
 * Math.random(), no clock, identical on every render of a given frame.
 */
const fragment = /* glsl */ `
uniform float frameIndex;
uniform float amount;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(frameIndex)));
  vec3 r = vec3(h) * (1.0 / 4294967296.0);
  uvec3 h2 = pcg3d(h ^ uvec3(0x9e3779b9u));
  vec3 r2 = vec3(h2) * (1.0 / 4294967296.0);
  // Luma grain: triangular, peak +/- amount (slightly less in deep shadow).
  float grain = (r.x + r.y - 1.0) * amount;
  // Per-channel TPDF dither, +/- 1/255.
  vec3 dither = (r2 - vec3(r.z, r2.x, r2.y)) * (1.0 / 255.0);
  vec3 s = toSRGB(inputColor.rgb);
  s += grain * (0.35 + 0.65 * smoothstep(0.0, 0.35, s)) + dither;
  outputColor = vec4(toLinear(clamp(s, 0.0, 1.0)), inputColor.a);
}
`;

export class GrainDitherEffect extends Effect {
  constructor(amount = 0.02) {
    super("GrainDitherEffect", fragment, {
      uniforms: new Map<string, Uniform>([
        ["frameIndex", new Uniform(0)],
        ["amount", new Uniform(amount)],
      ]),
    });
  }

  set frameIndex(v: number) {
    this.uniforms.get("frameIndex")!.value = v;
  }
}
