import { GLSL_HEADER } from "./renderer";

/**
 * One-time bake of the static procedural maps. Everything is periodic so the
 * textures tile seamlessly with REPEAT wrapping.
 *
 * uMode 0 -> "macro" crack map
 *     r: distance to the nearest crack line (in cell units, domain-warped)
 *     g: random id of the plate (cell) the texel belongs to
 *     b: distance to a finer, secondary hairline crack network
 *     a: low-frequency noise used to vary crack width / presence
 * uMode 1 -> "micro" skin relief map
 *     r: micro height (fine crease network + pores), 0..1
 *     g: d(height)/du   b: d(height)/dv   (pre-filtered normal map)
 *     a: soft fbm used for tone mottling and organic boundaries
 */
export const BAKE_FRAG = `${GLSL_HEADER}
in vec2 vUv; out vec4 o;
uniform int uMode;
uniform float uCells;     // cells per tile (macro: even number)
uniform float uJitter;    // voronoi jitter 0..1
uniform float uWarp;      // domain warp strength
uniform float uSize;      // texture size in texels

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
float pnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(mod(i, per));
  float b = hash12(mod(i + vec2(1.0, 0.0), per));
  float c = hash12(mod(i + vec2(0.0, 1.0), per));
  float d = hash12(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float pfbm(vec2 p, float per, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < oct; i++) {
    s += a * pnoise(p, per);
    n += a;
    p = p * 2.0 + 19.7;
    per *= 2.0;
    a *= 0.5;
  }
  return s / n;
}
vec2 pfbm2(vec2 p, float per, int oct) {
  return vec2(pfbm(p, per, oct), pfbm(p + 37.3, per, oct)) - 0.5;
}
// periodic voronoi: x = distance to nearest edge, y = cell id
vec2 pvoronoi(vec2 x, float per, float jitter) {
  vec2 n = floor(x), f = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 oo = 0.5 + (hash22(mod(n + g, per)) - 0.5) * jitter;
    vec2 r = g + oo - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 oo = 0.5 + (hash22(mod(n + g, per)) - 0.5) * jitter;
    vec2 r = g + oo - f;
    if (dot(mr - r, mr - r) > 1e-5) {
      md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
  }
  return vec2(md, hash12(mod(n + mg, per) + 7.31));
}

vec4 macro(vec2 uv) {
  float N = uCells;
  vec2 p = uv * N;
  vec2 w = pfbm2(p * 1.5, N * 1.5, 3) * 0.55
         + pfbm2(p * 6.0, N * 6.0, 3) * 0.13
         + pfbm2(p * 24.0, N * 24.0, 2) * 0.030;
  vec2 v = pvoronoi(p + w * uWarp, N, uJitter);
  vec2 w2 = pfbm2(p * 5.0 + 3.1, N * 5.0, 3) * 0.5;
  vec2 v2 = pvoronoi(p * 3.0 + w2 + 11.0, N * 3.0, 1.0);
  float a = pfbm(p * 0.75 + 5.3, N * 0.75, 4);
  return vec4(v.x, v.y, v2.x / 3.0, a);
}

float microHeight(vec2 uv) {
  float N = uCells;
  vec2 p = uv * N;
  vec2 w = pfbm2(p * 2.0, N * 2.0, 3);
  // primary crease network (elongated diamond cells like real skin)
  vec2 q = p + w * 0.45;
  vec2 v1 = pvoronoi(q, N, 0.95);
  // secondary finer network
  vec2 v2 = pvoronoi(q * 2.0 + 5.2, N * 2.0, 1.0);
  float h = smoothstep(0.0, 0.16, v1.x) * 0.62 + smoothstep(0.0, 0.22, v2.x) * 0.23;
  // plateau rounding + per-cell height variation
  h += 0.10 * v1.y;
  h += 0.10 * pfbm(p * 4.0 + 1.7, N * 4.0, 3);
  return h;
}

void main() {
  if (uMode == 0) {
    o = macro(vUv);
  } else {
    float h = microHeight(vUv);
    float a = pfbm(vUv * 6.0 + 9.1, 6.0, 5);
    // screen-space derivatives == derivative per texel; store per unit uv
    o = vec4(h, dFdx(h) * uSize, dFdy(h) * uSize, a);
  }
}`;
