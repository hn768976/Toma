import { NOISE_4D_GLSL } from "./noise4d";

/**
 * Full-screen quad in clip space. Deliberately ignores Pixi's projection
 * uniforms so the shader is resolution-independent and identical at 1080p and
 * 4K -- the only thing that changes between them is how many samples we take.
 */
export const QUAD_VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const FIELD_FRAGMENT = /* glsl */ `
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform float uAspect;
uniform float uPhase;        // 0..1 across the clip, wraps exactly

// --- field shape -----------------------------------------------------------
uniform float uScale;        // base feature size
uniform float uWarpA;        // first domain-warp strength
uniform float uWarpB;        // second domain-warp strength
uniform float uLoopRadius;   // radius of the circular path through 4D noise
uniform float uDrift;        // constant translation across the clip
uniform float uDetail;       // fBm gain: low = big soft blobs, high = crisp
uniform float uSeed;

// --- tonality --------------------------------------------------------------
uniform float uBiasY;        // vertical push, lifts glows toward one edge
uniform float uBiasX;
uniform float uSwirl;        // how much the warp field re-indexes the palette
uniform float uFieldAmount;  // how far the noise alone may travel the palette
uniform float uOffset;       // where the palette sits when the field is zero
uniform float uContrast;

// --- standing glows --------------------------------------------------------
// Two soft light sources pinned in frame. A vertical ramp alone reads as
// horizontal strata; the references bloom from points, usually just off the
// edge, so these anchor the composition in two dimensions while staying put
// as the noise moves underneath them.
uniform vec2 uGlow1Pos;
uniform float uGlow1Radius;
uniform float uGlow1Amount;
uniform vec2 uGlow2Pos;
uniform float uGlow2Radius;
uniform float uGlow2Amount;
uniform float uGlowWarp;     // lets the noise bend the glows out of round
uniform float uGamma;
uniform float uExposure;

// --- palette (linear-light) ------------------------------------------------
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
uniform vec3 uC5;

// --- iridescence (cosine palette, used by the holographic variant) ---------
uniform float uIridescence;
uniform vec3 uIrA;
uniform vec3 uIrB;
uniform vec3 uIrC;
uniform vec3 uIrD;
uniform float uIrFreq;

const float TAU = 6.28318530717958647;

${NOISE_4D_GLSL}

// fBm with an adjustable gain. These references are almost entirely first
// octave -- a standard 0.5 gain buries them in detail they do not have -- so
// the higher octaves are dialled down to a hint of structure instead.
float fbm2(vec4 p) {
  float g = uDetail;
  float v = snoise4(p) + snoise4(p * 2.03) * g;
  return v / (1.0 + g);
}

float fbm3(vec4 p) {
  float g = uDetail;
  float g2 = g * g;
  float v = snoise4(p) + snoise4(p * 2.01) * g + snoise4(p * 4.07) * g2;
  return v / (1.0 + g + g2);
}

vec3 ramp(float t) {
  float x = clamp(t, 0.0, 1.0) * 5.0;
  // min(..., 4.0) matters: at x == 5.0 exactly, floor gives 5, which falls
  // through to the last branch with f == 0 and returns stop 4 instead of stop
  // 5 -- a hard edge wherever the field saturates.
  float i = min(floor(x), 4.0);
  float f = x - i;
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic: C2 continuous stops
  vec3 a = uC0;
  vec3 b = uC1;
  if (i >= 4.0)      { a = uC4; b = uC5; }
  else if (i >= 3.0) { a = uC3; b = uC4; }
  else if (i >= 2.0) { a = uC2; b = uC3; }
  else if (i >= 1.0) { a = uC1; b = uC2; }
  return mix(a, b, f);
}

// Gaussian falloff rather than smoothstep: no edge to give the circle away.
float glowAt(vec2 pp, vec2 c, float radius) {
  float d = length(pp - c) / max(radius, 0.001);
  return exp(-d * d);
}

vec3 iridescent(float t) {
  return uIrA + uIrB * cos(TAU * (uIrC * t * uIrFreq + uIrD));
}

void main() {
  // Aspect-corrected, centred coordinates so the field never stretches.
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

  float ang = TAU * uPhase;
  vec2 loop = vec2(cos(ang), sin(ang)) * uLoopRadius;

  // Drift has to travel a closed path too. A linear ramp in uPhase does not:
  // it snaps back at the wrap and breaks the loop. An ellipse, run at a
  // different phase offset from the noise circle so the two do not move in
  // lockstep, gives the same slow wander and returns exactly to its start.
  vec2 drift = uDrift * vec2(cos(ang + 1.7) - cos(1.7), (sin(ang + 1.7) - sin(1.7)) * 0.55);

  vec4 base = vec4((p + drift) * uScale + uSeed, loop.x + uSeed, loop.y - uSeed);

  // Two rounds of domain warping. This is what turns plain noise into the
  // folded, liquid banding the references have.
  vec2 q = vec2(
    fbm2(base),
    fbm2(base + vec4(5.2, 1.3, 2.8, 0.7))
  );

  vec4 warped1 = base + vec4(q * uWarpA, 0.0, 0.0);
  vec2 r = vec2(
    fbm2(warped1 + vec4(1.7, 9.2, 0.0, 3.1)),
    fbm2(warped1 + vec4(8.3, 2.8, 4.4, 0.0))
  );

  float f = fbm3(base + vec4(r * uWarpB, 0.0, 0.0));

  // Palette coordinate. The standing spatial ramp (uBias*/uOffset) fixes the
  // overall composition -- dark top, glow along one edge -- while the noise is
  // only allowed to push it uFieldAmount either side. Letting the field drive
  // the whole range is what made earlier passes swing from fully lit to fully
  // black over the length of a clip; the references hold their balance.
  float t = f * 0.5 * uFieldAmount;
  t += uSwirl * (r.x * 0.5 + q.y * 0.25);
  t += uBiasY * (vUv.y - 0.5);
  t += uBiasX * (vUv.x - 0.5);

  // Glows sampled through the warp field, so they read as organic blooms
  // rather than airbrushed circles.
  vec2 gp = p + r * uGlowWarp;
  t += uGlow1Amount * glowAt(gp, uGlow1Pos, uGlow1Radius);
  t += uGlow2Amount * glowAt(gp, uGlow2Pos, uGlow2Radius);

  t = t * uContrast + uOffset;
  t = clamp(t, 0.0, 1.0);
  t = pow(t, uGamma);

  vec3 col = ramp(t);

  if (uIridescence > 0.0) {
    float ti = t + uSwirl * 0.5 * r.y + 0.15 * q.x;
    col = mix(col, iridescent(ti), uIridescence);
  }

  col *= uExposure;

  // Linear light, undithered, no grain: everything that survives the upscale
  // happens here, everything that must stay pixel-sharp happens in the
  // composite pass.
  finalColor = vec4(col, 1.0);
}
`;

