/**
 * Film grain + dither, applied last, in display (sRGB) space.
 * Pure function of pixel position and the (looped) frame number.
 * The same integer hash is used in the Canvas 2D looks (see lib/grain2d.ts).
 */
export const GRAIN_GLSL = /* glsl */ `
uniform float uFrame;
uniform float uGrain;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame)));
  vec3 r = vec3(h >> 8u) / 16777216.0;            // three uniforms in [0,1)
  float grain = (r.x + r.y - 1.0) * uGrain;        // triangular, luminance only
  float dither = (r.z - 0.5) * (2.0 / 255.0);      // +-1/255
  vec3 s = toSrgb(inputColor.rgb) + grain + dither;
  outputColor = vec4(toLinear(clamp(s, 0.0, 1.0)), inputColor.a);
}
`;
