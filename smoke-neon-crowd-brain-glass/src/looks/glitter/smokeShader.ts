/**
 * Smoke field — GLSL ES 3.00 for a PixiJS 8 Mesh.
 *
 * Flow: everything sweeps around an off-screen centre C (lower left). Noise is
 * sampled in polar coordinates with the angle folded M = 4 times, so the field
 * is exactly periodic under a 90° rotation. Each layer rotates by a whole
 * number of 90° sectors over the 600-frame loop → frame 600 ≡ frame 0, and the
 * motion is a real, continuous curving sweep (not a back-and-forth wobble).
 * Domain warping is applied to (r, φ) so it stays periodic too.
 */
export const SMOKE_VERT = /* glsl */ `#version 300 es
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

export const SMOKE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;

uniform float uT;          // loop phase 0..1
uniform float uAspect;
uniform float uMode;       // 0 = colour, 1 = density only (for CPU read-back)
uniform vec3 uSmoke;
uniform vec3 uSmokeEdge;
uniform vec3 uBgDeep;
uniform vec2 uCenter;      // flow centre in screen-height units (y up, origin at frame centre)

const float M = 4.0;
const float TAU = 6.28318530718;

// --- 3D simplex noise (Stefan Gustavson / Ashima Arts, MIT) ---
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

float fbm(vec3 q, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * snoise(q);
    q = q * 2.03 + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  return s;
}

// polar, M-fold periodic noise coordinate. fa: frequency along the flow, fr: across it.
vec3 pol(float r, float phi, float fa, float fr, float seed) {
  float rho = r * fa / M;
  return vec3(rho * cos(M * phi), rho * sin(M * phi), r * fr + seed);
}

void main() {
  vec2 p = vec2((vUV.x - 0.5) * uAspect, 0.5 - vUV.y);
  vec2 d = p - uCenter;
  float r = length(d);
  float phi = atan(d.y, d.x);
  float a = TAU / M * uT;      // one 90° sector per loop

  // domain warp (rotates two sectors per loop → morphs against the main flow)
  vec3 qw = pol(r, phi - 2.0 * a, 1.3, 1.6, 0.0);
  vec2 w = vec2(fbm(qw, 3), fbm(qw + vec3(5.2, 1.3, 7.7), 3));
  float r2 = r + 0.09 * w.y;
  float ph2 = phi + 0.12 * w.x / max(r, 0.3);

  // big curving body of smoke: an arc band around the flow centre
  float body = fbm(pol(r2, ph2 - a, 1.1, 2.0, 3.1), 4);
  float band = exp(-pow((r2 - 0.95) / 0.5, 2.0)) + 0.1 * exp(-pow((r2 - 2.0) / 0.28, 2.0));
  float m = smoothstep(-0.35, 0.55, body) * band;
  // fine hair-like fibres along the flow (low along-flow, very high across-flow frequency)
  float fib = 0.5 + 0.5 * fbm(pol(r2 + 0.03 * body, ph2 - a, 1.6, 34.0, 9.0), 5);
  // curling wisps (faster: two sectors per loop), thin filaments in the gaps
  float wisp = fbm(pol(r2 + 0.04 * body, ph2 - 2.0 * a, 2.2, 11.0, 21.0), 4);
  float fil = pow(clamp(1.0 - abs(wisp) * 3.2, 0.0, 1.0), 5.0);
  // faint veil (counter-rotating) for depth
  float veil = smoothstep(-0.1, 0.7, fbm(pol(r, phi + a, 0.8, 1.1, 40.0), 3));

  float fibK = pow(fib, 1.6);
  float dens = m * (0.35 + 0.9 * fibK) + 0.24 * fil * (0.08 + band) * smoothstep(-0.3, 0.3, body) + 0.06 * veil * (0.3 + band);
  dens = clamp(dens, 0.0, 1.0);

  if (uMode > 0.5) {
    finalColor = vec4(dens, dens, dens, 1.0);
    return;
  }

  // brighter edges of the mass / fibres, dark gaps between
  float edge = m * (1.0 - m) * 4.0;
  vec3 col = uSmoke * dens * 1.25;
  col += uSmokeEdge * (0.22 * edge * fibK + 0.18 * m * m * fibK + 0.12 * fil * band);
  // background: near-black with deep blue, a touch lighter low-left
  float g = clamp(0.6 - 0.35 * p.y - 0.18 * p.x, 0.0, 1.0);
  vec3 bg = uBgDeep * (0.55 + 0.6 * g);
  vec3 c = bg + col * 0.85;
  // soft filmic shoulder so dense smoke never clips
  c = 1.0 - exp(-c * 1.15);
  finalColor = vec4(c, 1.0);
}
`;

export const GRAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uFrame;
uniform float uGrain;
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float h3(uvec3 p) { return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967296.0; }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
  float g = h3(p) + h3(p + uvec3(0u, 0u, 7919u)) - 1.0;
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb += g * uGrain * (0.35 + 0.65 * sqrt(clamp(lum, 0.0, 1.0)));
  float d = h3(p + uvec3(13u, 29u, 104729u)) + h3(p + uvec3(71u, 3u, 1299709u)) - 1.0;
  c.rgb += d / 255.0;
  finalColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);
}
`;

export const GRAIN_VERT = /* glsl */ `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;
