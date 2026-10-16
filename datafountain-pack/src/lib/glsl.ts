/** Shared GLSL (GLSL3 / WebGL2). Integer hashes only: no sin()-hash drift. */

export const HASH = /* glsl */ `
uint pcgHash(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash3u(uvec3 v) {
  return float(pcgHash(v.x + pcgHash(v.y + pcgHash(v.z)))) * (1.0 / 4294967295.0);
}
float hash1(float n) { return float(pcgHash(uint(int(n) + 1000000))) * (1.0 / 4294967295.0); }
`;

export const SRGB = /* glsl */ `
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/**
 * Final-output finishing, applied in display (sRGB) space:
 *  - film grain ~1.5%: fixed formula of pixel position and (frame mod loop)
 *  - optional fade of the grain to zero below ~3% luminance
 *  - dither of ±1/255: blue-noise map (fixed) or triangular hash noise
 * uniforms: uFrameMod (float, already frame % loop), uGrain, uGrainDarkFade,
 * uBlueNoise (sampler2D), uUseBlueNoise.
 */
export const FINISH = /* glsl */ `
uniform float uFrameMod;
uniform float uGrain;
uniform float uGrainDarkFade;
uniform sampler2D uBlueNoise;
uniform float uUseBlueNoise;
vec3 finishOutput(vec3 srgb) {
  uvec2 p = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrameMod);
  float g1 = hash3u(uvec3(p, f * 2u + 11u));
  float g2 = hash3u(uvec3(p, f * 2u + 12u));
  float grain = (g1 + g2 - 1.0) * uGrain;             // triangular, ±uGrain
  float l = luma(srgb);
  float fade = mix(1.0, smoothstep(0.012, 0.045, l), uGrainDarkFade);
  vec3 c = srgb + grain * fade;
  float d;
  if (uUseBlueNoise > 0.5) {
    d = texelFetch(uBlueNoise, ivec2(p) & 63, 0).r - 0.5;
  } else {
    d = 0.5 * (hash3u(uvec3(p, f + 7001u)) + hash3u(uvec3(p, f + 9001u))) - 0.5;
  }
  c += d * (2.0 / 255.0);                               // ±1/255
  return clamp(c, 0.0, 1.0);
}
`;

/** Ashima/Stefan Gustavson simplex noise (MIT), 3D and 4D. */
export const SIMPLEX = /* glsl */ `
vec4 sx_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 sx_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float sx_mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 sx_permute(vec4 x) { return sx_mod289(((x * 34.0) + 10.0) * x); }
float sx_permute(float x) { return sx_mod289(((x * 34.0) + 10.0) * x); }
vec4 sx_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float sx_taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3(vec3 v) {
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
  i = sx_mod289(i);
  vec4 p = sx_permute(sx_permute(sx_permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
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
  vec4 norm = sx_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec4 sx_grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}
#define SX_F4 0.309016994374947451
float snoise4(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(v + dot(v, vec4(SX_F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = sx_mod289(i);
  float j0 = sx_permute(sx_permute(sx_permute(sx_permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = sx_permute(sx_permute(sx_permute(sx_permute(
    i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = sx_grad4(j0, ip);
  vec4 p1 = sx_grad4(j1.x, ip);
  vec4 p2 = sx_grad4(j1.y, ip);
  vec4 p3 = sx_grad4(j1.z, ip);
  vec4 p4 = sx_grad4(j1.w, ip);
  vec4 norm = sx_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= sx_taylorInvSqrt(dot(p4, p4));
  vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}
`;

/**
 * Depth-of-field for textured cards: a 16-tap Vogel disk whose radius is the
 * circle of confusion, sampled from a mip level matched to the tap spacing,
 * so a blurred card is smooth (no tap pattern) and a sharp one is crisp.
 * cocUv: CoC radius in texture UV units; texPx: texture size in texels.
 */
export const DOF_SAMPLE = /* glsl */ `
vec4 dofSample(sampler2D tex, vec2 uv, vec2 cocUv, vec2 texPx) {
  vec2 tuv = uv * texPx;
  float texelsPerPx = max(length(dFdx(tuv)), length(dFdy(tuv)));
  float natLod = log2(max(texelsPerPx, 1e-4));
  float rTex = max(cocUv.x * texPx.x, cocUv.y * texPx.y);
  float rScreen = rTex / max(texelsPerPx, 1e-4);
  if (rScreen < 0.6) {
    return textureLod(tex, uv, max(natLod, 0.0));
  }
  float lod = max(natLod, log2(max(rTex * 0.5, 1.0)));
  vec4 acc = vec4(0.0);
  const float GA = 2.39996323;
  for (int i = 0; i < 16; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / 16.0);
    float a = fi * GA;
    acc += textureLod(tex, uv + vec2(cos(a), sin(a)) * r * cocUv, lod);
  }
  return acc / 16.0;
}
`;

/** GLSL3 fragment prologue: three r180 leaves the output declaration to us. */
export const FRAG_OUT = /* glsl */ `
layout(location = 0) out highp vec4 fragOut;
#define gl_FragColor fragOut
`;
export const frag = (src: string) => FRAG_OUT + src;
