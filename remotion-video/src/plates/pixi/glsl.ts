// GLSL sources for the custom WebGL passes used by the plates.
//
// Everything here is authored to be *seamlessly loopable*: time enters the
// shaders as `uProgress` in [0, 1) and any noise field is sampled with the
// standard two-sample cross-fade, `mix(fbm(p + A*u), fbm(p + A*(u-1)), u)`,
// which is exactly periodic at u = 0 and u = 1.

/**
 * Same as Pixi's default filter vertex shader, but it also forwards the raw
 * quad coordinate so the fragment stage has a clean 0..1 space across the
 * filter area (vTextureCoord maps into the pooled input texture instead).
 */
export const QUAD_VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vUv;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

void main() {
  gl_Position = filterVertexPosition();
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
  vUv = aPosition;
}
`;

/** Shared noise helpers, prepended to the fragment shaders that need them. */
const NOISE_LIB = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * vnoise(p);
    norm += amp;
    p = ROT * p * 2.02;
    amp *= 0.5;
  }
  return sum / norm;
}

// Perfectly periodic in u over [0, 1].
float loopFbm(vec2 p, vec2 drift, float u, int octaves) {
  float a = fbm(p + drift * u, octaves);
  float b = fbm(p + drift * (u - 1.0), octaves);
  return mix(a, b, u);
}
`;

/**
 * Parametric volumetric-cloud background. One shader drives both the deep-blue
 * dust field and the magenta nebula; the palette and the shaping uniforms are
 * what make them different pieces.
 */
export const NEBULA_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uProgress;
uniform vec2 uAspect;      // (aspect, 1.0)
uniform vec3 uColorDeep;   // darkest cloud colour
uniform vec3 uColorMid;    // body of the cloud
uniform vec3 uColorHot;    // brightest cores
uniform vec3 uColorSky;    // flat backdrop behind the clouds
uniform vec2 uDrift;       // how far the field travels over one loop
uniform float uScale;      // noise frequency
uniform float uContrast;
uniform float uGain;
uniform float uBandCenter; // y of the densest streak, 0..1
uniform float uBandWidth;
uniform float uBandTilt;
uniform float uVignette;
uniform float uDetail;     // strength of the fine high-frequency wisps
// Horizontal ramp, so a layer can be weighted towards one side of frame.
// Full strength at uSideStart, gone by uSideEnd; works in either direction.
uniform float uSideStart;
uniform float uSideEnd;
${NOISE_LIB}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * uAspect * uScale;

  // Warp the sampling position with a second, slower noise field: this is what
  // turns plain fbm into something that reads as smoke rather than static.
  vec2 warp = vec2(
    loopFbm(p * 0.45 + vec2(11.3, 4.1), uDrift * 0.55, uProgress, 3),
    loopFbm(p * 0.45 + vec2(-7.7, 19.4), uDrift * 0.55, uProgress, 3)
  );
  p += (warp - 0.5) * 2.2;

  float base = loopFbm(p, uDrift, uProgress, 5);
  float detail = loopFbm(p * 3.1 + vec2(31.7, 12.9), uDrift * 1.8, uProgress, 4);
  float density = mix(base, detail, uDetail);

  // A soft diagonal band concentrates the cloud into a river across frame
  // instead of an even fog.
  float tilted = (uv.y - uBandCenter) + (uv.x - 0.5) * uBandTilt;
  float band = exp(-(tilted * tilted) / max(uBandWidth * uBandWidth, 1e-5));

  float sideT = clamp((uv.x - uSideStart) / (uSideEnd - uSideStart), 0.0, 1.0);
  float side = 1.0 - sideT * sideT * (3.0 - 2.0 * sideT);

  density = pow(clamp(density * (0.35 + 0.95 * band), 0.0, 1.0), uContrast) * uGain * side;

  vec3 col = uColorSky;
  col = mix(col, uColorDeep, clamp(density * 1.8, 0.0, 1.0));
  col = mix(col, uColorMid, clamp(density * density * 2.4, 0.0, 1.0));
  col = mix(col, uColorHot, clamp(pow(density, 3.5) * 3.0, 0.0, 1.0));

  vec2 vig = (uv - 0.5) * uAspect;
  float v = 1.0 - uVignette * dot(vig, vig) * 0.75;
  col *= clamp(v, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}
`;

/** Keeps only pixels above a luminance threshold; feeds the blur passes. */
export const THRESHOLD_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uSoftness;

void main() {
  vec4 src = texture(uTexture, vTextureCoord);
  float luma = dot(src.rgb, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(uThreshold, uThreshold + uSoftness, luma);
  fragColor = vec4(src.rgb * w, src.a * w);
}
`;

/** 9-tap Gaussian, run once horizontally and once vertically. */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vTextureCoord;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uStep; // texel offset * radius, along one axis only

void main() {
  const float w0 = 0.2270270270;
  const float w1 = 0.1945945946;
  const float w2 = 0.1216216216;
  const float w3 = 0.0540540541;
  const float w4 = 0.0162162162;

  vec4 sum = texture(uTexture, vTextureCoord) * w0;
  sum += (texture(uTexture, vTextureCoord + uStep * 1.0) + texture(uTexture, vTextureCoord - uStep * 1.0)) * w1;
  sum += (texture(uTexture, vTextureCoord + uStep * 2.0) + texture(uTexture, vTextureCoord - uStep * 2.0)) * w2;
  sum += (texture(uTexture, vTextureCoord + uStep * 3.0) + texture(uTexture, vTextureCoord - uStep * 3.0)) * w3;
  sum += (texture(uTexture, vTextureCoord + uStep * 4.0) + texture(uTexture, vTextureCoord - uStep * 4.0)) * w4;
  fragColor = sum;
}
`;

/**
 * Final grade: subtle film grain plus a blue-noise-ish dither. Dark gradients
 * band badly once they are encoded to 8-bit H.264, and this is what stops the
 * flat areas of the blue plate from stepping.
 */
export const GRADE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vTextureCoord;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uSeed;
uniform float uGrain;
uniform float uDither;
uniform float uSaturation;
uniform float uLift;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec4 src = texture(uTexture, vTextureCoord);
  vec3 col = src.rgb;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col += uLift * (1.0 - smoothstep(0.0, 0.35, luma));

  vec2 px = vUv * uResolution;
  float grain = hash31(vec3(floor(px), uSeed)) - 0.5;
  // Grain rides the shadows harder than the highlights, like real film.
  col += grain * uGrain * (1.0 - 0.65 * luma);

  float dither = (hash31(vec3(floor(px) + 17.0, uSeed + 3.7)) - 0.5) / 255.0;
  col += dither * uDither;

  fragColor = vec4(max(col, 0.0), 1.0);
}
`;
