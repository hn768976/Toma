import {
  Geometry,
  GlProgram,
  Mesh,
  Shader,
  UniformGroup,
  type TextureSource,
} from "pixi.js";

// Shared vertex shader for every full-screen pass. vUV is (0,0) top-left.
export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

// Common GLSL helpers prepended to every look's fragment shader.
export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
// Integer hash (PCG-ish): bit-exact on every GPU, no sin() tricks.
uint hashu(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}
float hash21(vec2 p) {
  return float(hashu(uvec3(ivec3(floor(p), 17)) ) & 0xffffffu) / 16777216.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash21(i), b = hash21(i + vec2(1, 0)), c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.31; a *= 0.5; }
  return s;
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

export type UniformSpec = Record<string, { value: unknown; type: string; size?: number }>;

/** A full-screen quad (in composition units) running `fragment`. */
export const fullscreenMesh = (
  width: number,
  height: number,
  fragment: string,
  uniforms: UniformSpec,
  textures: Record<string, TextureSource> = {},
) => {
  const geometry = new Geometry({
    attributes: {
      aPosition: [0, 0, width, 0, width, height, 0, height],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const group = new UniformGroup(uniforms as never);
  const glProgram = new GlProgram({
    vertex: FULLSCREEN_VERT,
    fragment,
    preferredFragmentPrecision: "highp",
  });
  const shader = new Shader({ glProgram, resources: { uLook: group, ...textures } });
  const mesh = new Mesh({ geometry, shader });
  return { mesh, u: group.uniforms as Record<string, never> as Record<string, any> };
};