/**
 * Second pass, at full output resolution. Takes the smooth low-resolution
 * field, resamples it without the creases plain bilinear would leave, then
 * does the work that has to happen per output pixel: vignette, grade, film
 * grain and the dither that keeps eight-bit H.264 from banding.
 */
export const COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uFieldTexture;
uniform vec2 uFieldSize;
uniform vec2 uResolution;
uniform float uAspect;
uniform float uFrame;

uniform float uVignette;
uniform float uVignetteSoft;
uniform float uSaturation;
uniform float uGrain;
uniform float uGrainSize;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

/**
 * Bilinear taps are C0 continuous, so a straight 3x or 6x upscale of a smooth
 * field shows faint diamond creases along the texel grid. Warping the
 * fractional part through a quintic before the hardware tap makes the result
 * C2 continuous for the cost of a few instructions.
 */
vec3 sampleFieldSmooth(vec2 uv) {
  vec2 p = uv * uFieldSize - 0.5;
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 suv = (i + f + 0.5) / uFieldSize;
  return texture(uFieldTexture, suv).rgb;
}

void main() {
  vec3 col = sampleFieldSmooth(vUv);

  // Vignette in linear light so it darkens without tinting.
  vec2 vp = (vUv - 0.5) * vec2(uAspect, 1.0);
  float vig = 1.0 - uVignette * smoothstep(uVignetteSoft, 1.15, length(vp) * 1.6);
  col *= vig;

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSaturation);

  vec3 srgb = linearToSrgb(col);

  // Film grain, strongest in the midtones like real emulsion, and sized
  // relative to frame height so 1080p and 4K carry the same apparent texture.
  if (uGrain > 0.0) {
    vec2 gp = floor(gl_FragCoord.xy / max(uGrainSize, 1.0) * (1080.0 / uResolution.y));
    float g = hash13(vec3(gp, uFrame)) - 0.5;
    float shaped = 1.0 - abs(dot(srgb, vec3(0.3333)) * 2.0 - 1.0);
    srgb += g * uGrain * mix(0.35, 1.0, shaped);
  }

  // Triangular-PDF dither. Without this, 8-bit output bands badly across the
  // wide, flat areas these gradients are made of.
  float d0 = hash13(vec3(gl_FragCoord.xy, uFrame + 17.0));
  float d1 = hash13(vec3(gl_FragCoord.yx, uFrame + 93.0));
  srgb += (d0 - d1) / 255.0;

  finalColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;
