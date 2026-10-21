// Shared GLSL (WebGL2 / GLSL ES 3.00). Coordinates: P is centred, in units of
// frame height, y up (P.y in [-0.5, 0.5], P.x in [-0.889, 0.889] at 16:9).

export const VERTEX = /* glsl */ `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const COMMON = /* glsl */ `
precision highp float;
precision highp int;
out vec4 outColor;
uniform vec2 uRes;
uniform float uFrame;
#define PI 3.14159265359
#define TAU 6.28318530718

vec2 frameP() { return (gl_FragCoord.xy / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0); }
vec2 frameUV() { return gl_FragCoord.xy / uRes; }
float pxSize() { return 1.0 / uRes.y; }
float aspect() { return uRes.x / uRes.y; }

// Integer hashes (PCG) - identical on every GPU/driver.
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash1(uint x) { return float(pcg(x)) * (1.0 / 4294967295.0); }
float hash2(uvec2 p, uint s) { return hash1(p.x + pcg(p.y + pcg(s))); }

// 4D simplex noise (after Stefan Gustavson / Ashima Arts, MIT).
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
float permute(float x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}
float snoise(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(v + dot(v, vec4(0.309016994374947451)));
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
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(
      i.w + vec4(i1.w, i2.w, i3.w, 1.0))
    + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
    + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
    + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4, p4));
  vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2)))
               + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}

// Noise sampled on a time circle: repeats exactly every 600 frames.
vec2 loopCircle(float radius, float seed) {
  float a = TAU * mod(uFrame, 600.0) / 600.0;
  return vec2(cos(a), sin(a)) * radius + vec2(seed * 7.13, seed * 3.71);
}
float nLoop(vec2 p, float radius, float seed) {
  return snoise(vec4(p, loopCircle(radius, seed)));
}
float fbmLoop(vec2 p, float radius, float seed, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * nLoop(p, radius, seed + float(i) * 1.37);
    n += a;
    p = p * 2.03 + vec2(1.7, -2.3);
    a *= 0.5;
  }
  return s / n;
}
// Non-looping fbm (for the burn clips): w is time.
float fbm4(vec3 p, float w, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * snoise(vec4(p, w));
    n += a;
    p = p * 2.07 + vec3(1.3, -0.7, 2.1);
    w *= 1.31;
    a *= 0.5;
  }
  return s / n;
}

// Frame-pair key: floor(frame / 2) mod 300.
uint pairKey() { return uint(mod(floor(uFrame / 2.0), 300.0)); }

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
`;

// Final pass: read the half-float buffer, add +-1/255 blue-noise dither only
// where the pixel is above 2% (and below 98%, so pure white stays 255).
export const FINAL_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D uSrc;
uniform sampler2D uBlue;
uniform float uDitherLo;
uniform float uDitherHi;
out vec4 outColor;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 c = clamp(texelFetch(uSrc, ip, 0).rgb, 0.0, 1.0);
  float m = max(c.r, max(c.g, c.b));
  float n = texelFetch(uBlue, ip & 63, 0).r;
  float d = (n - 0.5) * (2.0 / 255.0);
  float on = step(uDitherLo, m) * (1.0 - step(uDitherHi, min(c.r, min(c.g, c.b))));
  c = clamp(c + d * on, 0.0, 1.0);
  outColor = vec4(c, 1.0);
}
`;
