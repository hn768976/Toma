/** Shared GLSL snippets (GLSL ES 3.00; materials use glslVersion GLSL3). */

/** GLSL3 fragment output; prepend to every custom fragment shader. */
export const FRAG_OUT = /* glsl */ `
layout(location = 0) out highp vec4 fragOut;
#define gl_FragColor fragOut
`;

export const GLSL_HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3u(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967295.0); }
float hash1f(vec2 p, float s) {
  return hash3u(uvec3(ivec3(int(floor(p.x)), int(floor(p.y)), int(s)) + 65536)).x;
}
`;

export const GLSL_COLOR = /* glsl */ `
vec3 lin2srgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Stephen Hill's ACES fit.
vec3 acesFitted(vec3 c) {
  const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 o = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = i * c;
  vec3 a = c * (c + 0.0245786) - 0.000090537;
  vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081;
  return clamp(o * (a / b), 0.0, 1.0);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
