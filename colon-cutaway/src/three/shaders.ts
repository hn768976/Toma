// Shared GLSL. Written GLSL1-style (three.js compiles it as GLSL ES 3.0, so
// texelFetch etc. are available).

export const HASH = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
`;

export const NOISE = /* glsl */ `
${HASH}
// value noise from a seeded, tiling 32^3 texture (one trilinear fetch; far
// cheaper than hashing on a CPU rasteriser)
uniform highp sampler3D uNoise3D;
float vnoise(vec3 p) {
  // smoothstep-remapped lookup: C1-continuous (no facets in bump maps)
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return texture(uNoise3D, (i + f + 0.5) * (1.0 / 32.0)).r;
}
float fbm3(vec3 p) {
  return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.15 * vnoise(p * 4.01 + 3.7);
}
`;

// Cut heightfield: z of the cut surface for a model-space xy (manual bilinear
// on a float texture, so no float-linear-filtering extension is needed).
export const CUT = /* glsl */ `
uniform sampler2D uHF;
uniform vec4 uHFRect;
uniform float uHFRes;
float cutZ(vec2 xy) {
  vec2 g = (xy - uHFRect.xy) / uHFRect.zw * uHFRes - 0.5;
  vec2 i = floor(g);
  vec2 f = g - i;
  float m = uHFRes - 1.0;
  ivec2 a = ivec2(clamp(i, vec2(0.0), vec2(m)));
  ivec2 b = ivec2(clamp(i + 1.0, vec2(0.0), vec2(m)));
  float z00 = texelFetch(uHF, ivec2(a.x, a.y), 0).r;
  float z10 = texelFetch(uHF, ivec2(b.x, a.y), 0).r;
  float z01 = texelFetch(uHF, ivec2(a.x, b.y), 0).r;
  float z11 = texelFetch(uHF, ivec2(b.x, b.y), 0).r;
  return mix(mix(z00, z10, f.x), mix(z01, z11, f.x), f.y);
}
`;

export const LIGHTS = /* glsl */ `
uniform vec3 uCamPos;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uFillDir;
uniform vec3 uFillCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;

float wrapd(vec3 N, vec3 L, float w) {
  return max(0.0, (dot(N, L) + w) / (1.0 + w));
}

// Soft, clinical shading: wrapped diffuse from three lights, hemispheric
// ambient, a Blinn highlight from the key, and a Fresnel rim.
vec3 shade(vec3 albedo, vec3 N, vec3 V, float wrap, float specAmt, float shin,
           float rimAmt, vec3 rimTint, vec3 sssTint) {
  float kd = wrapd(N, uKeyDir, wrap);
  vec3 c = albedo * uKeyCol * kd;
  // fake subsurface: warm, saturated light bleeding into the terminator band
  float nl = dot(N, uKeyDir);
  float band = smoothstep(-wrap, 0.15, nl) * (1.0 - smoothstep(0.15, 0.7, nl));
  c += uKeyCol * sssTint * band * 0.35;
  c += albedo * uFillCol * wrapd(N, uFillDir, wrap);
  c += albedo * uRimCol * wrapd(N, uRimDir, wrap * 0.5);
  c += albedo * mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5);
  vec3 H = normalize(uKeyDir + V);
  c += uKeyCol * specAmt * pow(max(dot(N, H), 0.0), shin) * smoothstep(0.0, 0.2, nl);
  vec3 H2 = normalize(uFillDir + V);
  c += uFillCol * specAmt * 0.5 * pow(max(dot(N, H2), 0.0), shin);
  float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  c += rimTint * rimAmt * fr;
  return c;
}

