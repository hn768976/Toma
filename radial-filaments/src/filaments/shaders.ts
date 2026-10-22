// GLSL (WebGL 2) for the filament strands, the floor glow and the backdrop.
//
// Every strand is a ribbon whose centre line is computed on the GPU from a
// few per-strand constants and the loop phase. All time-dependent terms use
// whole-cycle frequencies of `uPhase` (0..1), so the animation loops
// seamlessly over the composition.

const NOISE = /* glsl */ `
#define TAU 6.28318530718
uniform float uPhase;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453123); }
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return s;
}
// Loop-safe noise: the sample point travels around a small circle.
float loopFbm(vec2 p, float cycles, float radius) {
  float a = uPhase * TAU * cycles;
  return fbm(p + radius * vec2(cos(a), sin(a)));
}
`;

const PALETTE = /* glsl */ `
uniform vec3 uColDeep;
uniform vec3 uColMid;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColHot;
uniform float uHueSpin; // whole turns of the core tint per loop

vec3 coreTint(vec2 p) {
  float ang = atan(p.y, p.x);
  float bands = 0.5 + 0.5 * sin(ang + uPhase * TAU * uHueSpin + 1.5708 + 2.6 * loopFbm(p * 1.3, 1.0, 0.4));
  return mix(uColA, uColB, smoothstep(0.2, 0.8, bands));
}

vec3 filamentColor(vec2 p, float r, float variation) {
  vec3 c = mix(uColDeep, uColMid, exp(-r * 0.3));
  vec3 tint = coreTint(p);
  c = mix(c, tint, clamp(exp(-r * 0.75) * 1.3, 0.0, 1.0));
  c = mix(c, mix(uColA, uColB, variation), 0.15);
  c = mix(c, uColHot, exp(-r * 4.0) * 0.45);
  return c;
}
`;

export const STRAND_VERTEX = /* glsl */ `
${NOISE}
${PALETTE}

uniform vec2 uRes;
uniform float uWidth;     // ribbon width in world units
uniform float uMinPx;     // never thinner than this many pixels
uniform float uHump;      // height of the central mound
uniform float uWave;      // vertical undulation amplitude
uniform float uTurb;      // tangential turbulence amplitude

in vec4 aStrand;  // base angle, seed, start radius, end radius
in vec2 aParam;   // t along strand (0..1), side (-1 | 1)

out float vSide;
out vec3 vColor;
out float vAlpha;

vec2 warpOffset(vec2 p, float r, float seed) {
  float ph = uPhase * TAU;
  float a = atan(p.y, p.x);
  // Shared flow field: neighbouring strands bend together, like combed hair.
  float w = 0.0;
  w += 0.16 * sin(dot(p, vec2(1.7, 0.6)) + ph);
  w += 0.12 * sin(dot(p, vec2(-0.8, 2.3)) - ph);
  w += 0.08 * sin(dot(p, vec2(2.9, -1.9)) + ph * 2.0);
  w += 0.14 * loopFbm(p * 0.6 + 3.1, 1.0, 0.25);
  w += 0.08 * loopFbm(p * 1.1 + 8.4, 1.0, 0.25);
  // Sinuous ripples running outward along the strands.
  w += 0.12 * smoothstep(0.5, 2.0, r) * sin(r * 3.6 - ph * 2.0 + a * 3.0);
  // A little individuality per strand.
  w += 0.16 * loopFbm(vec2(r * 1.3, seed * 0.37), 1.0, 0.2);
  // Fine jitter so strands read crisp and electric.
  w += 0.025 * loopFbm(vec2(r * 7.0, seed * 0.53), 1.0, 0.25);
  // Tight turbulence around the core.
  float knot = exp(-r * 1.4);
  w += knot * 0.5 * loopFbm(p * 3.5 + seed * 0.07, 1.0, 0.35);

  float h = 0.0;
  h += 0.5 * loopFbm(p * 2.6 + 7.7, 1.0, 0.3);
  h += 0.12 * sin(r * 5.0 - ph * 2.0 + a * 3.0 + 2.0 * loopFbm(p * 0.8, 1.0, 0.2));
  h += 0.25 * loopFbm(vec2(r * 2.5, seed * 0.29), 1.0, 0.25);
  return vec2(w * uTurb, h);
}

vec3 strandPos(float t, out float r, out vec2 p) {
  float a = aStrand.x;
  float seed = aStrand.y;
  r = mix(aStrand.z, aStrand.w, t);
  vec2 base = vec2(cos(a), sin(a)) * r;
  vec2 o = warpOffset(base, r, seed);
  float amp = mix(0.45, 1.0, smoothstep(0.0, 2.0, r));
  float ang = a + o.x * amp / max(r, 0.25);
  p = vec2(cos(ang), sin(ang)) * r;
  float y = uHump * exp(-r * r * 0.18) + uWave * o.y * smoothstep(0.0, 1.0, r);
  return vec3(p.x, y, p.y);
}

void main() {
  float t = aParam.x;
  float side = aParam.y;
  float r;
  vec2 p;
  float r2;
  vec2 p2;
  float r0;
  vec2 p0;
  vec3 P = strandPos(t, r, p);
  // A wide central difference gives a slowly turning ribbon normal (like a
  // calligraphy brush), so tight screen-space bends never fold the ribbon.
  vec3 Pa = strandPos(max(t - 0.035, 0.0), r0, p0);
  vec3 Pb = strandPos(min(t + 0.035, 1.0), r2, p2);

  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(Pa, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(Pb, 1.0);
  vec2 dir = (cb.xy / cb.w - ca.xy / ca.w) * uRes * 0.5;
  dir = length(dir) > 1e-4 ? normalize(dir) : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // Projected width; clamp to a pixel minimum and conserve energy.
  // Strands vary in thickness and thin out where they converge at the core.
  float widthVar = mix(0.55, 1.6, hash11(aStrand.y * 3.77)) * mix(0.4, 1.0, smoothstep(0.0, 2.5, r));
  float px = uWidth * widthVar * projectionMatrix[1][1] * uRes.y * 0.5 / max(c1.w, 1e-3);
  float wpx = max(px, uMinPx);
  float energy = px / wpx;

  // Quad spans +-2 sigma of the gaussian profile.
  c1.xy += nrm * side * wpx * 2.0 * 2.0 / uRes * c1.w;
  gl_Position = c1;
  vSide = side * 2.0;

  float seed = aStrand.y;
  float rnd = hash11(seed * 0.731 + 1.3);
  float bright = mix(0.15, 1.0, rnd * rnd);
  float ends = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.75, 1.0, t));
  float falloff = 0.42 * exp(-r * 0.2) + 0.75 * exp(-r * 1.0);

  // Sparks gliding outward along some strands (whole cycles per loop).
  float spark = 0.0;
  if (rnd > 0.85) {
    float u = fract(r * 0.4 - uPhase + hash11(seed * 1.37));
    spark = exp(-pow((u - 0.5) * 10.0, 2.0)) * 1.2;
  }

  vColor = filamentColor(p, r, hash11(seed * 2.11));
  vAlpha = (bright * falloff + spark * falloff * 0.6) * ends * energy;
}
`;

