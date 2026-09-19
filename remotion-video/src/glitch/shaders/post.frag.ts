import { GLSL_HASH } from "./lib";

/** Soft-knee bright pass with a 4-tap box downsample folded in. */
export const BRIGHT_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uSource;
uniform vec2  uTexel;      // one source texel in uv
uniform float uThreshold;
uniform float uKnee;

void main() {
  vec3 c = texture(uSource, vUv + uTexel * vec2(-0.5, -0.5)).rgb
         + texture(uSource, vUv + uTexel * vec2( 0.5, -0.5)).rgb
         + texture(uSource, vUv + uTexel * vec2(-0.5,  0.5)).rgb
         + texture(uSource, vUv + uTexel * vec2( 0.5,  0.5)).rgb;
  c *= 0.25;

  float lum = max(max(c.r, c.g), c.b);
  float soft = clamp(lum - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, lum - uThreshold) / max(lum, 1e-5);

  finalColor = vec4(c * contrib, 1.0);
}
`;

/** Separable 9-tap gaussian. uDirection carries the per-axis radius in uv,
 *  which is what makes the glow anisotropic: these plates bleed much further
 *  horizontally than vertically, exactly as the references do. */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uSource;
uniform vec2 uDirection;

void main() {
  float w0 = 0.2270270270;
  float w1 = 0.1945945946;
  float w2 = 0.1216216216;
  float w3 = 0.0540540541;
  float w4 = 0.0162162162;

  vec3 c = texture(uSource, vUv).rgb * w0;
  c += texture(uSource, vUv + uDirection * 1.0).rgb * w1;
  c += texture(uSource, vUv - uDirection * 1.0).rgb * w1;
  c += texture(uSource, vUv + uDirection * 2.0).rgb * w2;
  c += texture(uSource, vUv - uDirection * 2.0).rgb * w2;
  c += texture(uSource, vUv + uDirection * 3.0).rgb * w3;
  c += texture(uSource, vUv - uDirection * 3.0).rgb * w3;
  c += texture(uSource, vUv + uDirection * 4.0).rgb * w4;
  c += texture(uSource, vUv - uDirection * 4.0).rgb * w4;

  finalColor = vec4(c, 1.0);
}
`;

/** Final grade: bloom mix, chromatic aberration, scanlines, grain, vignette. */
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uBase;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;

uniform vec2  uRenderSize;
uniform float uScale;
uniform float uPhase;

uniform float uBloomAMix;
uniform float uBloomBMix;
uniform float uAberration;  // design px
uniform float uScanAmount;
uniform float uScanPeriod;  // design px
uniform float uGrain;
uniform float uGrainSlots;  // whole slots per loop
uniform float uVignette;
uniform float uExposure;
uniform float uBlackPoint;
uniform vec3  uLift;

const float TAU = 6.28318530718;

${GLSL_HASH}

void main() {
  vec2 texel = 1.0 / uRenderSize;
  float ab = uAberration * uScale * texel.x;

  vec3 base = vec3(
    texture(uBase, vUv + vec2(ab, 0.0)).r,
    texture(uBase, vUv).g,
    texture(uBase, vUv - vec2(ab, 0.0)).b
  );

  vec3 c = base
         + texture(uBloomA, vUv).rgb * uBloomAMix
         + texture(uBloomB, vUv).rgb * uBloomBMix;

  // scanlines, measured in design px so 4K matches 1080p
  float py = vUv.y * uRenderSize.y / uScale;
  c *= 1.0 - uScanAmount * (0.5 + 0.5 * cos(py * TAU / max(uScanPeriod, 1e-3)));

  // grain, re-seeded on a slot clock that divides the loop exactly
  float slot = floor(uPhase * uGrainSlots);
  float g = hash13(vec3(floor(vUv * uRenderSize), slot)) - 0.5;
  c += g * uGrain;

  c = max(c - uBlackPoint, vec3(0.0)) / max(1.0 - uBlackPoint, 1e-3);
  c = vec3(1.0) - exp(-c * uExposure);
  c += uLift;

  float d = length((vUv - 0.5) * vec2(1.08, 1.0));
  c *= 1.0 - uVignette * smoothstep(0.25, 0.82, d);

  finalColor = vec4(max(c, vec3(0.0)), 1.0);
}
`;
