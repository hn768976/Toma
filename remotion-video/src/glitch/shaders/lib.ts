/**
 * Shared GLSL building blocks for the glitch engine.
 *
 * Everything here is written so a field can be made *exactly* periodic in
 * time. The noise lattice wraps every `period` units on each axis, so
 * translating the sample point by a whole number of periods lands on the
 * identical field. That is what lets an 8s clip cut back to frame 0 with no
 * pop, without the contrast loss a cross-fade loop would cost.
 */

export const GLSL_HASH = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash23(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
`;

export const GLSL_NOISE = /* glsl */ `
// Value noise whose integer lattice wraps every 'period' units. 'period' must
// be integral on every axis or the wrap lands between lattice points.
float latticeHash(vec3 cell, vec3 period, float seed) {
  // GLSL mod() returns a non-negative result for positive divisors, so this
  // stays correct for sample points that walked into negative coordinates.
  return hash13(mod(cell, period) + seed);
}

float tileNoise(vec3 p, vec3 period, float seed) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);

  float n000 = latticeHash(i + vec3(0.0, 0.0, 0.0), period, seed);
  float n100 = latticeHash(i + vec3(1.0, 0.0, 0.0), period, seed);
  float n010 = latticeHash(i + vec3(0.0, 1.0, 0.0), period, seed);
  float n110 = latticeHash(i + vec3(1.0, 1.0, 0.0), period, seed);
  float n001 = latticeHash(i + vec3(0.0, 0.0, 1.0), period, seed);
  float n101 = latticeHash(i + vec3(1.0, 0.0, 1.0), period, seed);
  float n011 = latticeHash(i + vec3(0.0, 1.0, 1.0), period, seed);
  float n111 = latticeHash(i + vec3(1.0, 1.0, 1.0), period, seed);

  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

// Lacunarity is fixed at 2.0 and the period doubles with it, so every octave
// keeps wrapping on the same time boundary as the base octave.
float tileFbm(vec3 p, vec3 period, float seed, int octaves) {
  float amp = 0.5;
  float sum = 0.0;
  float norm = 0.0;
  vec3 pp = p;
  vec3 per = period;
  for (int o = 0; o < 5; o++) {
    if (o >= octaves) break;
    sum += amp * tileNoise(pp, per, seed + float(o) * 19.73);
    norm += amp;
    amp *= 0.5;
    pp *= 2.0;
    per *= 2.0;
  }
  return sum / max(norm, 1e-5);
}
`;

/** Full-screen quad in clip space. Bypasses Pixi's projection on purpose: the
 *  pass chain then has one orientation convention end to end, for render
 *  textures and the canvas alike. */
export const QUAD_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition;
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}
`;
