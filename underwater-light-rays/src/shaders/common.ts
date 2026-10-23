// Shared GLSL helpers: hashing, value noise, fbm and dithering.
export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Smooth 2D value noise in [0, 1].
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * noise2(p);
    norm += amp;
    p = rot * p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return sum / norm;
}

vec2 rotate2(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Fine animated film grain (about +-2.5 LSB at 4K, ~+-1 LSB after a 1080p
// downscale). Breaks up 8-bit banding in dark gradients.
vec3 grain(vec2 fragCoord, float frame) {
  vec2 o = vec2(fract(frame * 0.618034), fract(frame * 0.414214)) * 977.0;
  float r = hash12(fragCoord + o) + hash12(fragCoord + o + 71.3) - 1.0;
  return vec3(r * 2.5 / 255.0);
}

// Triangular-distributed dither of +-1 LSB to prevent banding in 8-bit output.
vec3 dither(vec2 fragCoord) {
  float r = hash12(fragCoord) + hash12(fragCoord + 71.3) - 1.0;
  return vec3(r / 255.0);
}
`;
