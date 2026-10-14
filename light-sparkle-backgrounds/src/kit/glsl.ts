// Shared GLSL (ES 3.00). Precision is stated explicitly so
// gradients are evaluated in full float everywhere.

export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

export const COMMON_GLSL = /* glsl */ `
#define TAU 6.283185307179586
#define DESIGN vec2(3840.0, 2160.0)

vec3 hex3(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

// Integer hash (PCG3D): identical on every GPU, no float trig hashing.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33u(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967295.0); }

// 2D value noise, periodic with period 'per' (in lattice cells) on both axes.
float hash21p(vec2 c, vec2 per) {
  c = mod(c, per);
  return hash33u(uvec3(uvec2(c), 7u)).x;
}
float vnoisep(vec2 p, vec2 per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21p(i, per);
  float b = hash21p(i + vec2(1.0, 0.0), per);
  float c = hash21p(i + vec2(0.0, 1.0), per);
  float d = hash21p(i + vec2(1.0, 1.0), per);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbmp(vec2 p, vec2 per) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoisep(p, per);
    p *= 2.0;
    per *= 2.0;
    a *= 0.5;
  }
  return s;
}
`;

// Final composite: look background (float) + sprite layers + bloom, screen-blended,
// then grain and blue-noise dither before the 8-bit canvas.
export const finalFragment = (lookGlsl: string) => /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uSprites;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBlueNoise;
uniform float uFrame;   // frame % 600
uniform float uPhase;   // (frame % 600) / 600
uniform vec4 uPost;     // bloom1 gain, bloom2 gain, grain amount, dither on/off
uniform vec4 uSpriteMix; // x: sprite gain, y: 1 = screen blend, 0 = add
${COMMON_GLSL}
${lookGlsl}
void main() {
  vec2 p = vUV * DESIGN;
  vec3 bg = background(p);
  vec3 spr = uSpriteMix.x * texture(uSprites, vUV).rgb
           + uPost.x * texture(uBloom1, vUV).rgb
           + uPost.y * texture(uBloom2, vUV).rgb;
  spr = max(spr, 0.0);
  vec3 c = mix(bg + spr, 1.0 - (1.0 - clamp(bg, 0.0, 1.0)) * (1.0 - clamp(spr, 0.0, 1.0)), uSpriteMix.y);
  c = clamp(c, 0.0, 1.0);
  if (uPost.w > 0.5) {
    uint f = uint(uFrame);
    // Grain: fixed function of pixel position and frame (triangular distribution).
    vec3 h = hash33u(uvec3(uvec2(gl_FragCoord.xy), f + 1000u));
    float g = (h.x + h.y - 1.0) * uPost.z;
    // Soft-light style: less grain in the clipped whites, never pushes past 1.
    c += g * (0.35 + 0.65 * (1.0 - c));
    // Blue-noise dither, tile offset driven by frame % 600.
    ivec2 off = ivec2(int((f * 37u) % 64u), int((f * 101u) % 64u));
    ivec2 tc = (ivec2(gl_FragCoord.xy) + off) & ivec2(63);
    float bn = texelFetch(uBlueNoise, tc, 0).r;
    vec3 bn3 = vec3(bn, fract(bn + 0.618034), fract(bn + 0.236068));
    c += (bn3 - 0.5) / 255.0;
    c = clamp(c, 0.0, 1.0);
  } else {
    // No dither, no grain (overlay looks): a tiny floor removes sub-1/255 halo
    // tails, then quantise explicitly so empty sky stays exactly 0.
    c = max(c - 0.75 / 255.0, 0.0);
    c = floor(c * 255.0 + 0.5) / 255.0;
  }
  finalColor = vec4(c, 1.0);
}
`;

export const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uSrc;
void main() { finalColor = vec4(texture(uSrc, vUV).rgb, 1.0); }
`;

// Fixed 9-tap gaussian (sigma = 2 texels), separable.
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uSrc;
uniform vec2 uStep;
void main() {
  float w[5] = float[5](0.20236, 0.17901, 0.12385, 0.06706, 0.02841);
  vec3 s = texture(uSrc, vUV).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    s += texture(uSrc, vUV + uStep * float(i)).rgb * w[i];
    s += texture(uSrc, vUV - uStep * float(i)).rgb * w[i];
  }
  finalColor = vec4(s, 1.0);
}
`;
