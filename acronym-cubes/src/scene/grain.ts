// Film grain + dither, both computed from a fixed hash of (pixel, frame).
// Never Math.random(): the same frame always gets the same grain.

import { Effect } from "postprocessing";
import { type Material, Uniform } from "three";

const HASH = /* glsl */ `
uvec3 acHash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 acRand(vec2 fragCoord, float frame, uint salt) {
  uvec3 h = acHash(uvec3(uvec2(fragCoord), uint(frame) * 4u + salt));
  return vec3(h >> 8u) * (1.0 / 16777216.0);
}
`;

const GRAIN_FRAG = /* glsl */ `
uniform float uFrame;
uniform float uAmount;
${HASH}
vec3 acToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 acToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 r = acRand(gl_FragCoord.xy, uFrame, 1u);
  // Sum of three uniforms: smooth, roughly gaussian, sd = 1.
  float n = (r.x + r.y + r.z - 1.5) * 2.0;
  vec3 c = acToSRGB(clamp(inputColor.rgb, 0.0, 1.0));
  c += n * uAmount;
  outputColor = vec4(acToLinear(clamp(c, 0.0, 1.0)), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor(amount = 0.0175) {
    super("GrainEffect", GRAIN_FRAG, {
      uniforms: new Map<string, Uniform>([
        ["uFrame", new Uniform(0)],
        ["uAmount", new Uniform(amount)],
      ]),
    });
  }
  set frame(f: number) {
    this.uniforms.get("uFrame")!.value = f;
  }
}

// +-1/255 noise added in the material shader (paper and cubes), so the soft
// light gradients never quantise into steps.
export const addShaderDither = (material: Material, frameUniform: { value: number }) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDitherFrame = frameUniform;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uDitherFrame;\n${HASH}`)
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        gl_FragColor.rgb += (acRand(gl_FragCoord.xy, uDitherFrame, 2u).x - 0.5) * (2.0 / 255.0);`,
      );
  };
  material.customProgramCacheKey = () => "ac-dither";
};
