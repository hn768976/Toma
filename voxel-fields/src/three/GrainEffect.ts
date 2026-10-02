// Final-pass grain + dither. Applied in sRGB (display) space after tone mapping.
//  - grain: 1.5% monochrome, triangular distribution
//  - dither: +-1/255, breaks 8-bit steps in pastel gradients before H.264
// Both come from a fixed integer hash of (pixel, frame % 600). No Math.random().

import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
uniform float uFrame;
uniform float uGrain;

uvec3 vfPcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 vfToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 vfToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  uvec2 px = uvec2(floor(uv * resolution));
  vec3 r = vec3(vfPcg3d(uvec3(px, uint(uFrame)))) / 4294967295.0;
  float grain = (r.x + r.y - 1.0) * uGrain;         // triangular, +-uGrain
  vec3 dither = (vec3(r.z, fract(r.z * 7.31), fract(r.z * 13.17)) - 0.5) * (2.0 / 255.0);
  vec3 c = vfToSrgb(clamp(inputColor.rgb, 0.0, 1.0));
  c = clamp(c + grain + dither, 0.0, 1.0);
  outputColor = vec4(vfToLinear(c), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor() {
    super("VoxelGrainEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uFrame", new Uniform(0)],
        ["uGrain", new Uniform(0.015)],
      ]),
    });
  }
  setFrame(frame: number) {
    this.uniforms.get("uFrame")!.value = frame;
  }
}
