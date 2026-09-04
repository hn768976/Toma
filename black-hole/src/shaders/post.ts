// Post chain: bright-pass -> two-level separable Gaussian -> composite.
// The threshold is set above the outer disc's radiance so only the photon ring
// and the disc's inner edge ever reach the bloom buffers.

export const QUAD_VERTEX = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const BRIGHT_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uTexel;      // texel size of the *source*
uniform float uThreshold;
uniform float uInvGain;
void main() {
  // 4-tap box downsample, then knee-softened threshold.
  vec3 c = texture(uTex, vUv + vec2(-0.5, -0.5) * uTexel).rgb;
  c += texture(uTex, vUv + vec2( 0.5, -0.5) * uTexel).rgb;
  c += texture(uTex, vUv + vec2(-0.5,  0.5) * uTexel).rgb;
  c += texture(uTex, vUv + vec2( 0.5,  0.5) * uTexel).rgb;
  c *= 0.25 * uInvGain;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0);
  fragColor = vec4(c * (k / max(l, 1e-4)), 1.0);
}
`;

export const DOWN_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uTexel;
void main() {
  vec3 c = texture(uTex, vUv + vec2(-0.5, -0.5) * uTexel).rgb;
  c += texture(uTex, vUv + vec2( 0.5, -0.5) * uTexel).rgb;
  c += texture(uTex, vUv + vec2(-0.5,  0.5) * uTexel).rgb;
  c += texture(uTex, vUv + vec2( 0.5,  0.5) * uTexel).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}
`;

export const BLUR_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uDir;        // texel-sized step along one axis
void main() {
  // 9-tap Gaussian with linear-sampling weights.
  const float w0 = 0.227027;
  const float w1 = 0.316216;
  const float w2 = 0.070270;
  const float o1 = 1.384615;
  const float o2 = 3.230769;
  vec3 c = texture(uTex, vUv).rgb * w0;
  c += texture(uTex, vUv + uDir * o1).rgb * w1;
  c += texture(uTex, vUv - uDir * o1).rgb * w1;
  c += texture(uTex, vUv + uDir * o2).rgb * w2;
  c += texture(uTex, vUv - uDir * o2).rgb * w2;
  fragColor = vec4(c, 1.0);
}
`;

export const COMPOSITE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloomA;   // half res, tight
uniform sampler2D uBloomB;   // eighth res, wide halo
uniform float uBloomA_k;
uniform float uBloomB_k;
uniform float uExposure;
uniform float uGrain;
uniform float uSeed;
uniform vec2 uRes;
uniform float uInvGain;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec4 s = texture(uScene, vUv);
  vec3 c = s.rgb * uInvGain;
  // Nothing may touch the black disc, so bloom is masked by the keep-clear
  // region -- the horizon and the gap around it. Without this the glow from the
  // motes creeps back across the gap and lands on the horizon's edge.
  float lit = 1.0 - s.a;
  c += texture(uBloomA, vUv).rgb * (uBloomA_k * uInvGain) * lit;
  c += texture(uBloomB, vUv).rgb * (uBloomB_k * uInvGain) * lit;

  // Filmic-ish rolloff: bright cores clip to white, everything else keeps its
  // gradient instead of hitting a hard shoulder.
  c = vec3(1.0) - exp(-c * uExposure);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));

  // Fine grain. Large smooth falloffs around a black disc are the worst case
  // for H.264 banding; this is what breaks the contours up.
  vec2 px = vUv * uRes;
  float n = hash13(vec3(px, uSeed)) - 0.5;
  c += n * uGrain;

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
