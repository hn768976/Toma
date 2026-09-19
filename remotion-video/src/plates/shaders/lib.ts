/**
 * GLSL building blocks shared by all four plates.
 *
 * Everything here is resolution independent and, critically, *periodic*: each
 * plate is driven by a single normalised loop phase `uT` in [0, 1) and every
 * animated quantity is built so that phase 1 lands exactly back on phase 0.
 * That is what makes the rendered plates seamlessly loopable.
 */
export const GLSL_LIB = /* glsl */ `
#define TAU 6.28318530718

// ---------------------------------------------------------------------------
// Hashing (Dave Hoskins style) - cheap, well distributed, no texture lookups.
// ---------------------------------------------------------------------------
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec4 hash24(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// ---------------------------------------------------------------------------
// 3D value noise + fBm. Cheaper than simplex and perfectly adequate once it is
// stacked into fBm and domain-warped, which matters because these frames are
// rasterised on the CPU (SwiftShader) during an offline Remotion render.
// ---------------------------------------------------------------------------
float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  float n = dot(i, vec3(1.0, 57.0, 113.0));
  float n000 = hash11(n +   0.0);
  float n100 = hash11(n +   1.0);
  float n010 = hash11(n +  57.0);
  float n110 = hash11(n +  58.0);
  float n001 = hash11(n + 113.0);
  float n101 = hash11(n + 114.0);
  float n011 = hash11(n + 170.0);
  float n111 = hash11(n + 171.0);

  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

// Rotating each octave breaks up the axis-aligned grid of value noise.
const mat2 FBM_ROT = mat2(0.8018, 0.5977, -0.5977, 0.8018);

float fbm3(vec3 p, int octaves) {
  float amp = 0.5;
  float sum = 0.0;
  float norm = 0.0;
  for (int i = 0; i < octaves; i++) {
    sum += amp * vnoise3(p);
    norm += amp;
    p.xy = FBM_ROT * p.xy * 2.03;
    p.z *= 1.97;
    amp *= 0.5;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Grain + dither.
//
// These plates live almost entirely in the bottom 10% of the value range where
// 8-bit h264 bands badly. A sub-LSB dither plus a whisper of grain removes the
// banding and matches the sensor noise of the live-action references.
// ---------------------------------------------------------------------------
float grain(vec2 fragCoord, float t) {
  return hash21(fragCoord + vec2(t * 311.7, t * 197.3)) - 0.5;
}
`;
