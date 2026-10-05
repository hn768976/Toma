// GLSL shared by both looks. Everything here is a pure function of its inputs:
// no time, no randomness — the only clock is the uPhase / uFrame uniforms.

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const COMMON_GLSL = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler3D;

#define PI 3.14159265359
#define TAU 6.28318530718

// Seeded 3D value-noise lattice (128^3, half float, REPEAT), generated once on
// the CPU with mulberry32. One trilinear tap + smoothstepped coordinates gives
// C1 value noise for the price of a texture fetch.
uniform sampler3D uNoise;
const float NOISE_N = 128.0;

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uNoise, (i + f + 0.5) / NOISE_N, 0.0).r;
}

const mat3 OCT_ROT = mat3(
   0.00,  0.80,  0.60,
  -0.80,  0.36, -0.48,
  -0.60, -0.48,  0.64);

// fbm with footprint-aware octave fading: an octave whose wavelength is
// smaller than the pixel footprint (in noise units) fades to its mean instead
// of aliasing. This is what keeps the fine streaks from crawling at 720p and
// lets 4K show more detail with the same data.
float fbmLod(vec3 p, int octaves, float footprint) {
  float a = 0.5;
  float s = 0.0;
  float n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float w = clamp(1.6 - footprint * 1.6, 0.0, 1.0);
    if (w <= 0.0) {
      // this and all finer octaves are below the pixel: add their mean
      // analytically and skip the texture fetches.
      float rem = a * (1.0 - pow(0.5, float(octaves - i))) / 0.5;
      s += 0.5 * rem;
      n += rem;
      break;
    }
    s += a * mix(0.5, vnoise(p), w);
    n += a;
    p = OCT_ROT * p * 2.03 + vec3(17.1, 3.7, 9.3);
    footprint *= 2.03;
    a *= 0.5;
  }
  return s / n;
}

// Ridged fbm: thin bright lines where the noise crosses its mean. Octaves
// below the pixel footprint fade to their average (~0.42) instead of aliasing.
float ridgedLod(vec3 p, int octaves, float footprint) {
  float a = 0.5;
  float s = 0.0;
  float n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float w = clamp(1.6 - footprint * 1.6, 0.0, 1.0);
    if (w <= 0.0) {
      float rem = a * (1.0 - pow(0.55, float(octaves - i))) / 0.45;
      s += 0.42 * rem;
      n += rem;
      break;
    }
    float rr = 1.0 - abs(2.0 * vnoise(p) - 1.0);
    s += a * mix(0.42, rr * rr, w);
    n += a;
    p = OCT_ROT * p * 2.03 + vec3(5.3, 11.9, 2.1);
    footprint *= 2.03;
    a *= 0.55;
  }
  return s / n;
}

// Integer hash (PCG-style). Bit-exact on every GPU, unlike sin()-hashes.
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash13u(uvec3 v) {
  return float(pcg(v.x + pcg(v.y + pcg(v.z)))) / 4294967295.0;
}
float hash13i(ivec3 v) { return hash13u(uvec3(v)); }
vec3 hash33i(ivec3 v) {
  uvec3 u = uvec3(v);
  return vec3(hash13u(u), hash13u(u + uvec3(101u, 0u, 0u)), hash13u(u + uvec3(0u, 211u, 0u)));
}

// Fixed per-pixel pattern (interleaved gradient noise). Indexed by pixel only,
// never by frame: used to offset volume samples so stepping becomes a fixed,
// fine, non-moving pattern instead of bands.
float pixelJitter(vec2 fragCoord) {
  return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;
