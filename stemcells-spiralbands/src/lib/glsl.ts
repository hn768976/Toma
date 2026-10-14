// Shared GLSL chunks.

// Ashima / Stefan Gustavson 3D simplex noise (MIT).
export const SIMPLEX3 = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// Soft studio backdrop, evaluated analytically so glass can sample it at a
// refracted position without a render target.
export const BACKDROP = /* glsl */ `
uniform vec3 uBgEdge;
uniform vec3 uBgMid;
uniform vec3 uBgCore;
uniform vec2 uGlowPos;
uniform vec2 uGlowShape; // x: wide sigma, y: core sigma (in frame heights)
uniform float uGlowStretch;
uniform float uVignette;
uniform float uCloud;
uniform float uAspect;
uniform vec2 uCloudPhase;

float bgCloud(vec2 q) {
  // Low-frequency mottling for the hazy backdrops. Static apart from a
  // closed (periodic) drift.
  vec3 p = vec3(q * 1.6, 0.0) + vec3(uCloudPhase * 0.25, 0.0);
  return snoise(p) * 0.6 + snoise(p * 2.1 + 3.7) * 0.3;
}

vec3 backdrop(vec2 uv) {
  vec2 q = (uv - 0.5) * vec2(uAspect, 1.0);
  vec2 p = (uv - uGlowPos) * vec2(uAspect, 1.0);
  p.x /= uGlowStretch;
  float d2 = dot(p, p);
  float wide = exp(-d2 / (2.0 * uGlowShape.x * uGlowShape.x));
  float core = exp(-d2 / (2.0 * uGlowShape.y * uGlowShape.y));
  vec3 c = mix(uBgEdge, uBgMid, wide) + uBgCore * core;
  if (uCloud > 0.0) c *= 1.0 + uCloud * bgCloud(q);
  c *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
  return max(c, vec3(0.0));
}
`;

export const COLOR = /* glsl */ `
vec3 linearToSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

// Final pass: linear half-float scene -> sRGB, blue-noise dither (+-1/255,
// triangular) and film grain. Both are fixed functions of pixel position and
// (frame mod loop length), so every frame is reproducible.
export const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBlue;
uniform float uFrameMod;
uniform float uGrain;
uniform vec2 uRes;
in vec2 vUv;
out vec4 outColor;
${COLOR}
void main() {
  vec3 c = texture(tScene, vUv).rgb;
  c = linearToSRGB(clamp(c, 0.0, 1.0));
  // R2-sequence offset of the blue-noise tile per frame.
  vec2 off = floor(fract(vec2(0.7548776662, 0.5698402910) * uFrameMod) * 64.0);
  vec2 bnUv = (gl_FragCoord.xy + off) / 64.0;
  vec4 bn = texture(tBlue, bnUv);
  float tri = bn.r - bn.g; // triangular, -1..1
  c += tri / 255.0;
  float g = hash12(gl_FragCoord.xy + vec2(uFrameMod * 37.17, uFrameMod * 11.93)) - 0.5;
  float g2 = hash12(gl_FragCoord.yx * 1.37 + vec2(uFrameMod * 5.31, uFrameMod * 23.7)) - 0.5;
  // ~1.5% grain, luminance only, slightly stronger in the mids.
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c += (g + g2) * uGrain * (0.6 + 0.8 * lum * (1.0 - lum));
  outColor = vec4(c, 1.0);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
