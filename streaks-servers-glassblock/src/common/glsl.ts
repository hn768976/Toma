// Shared GLSL chunks (GLSL ES 3.00 / WebGL2).

/** Integer hash (pcg3d) — exact on every GPU, no sin() based hashing. */
export const HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33u(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967295.0); }
`;

/**
 * Film grain (~2%) + triangular dither (±1/255), applied to the final
 * display-referred sRGB value. A fixed function of integer pixel position and
 * (frame % 600) — never Math.random().
 */
export const GRAIN_DITHER = /* glsl */ `
uniform float uGrainFrame;   // frame % 600
uniform float uGrain;        // ~0.02
vec3 grainDither(vec3 c) {
  uvec3 key = uvec3(uvec2(gl_FragCoord.xy), uint(uGrainFrame));
  vec3 h = hash33u(key);
  vec3 h2 = hash33u(key + uvec3(7919u, 104729u, 613u));
  // Grain: monochrome, triangular, scaled softer in the deep blacks.
  float g = (h.x + h.y - 1.0) * uGrain;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += g * (0.35 + 0.65 * smoothstep(0.0, 0.25, lum));
  // Dither: independent triangular noise per channel, ±1/255.
  c += (h2 - 0.5 + (h.z - 0.5)) * (1.0 / 255.0);
  return c;
}
`;

export const LINEAR_TO_SRGB = /* glsl */ `
vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