// Bump mapping from screen-space derivatives of a height (three.js style).
vec3 bumpNormal(vec3 surfPos, vec3 N, float h, float scale) {
  vec2 dH = vec2(dFdx(h), dFdy(h)) * scale;
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, N);
  vec3 r2 = cross(N, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  vec3 r = abs(det) * N - grad;
  float l = length(r);
  return l > 1e-12 ? r / l : N;
}
`;

// ---------------------------------------------------------------- colon wall
// Every piece of the wall is the same shell, pushed inward along its normals by
// offset * wallThickness: 0 = outer surface, 1 = inner surface (lining).
export const WALL_VERT = /* glsl */ `
attribute float aWall;
attribute float aSide;
attribute vec3 aUTB;
attribute vec3 aOffN;
attribute vec2 aSW;
uniform float uOffA;
uniform float uOffB;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vUTB;
varying float vSide;
varying vec3 vOffN;
varying vec2 vSW;
void main() {
  vOffN = normalize(mat3(modelMatrix) * aOffN);
  vSW = aSW;
  float off = mix(uOffA, uOffB, aSide);
  vec3 p = position - aOffN * aWall * off;
  vPos = (modelMatrix * vec4(p, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUTB = aUTB;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}
`;

// stencil-only pass: just the clip
export const STENCIL_FRAG = /* glsl */ `
${CUT}
varying vec3 vPos;
void main() {
  if (vPos.z > cutZ(vPos.xy)) discard;
  gl_FragColor = vec4(0.0);
}
`;

export const MAX_PATCHES = 8;

// outer wall: salmon pink, wrap lighting, soft Fresnel rim, faint mottling
const OUTER_FN = /* glsl */ `
uniform vec3 uWallCol;
vec3 outerShade(vec3 Ngeo, vec3 V) {
  float h = fbm3(vPos * 3.2) * 0.6 + vnoise(vPos * 11.0) * 0.25;
  vec3 N = bumpNormal(vPos, Ngeo, h, 0.012);
  vec3 albedo = uWallCol * (0.94 + 0.12 * vnoise(vPos * 1.7));
  return shade(albedo, N, V, 0.55, 0.22, 28.0, 0.42, vec3(1.0, 0.78, 0.74), vec3(0.9, 0.18, 0.12));
}
`;

// inner lining: cream, haustral folds, fine folds, inflamed patches + shimmer
const LINING_FN = /* glsl */ `
#define MAX_PATCHES ${MAX_PATCHES}
uniform vec3 uLiningCol;
uniform vec3 uInflamedCol;
uniform float uLength;
uniform float uHaustra;
uniform vec4 uPatch[MAX_PATCHES];   // u, theta, half-length (units), half-angle
uniform vec2 uPatchState[MAX_PATCHES]; // inflammation 0..1, shimmer 0..1
uniform float uPatchCount;

float patchMask(int i, out float rad) {
  vec4 P = uPatch[i];
  float du = (vUTB.x - P.x) * uLength / P.z;
  float dt = (vUTB.y - P.y) / P.w;
  float n = fbm3(vec3(vUTB.x * uLength * 2.2, vUTB.y * 2.0, float(i) * 3.1));
  rad = length(vec2(du, dt)) + (n - 0.5) * 0.45;
  return 1.0 - smoothstep(0.6, 1.05, rad);
}

vec3 liningShade(vec3 N0, vec3 V) {
  float s = vUTB.x * uLength;
  // haustral pouches: lighter in the middle, soft fold between
  float ph = fract(s / uHaustra);
  float fold = exp(-pow((ph - 0.5) / 0.09, 2.0));
  float pouch = 1.0 - fold;
  // fine circumferential folds + mottling
  float fine = vnoise(vec3(s * 9.0, vUTB.y * 3.0, 0.0)) * 0.6 + vnoise(vPos * 14.0) * 0.4;

  float infl = 0.0;
  float shimmer = 0.0;
  for (int i = 0; i < MAX_PATCHES; i++) {
    if (float(i) >= uPatchCount) break;
    float rad;
    float m = patchMask(i, rad);
    infl = max(infl, m * uPatchState[i].x);
    // cool shimmer: a ring sweeping outward over the patch as it heals
    float sw = uPatchState[i].y;
    float ring = exp(-pow((rad - sw * 1.4) / 0.18, 2.0)) * sin(3.14159 * sw);
    shimmer = max(shimmer, ring * smoothstep(1.4, 0.6, rad));
  }

  // swollen: broad soft bumps rather than grit
  float h = -fold * 0.9 + fine * 0.35 + infl * (vnoise(vPos * 4.5) * 1.5 + vnoise(vPos * 10.0) * 0.35);
  vec3 N = bumpNormal(vPos, N0, h, 0.03 + infl * 0.03);
  // deeper toward the back of the half-pipe, a little darker up the sides
  float cav = mix(0.72, 1.0, pow(max(cos(vUTB.y), 0.0), 0.6));
  vec3 albedo = uLiningCol * (0.88 + 0.14 * pouch) * (0.95 + 0.08 * vnoise(vPos * 2.3)) * cav;
  // pink rim -> deep red core
  vec3 irritated = vec3(0.78, 0.36, 0.3);
  albedo = mix(albedo, irritated, smoothstep(0.0, 0.3, infl));
  albedo = mix(albedo, uInflamedCol * (0.85 + 0.3 * vnoise(vPos * 3.0)), smoothstep(0.25, 0.8, infl));
  vec3 c = shade(albedo, N, V, 0.6, 0.16 + infl * 0.15, 22.0, 0.12, vec3(1.0, 0.92, 0.82), vec3(0.55, 0.3, 0.15));
  // inflamed glow (warm, faint) and the cool healing shimmer
  c += vec3(1.0, 0.1, 0.05) * infl * (0.22 + 0.08 * vnoise(vPos * 4.0));
  c += vec3(0.45, 0.85, 1.0) * shimmer * 0.55;
  return c;
}
`;

const WALL_VARYINGS = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vUTB;
varying vec3 vOffN;
varying vec2 vSW;
`;

export const OUTER_FRAG = /* glsl */ `
${CUT}
${NOISE}
${LIGHTS}
${WALL_VARYINGS}
${OUTER_FN}
void main() {
  if (vPos.z > cutZ(vPos.xy)) discard;
  vec3 V = normalize(uCamPos - vPos);
  gl_FragColor = vec4(outerShade(normalize(vNormal), V), 1.0);
}
`;

export const LINING_FRAG = /* glsl */ `
${CUT}
${NOISE}
${LIGHTS}
${WALL_VARYINGS}
${LINING_FN}
void main() {
  if (vPos.z > cutZ(vPos.xy)) discard;
  vec3 V = normalize(uCamPos - vPos);
  // inner surface: the lumen side faces away from the stored normal
  // (blend toward the smoothed normal so creases in the source mesh soften)
  vec3 N0 = -normalize(mix(normalize(vNormal), vOffN, 0.6));
  gl_FragColor = vec4(liningShade(N0, V), 1.0);
}
`;

// Pre-cut model (wall already modelled): one mesh, three looks blended by
// vSW.x = normal . radial direction (+1 outer wall, 0 cut rim, -1 lining) and
// vSW.y = position across the wall (0 at the lining, 1 at the outside).
export const PRECUT_FRAG = /* glsl */ `
${NOISE}
${LIGHTS}
${WALL_VARYINGS}
${OUTER_FN}
${LINING_FN}
uniform vec3 uCapCol;
uniform vec3 uLineCol;
uniform float uLiningEdge;
uniform float uLineEdge;
void main() {
  vec3 V = normalize(uCamPos - vPos);
  vec3 Ng = normalize(vNormal);
  // vSW.x: -1 lining ... 0 middle of the cut rim ... +1 outer wall (smooth field)
  float s = vSW.x;
  float aa = fwidth(s) * 0.75 + 1e-4;
  float kIn = 1.0 - smoothstep(uLiningEdge - aa, uLiningEdge + aa, s);
  float kOut = smoothstep(0.55, 0.8, s);
  float kRim = max(0.0, 1.0 - kOut - kIn);
  // All three looks are evaluated for every fragment (no branches): they use
  // screen-space derivatives, which are undefined in divergent control flow
  // and would make results depend on what the rasteriser ran before.
  vec3 cOut = outerShade(Ng, V);
  vec3 cIn = liningShade(normalize(mix(Ng, vOffN, 0.4)), V);
  // cut face: pink, with a thin cream line along its inner edge
  float line = 1.0 - smoothstep(uLineEdge - aa, uLineEdge + aa, s);
  vec3 col = mix(uCapCol, uLineCol, line);
  vec3 Nr = bumpNormal(vPos, Ng, vnoise(vPos * 18.0), 0.004);
  vec3 cRim = shade(col, Nr, V, 0.7, 0.06, 14.0, 0.25, vec3(1.0, 0.8, 0.75), vec3(0.0));
  vec3 c = kOut * cOut + kIn * cIn + kRim * cRim;
  if (any(isnan(c)) || any(isinf(c))) c = uCapCol * 0.5;
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}
`;

// open-end ring (only if the model has open boundaries): cut-face colours
export const RING_FRAG = /* glsl */ `
${CUT}
${LIGHTS}
uniform vec3 uCapCol;
uniform vec3 uLineCol;
uniform float uLineFrac;
varying vec3 vPos;
varying vec3 vNormal;
varying float vSide;
void main() {
  if (vPos.z > cutZ(vPos.xy)) discard;
  vec3 V = normalize(uCamPos - vPos);
  vec3 col = vSide > 1.0 - uLineFrac ? uLineCol : uCapCol;
  vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));
  if (dot(N, V) < 0.0) N = -N;
  gl_FragColor = vec4(shade(col, N, V, 0.6, 0.05, 12.0, 0.0, vec3(0.0), vec3(0.0)), 1.0);
}
`;

// ---------------------------------------------------------------- cut cap
export const CAP_VERT = /* glsl */ `
${CUT}
varying vec3 vPos;
void main() {
  vec3 p = vec3(position.xy, cutZ(position.xy));
  vPos = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
}
`;

export const CAP_FRAG = /* glsl */ `
${NOISE}
${LIGHTS}
uniform vec3 uCapCol;
varying vec3 vPos;
void main() {
  vec3 V = normalize(uCamPos - vPos);
  vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));
  if (dot(N, V) < 0.0) N = -N;
  float h = vnoise(vPos * 18.0);
  N = bumpNormal(vPos, N, h, 0.004);
  vec3 c = shade(uCapCol, N, V, 0.7, 0.06, 14.0, 0.0, vec3(0.0), vec3(0.0));
  gl_FragColor = vec4(c, 1.0);
}
`;

// ---------------------------------------------------------------- particles
// Per-instance: instanceColor (rgb), aInst = (alpha, emissive, seed, unused)
export const PART_VERT = /* glsl */ `
attribute vec4 aInst;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vCol;
varying vec4 vInst;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vPos = wp.xyz;
  vNormal = normalize(mat3(m) * normal);
  vObj = position;
  vCol = instanceColor;
  vInst = aInst;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const MOLECULE_FRAG = /* glsl */ `
${LIGHTS}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vCol;
varying vec4 vInst;
void main() {
  if (vInst.x <= 0.002) discard;
  vec3 V = normalize(uCamPos - vPos);
  vec3 N = normalize(vNormal);
  vec3 c = shade(vCol, N, V, 0.4, 0.55, 60.0, 0.5, vCol * 0.6 + 0.3, vec3(0.0));
  c += vCol * vInst.y;
  gl_FragColor = vec4(c, vInst.x);
}
`;

export const BACTERIA_FRAG = /* glsl */ `
${NOISE}
${LIGHTS}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vCol;
varying vec4 vInst;
void main() {
  if (vInst.x <= 0.002) discard;
  vec3 V = normalize(uCamPos - vPos);
  float h = vnoise(vObj * 9.0 + vInst.z * 17.0) + 0.4 * vnoise(vObj * 21.0);
  vec3 N = bumpNormal(vPos, normalize(vNormal), h, 0.05);
  float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  vec3 core = vCol * (0.75 + 0.25 * vnoise(vObj * 5.0 + vInst.z * 9.0));
  vec3 c = shade(core, N, V, 0.6, 0.35, 40.0, 0.9, vCol * 0.5 + 0.45, vCol * 0.3);
  c += vCol * vInst.y;
  float a = mix(0.62, 0.96, fr) * vInst.x;
  gl_FragColor = vec4(c, a);
}
`;

export const CLUMP_FRAG = /* glsl */ `
${NOISE}
${LIGHTS}
uniform vec3 uClumpCol;
uniform vec3 uClumpHigh;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vObj;
varying vec4 vInst;
void main() {
  if (vInst.x <= 0.002) discard;
  vec3 V = normalize(uCamPos - vPos);
  vec3 o = vObj + vInst.z * 13.0;
  float h = fbm3(o * 6.0) + 0.35 * vnoise(o * 19.0);
  vec3 N = bumpNormal(vPos, normalize(vNormal), h, 0.05);
  float high = smoothstep(0.55, 0.98, length(vObj)) * (0.6 + 0.4 * vnoise(o * 4.0));
  vec3 albedo = mix(uClumpCol, uClumpHigh, high) * (0.85 + 0.3 * vnoise(o * 8.0));
  vec3 c = shade(albedo, N, V, 0.3, 0.1, 12.0, 0.14, vec3(0.55, 0.5, 0.48), vec3(0.0));
  gl_FragColor = vec4(c, vInst.x);
}
`;

export const SPIKE_FRAG = /* glsl */ `
${LIGHTS}
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vCol;
varying vec4 vInst;
void main() {
  if (vInst.x <= 0.002) discard;
  vec3 V = normalize(uCamPos - vPos);
  vec3 N = normalize(vNormal);
  vec3 c = shade(vCol, N, V, 0.5, 0.4, 30.0, 0.6, vec3(1.0, 0.5, 0.3), vec3(0.0));
  c += vCol * vInst.y;
  gl_FragColor = vec4(c, vInst.x);
}
`;
