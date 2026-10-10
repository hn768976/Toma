// GLSL snippets shared by every look (GLSL ES 3.00 / WebGL2).

/** Fullscreen-triangle vertex shader. */
export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Integer hashing + dither + grain. Everything is a pure function of the pixel
 * coordinate and (frame % 600): no time source, no Math.random().
 */
export const NOISE_GLSL = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33u(uvec3 v) { return vec3(pcg3d(v) >> 8u) * (1.0 / 16777216.0); }

// Converts a linear colour to sRGB (exact piecewise curve).
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// Final step for every look: film grain (monochrome, triangular PDF, amplitude
// 'grainAmt' of full scale, optionally faded out below 'fadeLum' luminance)
// then a +-1/255 triangular dither. 'srgb' is the display-encoded colour.
vec3 grainAndDither(vec3 srgb, float grainAmt, float fadeLum, int frameMod) {
  uvec3 seed = uvec3(uvec2(gl_FragCoord.xy), uint(frameMod) * 7919u + 17u);
  vec3 h = hash33u(seed);
  float grain = (h.x + h.y - 1.0) * grainAmt;
  vec3 h2 = hash33u(seed ^ uvec3(0x9E3779B9u, 0x85EBCA6Bu, 0xC2B2AE35u));
  vec3 dither = (h2 + hash33u(seed.zxy + 101u) - 1.0) / 255.0;
  if (fadeLum > 0.0) {
    // Fade grain to zero in the deep shadows so black stays clean black; there is
    // also no gradient to dither below half a code value.
    float lum = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
    grain *= smoothstep(0.0, fadeLum, lum);
    dither *= step(0.5 / 255.0, lum);
  }
  return srgb + grain + dither;
}
`;
