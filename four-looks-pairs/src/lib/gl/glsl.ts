/** Shared GLSL ES 3.00 snippets. Integer hashing only: identical on every GPU. */

export const GLSL_HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float hash01(uvec3 v) { return float(pcg3d(v).x & 0x00ffffffu) / 16777216.0; }
// Triangular-distributed noise in [-1, 1] from pixel position + frame + salt.
float triNoise(vec2 fragCoord, uint frame, uint salt) {
  uvec2 p = uvec2(fragCoord);
  float a = hash01(uvec3(p, frame * 4u + salt));
  float b = hash01(uvec3(p.yx + 7919u, frame * 4u + salt + 1u));
  return a + b - 1.0;
}
`;

/** Full-screen triangle vertex shader for RawShaderMaterial (GLSL3). */
export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
