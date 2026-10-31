/** Raw GLSL ES 3.00 (WebGL 2) shaders for the particle countdown. */

export const PARTICLE_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aHome;
layout(location = 1) in vec4 aSeed;
layout(location = 2) in float aKind;

uniform float uFrame;
uniform float uPeak;
uniform vec2 uCentroid;
uniform vec2 uRefSize;
uniform float uPxScale;
uniform float uMaxPoint;
uniform float uAmbient;
uniform float uFormFrames;
uniform float uDissolveFrames;
uniform vec3 uGlitterA;
uniform vec3 uGlitterB;
uniform vec3 uFlash;
uniform vec3 uAccent[4];
uniform vec3 uHaze[2];

out vec4 vColor;
out float vShape;

const float TAU = 6.2831853;

vec3 accent(float r) {
  int i = int(clamp(floor(r * 4.0), 0.0, 3.0));
  return uAccent[i];
}

void main() {
  vec4 s = aSeed;
  float t = uFrame - uPeak;
  vec2 pos = aHome;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float size = 1.0;
  float shape = 0.0;

  // ---------------- per-number life cycle ----------------
  // formation: staggered condensation before the peak
  float delay = s.x * 8.0;
  float form = clamp((t + uFormFrames - delay) / (uFormFrames - 8.0), 0.0, 1.0);
  form = form * form * (3.0 - 2.0 * form);
  // brightness ramps from a dim silver to full at the peak, then a short flash
  float ramp = mix(0.5, 1.0, smoothstep(-14.0, -1.0, t));
  float flash = exp(-pow((t - 1.5) / 4.2, 2.0));
  // dissolve: staggered burst after the peak
  float dStart = s.z * 3.0;
  float dLen = uDissolveFrames * (0.5 + 0.5 * s.w);
  float d = clamp((t - dStart) / dLen, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - d, 3.0);
  vec2 lift = vec2(0.0, (130.0 + 300.0 * s.z) * e);
  // the burst tears the number apart sideways in ragged horizontal bands
  float band = sin(aHome.y * 0.011 + s.w * 1.2 + uPeak * 0.37) + 0.35 * sin(aHome.y * 0.037 + uPeak);
  float tearDir = band >= 0.0 ? 1.0 : -1.0;
  vec2 tear = vec2(tearDir * (0.35 + 0.65 * min(1.0, abs(band))), 0.12 * (s.x - 0.5));
  float burstGlow = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.12, 0.55, d));

  vec2 rel = aHome - uCentroid;
  vec2 radial = normalize(rel + vec2(s.y - 0.5, s.x - 0.5) * 60.0);
  vec2 swirl = vec2(
    sin(aHome.y * 0.0055 + t * 0.055 + s.w * TAU),
    cos(aHome.x * 0.0055 - t * 0.045 + s.x * TAU)
  );
  vec2 rnd = vec2(cos(s.y * TAU), sin(s.y * TAU));

  if (aKind < 1.5) {
    // 0: glitter body, 1: edge glitter (slightly brighter)
    float edge = step(0.5, aKind);
    vec2 condense = (1.0 - form) * rnd * (25.0 + 110.0 * s.z);
    vec2 burst = e * (tear * (90.0 + 560.0 * s.y * s.y) + radial * (30.0 + 140.0 * s.x) + swirl * (50.0 + 150.0 * s.x)) + lift;
    pos += condense + burst;
    float twinkle = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uFrame * (0.12 + 0.3 * s.w) + s.x * 47.0), 2.0);
    vec3 base = mix(uGlitterA, uGlitterB, s.y);
    base = mix(base, accent(fract(s.x * 13.7)), step(0.66, fract(s.z * 7.3)) * 0.85);
    base = mix(base, accent(fract(s.w * 5.3)), e * 0.35 * step(0.5, fract(s.y * 11.0)));
    col = mix(base, uFlash, flash * 0.65);
    float fade = 1.0 - smoothstep(0.38, 1.0, d);
    float star = step(0.955, fract(s.z * 17.0 + s.w * 3.0));
    alpha = form * ramp * fade * twinkle * (0.72 + 1.0 * star) * (1.0 + 1.6 * flash + 0.9 * burstGlow);
    size = (3.2 + 4.2 * s.w) * (1.0 + 0.9 * star) * (1.0 + 0.35 * flash) * (1.0 + e * (s.x - 0.4));
    shape = 0.0;
  } else if (aKind < 2.5) {
    // 2: coloured bokeh dots around the number
    vec2 burst = e * (tear * (140.0 + 520.0 * s.y) + radial * (80.0 + 220.0 * s.x) + swirl * (90.0 + 200.0 * s.x)) + lift * 1.15;
    pos += rnd * (40.0 + 120.0 * s.z) + burst;
    float env = 0.12 * form * (1.0 - smoothstep(0.0, 0.2, d)) + smoothstep(0.0, 0.12, d) * (1.0 - smoothstep(0.4, 1.0, d));
    col = accent(s.w);
    alpha = env * (0.25 + 0.55 * s.x) * (0.7 + 0.3 * sin(uFrame * 0.09 + s.y * 31.0));
    size = 10.0 + 44.0 * pow(s.z, 1.8);
    shape = 1.0;
  } else if (aKind < 3.5) {
    // 3: soft coloured haze inside the cloud
    vec2 burst = e * (tear * (80.0 + 260.0 * s.y) + radial * 90.0 + swirl * 110.0) + lift;
    pos += burst;
    float env = 0.25 * form * smoothstep(-6.0, 0.0, t) + smoothstep(0.0, 0.15, d) * (1.0 - smoothstep(0.35, 1.0, d));
    col = mix(uHaze[0], uHaze[1], s.x);
    alpha = env * 0.028;
    size = 170.0 + 250.0 * s.z;
    shape = 2.0;
  } else {
    // 4: ambient dust drifting across the whole frame
    pos += vec2(sin(uFrame * 0.011 + s.x * TAU) * 60.0, uFrame * (0.6 + 1.6 * s.y));
    pos.y = mod(pos.y + uRefSize.y * 0.5, uRefSize.y) - uRefSize.y * 0.5;
    float tw = 0.5 + 0.5 * sin(uFrame * (0.05 + 0.08 * s.w) + s.z * TAU);
    bool big = s.w > 0.8;
    col = big ? accent(s.x) : mix(uGlitterA, uGlitterB, s.z);
    alpha = uAmbient * tw * (big ? 0.18 : 0.35);
    size = big ? 10.0 + 22.0 * s.z : 3.0 + 3.0 * s.z;
    shape = big ? 1.0 : 0.0;
  }

  gl_Position = vec4(pos / (uRefSize * 0.5), 0.0, 1.0);
  gl_PointSize = clamp(size * uPxScale, 1.0, uMaxPoint);
  // keep sub-pixel grains energy-conserving when rendered small
  float shrink = min(1.0, size * uPxScale) ;
  vColor = vec4(col, alpha * shrink);
  vShape = shape;
}
`;

export const PARTICLE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
in float vShape;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float m;
  if (vShape < 0.5) {
    m = exp(-r2 * 3.2);
  } else if (vShape < 1.5) {
    float r = sqrt(r2);
    m = smoothstep(1.0, 0.78, r) * (0.65 + 0.35 * smoothstep(0.45, 0.95, r));
  } else {
    m = exp(-r2 * 3.5) * (1.0 - r2);
  }
  outColor = vec4(vColor.rgb * vColor.a * m, 1.0);
}
`;

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUv;
void main() {
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

/** Exact 4×4 box downsample using four bilinear taps. */
export const DOWNSAMPLE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSrcTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 o = uSrcTexel;
  vec4 c = texture(uTex, vUv + vec2(-o.x, -o.y));
  c += texture(uTex, vUv + vec2(o.x, -o.y));
  c += texture(uTex, vUv + vec2(-o.x, o.y));
  c += texture(uTex, vUv + vec2(o.x, o.y));
  outColor = c * 0.25;
}
`;

/** 9-tap separable gaussian using linear sampling. */
export const BLUR_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir; // texel step * direction * spread
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv) * 0.2270270270;
  c += texture(uTex, vUv + uDir * 1.3846153846) * 0.3162162162;
  c += texture(uTex, vUv - uDir * 1.3846153846) * 0.3162162162;
  c += texture(uTex, vUv + uDir * 3.2307692308) * 0.0702702703;
  c += texture(uTex, vUv - uDir * 3.2307692308) * 0.0702702703;
  outColor = c;
}
`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform vec2 uBloom;
uniform vec3 uHalo;
uniform vec3 uBg;
uniform vec3 uBgGlow;
uniform vec2 uRes;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 b1 = texture(uBloom1, vUv).rgb;
  vec3 b2 = texture(uBloom2, vUv).rgb;
  vec3 light = scene + b1 * uBloom.x + b2 * uBloom.y * uHalo;
  // soft exponential tone curve keeps the glitter from clipping harshly
  vec3 mapped = 1.0 - exp(-light * 1.15);
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 bg = uBg + uBgGlow * (1.0 - smoothstep(0.0, 0.9, length(q)));
  vec3 col = bg + mapped * (1.0 - bg);
  // tiny ordered dither to avoid banding in the dark gradients
  col += (hash(gl_FragCoord.xy + fract(uFrame * 0.618) * 71.0) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