export const STRAND_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uIntensity;
in float vSide;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  float g = exp(-0.5 * vSide * vSide);
  outColor = vec4(vColor * g * vAlpha * uIntensity, 1.0);
}
`;

// Soft emissive floor under the strands.
export const FLOOR_VERTEX = /* glsl */ `
out vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FLOOR_FRAGMENT = /* glsl */ `
precision highp float;
${NOISE}
${PALETTE}
uniform float uFloor;
in vec2 vP;
out vec4 outColor;
void main() {
  vec2 p = vec2(vP.x, -vP.y); // local plane -> world xz
  float r = length(p);
  vec3 c = mix(uColMid, coreTint(p), exp(-r * 0.6));
  float e = 0.05 * exp(-r * 0.45) + 0.5 * exp(-r * 1.4);
  vec3 col = c * e * uFloor;
  // Hot spot where all strands converge.
  col += mix(uColA, uColHot, 0.6) * (exp(-r * 14.0) * 5.0 + exp(-r * 6.0) * 2.2 + exp(-r * 2.2) * 0.25);
  outColor = vec4(col, 1.0);
}
`;

// Full-screen backdrop: night gradient, haze column and core bloom.
export const BACKDROP_VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BACKDROP_FRAGMENT = /* glsl */ `
precision highp float;
${NOISE}
${PALETTE}
uniform vec3 uBgTop;
uniform vec3 uBgHorizon;
uniform vec2 uCore;    // core position in uv
uniform float uAspect;
uniform float uHaze;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 d = vUv - uCore;
  d.x *= uAspect;
  vec3 col = mix(uBgHorizon, uBgTop, smoothstep(-0.15, 0.5, d.y));
  // Faint light column rising from the core.
  float above = max(d.y, 0.0);
  float rays = 0.6 + 0.4 * loopFbm(vec2(d.x * 28.0, above * 2.0), 1.0, 0.6);
  float column = exp(-abs(d.x) * 7.0) * exp(-above * 3.2) * rays;
  col += mix(uColMid, uColA, 0.35) * column * 0.2 * uHaze;
  // Core bloom.
  float rr = length(d * vec2(1.0, 1.6));
  col += mix(uColA, uColHot, 0.4) * exp(-rr * 18.0) * 0.45 * uHaze;
  col += uColMid * exp(-rr * 4.5) * 0.05 * uHaze;
  outColor = vec4(col, 1.0);
}
`;

// Hue-preserving tone map from the HDR scene buffer.
export const POST_VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const POST_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform float uWhiteMix;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(tScene, vUv).rgb;
  float peak = max(max(c.r, c.g), c.b);
  vec3 hue = c / max(peak, 1e-5);
  float mapped = 1.0 - exp(-peak);
  vec3 col = hue * mapped;
  // Only the very hottest values bleach towards white.
  col = mix(col, vec3(mapped), smoothstep(1.2, 5.0, peak) * uWhiteMix);
  // Gentle vignette.
  vec2 q = vUv;
  col *= 0.78 + 0.22 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.25);
  outColor = vec4(col, 1.0);
}
`;
