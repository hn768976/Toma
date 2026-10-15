// Shared GLSL chunks. Pixi 8 adds "#version 300 es" and precision itself.

export const QUAD_VERT = /* glsl */ `
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

/** Integer hashes and gradient noise. Pure functions of their inputs. */
export const NOISE = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33u(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967295.0); }
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  vec3 a = fract(p.xyx * vec3(123.34, 234.34, 345.65));
  a += dot(a, a + 34.45);
  return fract(vec2(a.x * a.y, a.y * a.z));
}
// 2D gradient noise, roughly [-1, 1]
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 ga = hash22(i) * 2.0 - 1.0;
  vec2 gb = hash22(i + vec2(1, 0)) * 2.0 - 1.0;
  vec2 gc = hash22(i + vec2(0, 1)) * 2.0 - 1.0;
  vec2 gd = hash22(i + vec2(1, 1)) * 2.0 - 1.0;
  float a = dot(ga, f), b = dot(gb, f - vec2(1, 0));
  float c = dot(gc, f - vec2(0, 1)), d = dot(gd, f - vec2(1, 1));
  return 1.6 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * gnoise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}
float ridged(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * (1.0 - abs(gnoise(p)));
    p = r * p * 2.1 + 3.7;
    a *= 0.5;
  }
  return s;
}
`;

/**
 * Final-pass finishing: grain + ±1/255 triangular dither, both faded to zero
 * below ~3% luminance so blacks stay exactly black. uFrameMod is the frame
 * index modulo the composition's loop length.
 */
export const FINISH = /* glsl */ `
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 finishColor(vec3 c, float frameMod, float grainAmt) {
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float gate = smoothstep(0.03, 0.06, l);
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(frameMod) + 7919u));
  vec3 r = vec3(h) * (1.0 / 4294967295.0);
  float grain = (r.x - 0.5) * 2.0 * grainAmt;
  float dither = (r.y + r.z - 1.0) / 255.0;
  return clamp(c + gate * (grain + dither), 0.0, 1.0);
}
`;
