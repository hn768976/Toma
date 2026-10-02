import * as THREE from 'three';

// --------------------------------------------------------------------------
// PCSS soft shadows. Same technique as drei's <SoftShadows> (Vogel-disk PCSS,
// MIT, @N8Programs), but patched into the shader chunk at module load so the
// very first frame a worker renders already uses it. drei patches in an effect,
// which runs after @remotion/three has rendered the frame, so a cold-started
// frame would differ from the same frame inside a sequence.
// The per-pixel rotation comes from gl_FragCoord only: no time, no randomness.
// --------------------------------------------------------------------------
const PCSS_SIZE = 22;
const PCSS_SAMPLES = 24;
// Minimum filter radius in shadow-map texels: the extrusion is thin, so pure
// contact-hardening would give an almost hard shadow; the studio look is soft.
const PCSS_MIN_RADIUS = 14;
const pcss = `
#define PENUMBRA_FILTER_SIZE float(${PCSS_SIZE})
vec3 pcssRandRGB(vec2 uv) {
  return vec3(
    fract(sin(dot(uv, vec2(12.75613, 38.12123))) * 13234.76575),
    fract(sin(dot(uv, vec2(19.45531, 58.46547))) * 43678.23431),
    fract(sin(dot(uv, vec2(23.67817, 78.23121))) * 93567.23423));
}
vec3 pcssHighPass(vec2 uv) {
  vec3 lp = vec3(0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) lp += pcssRandRGB(uv + vec2(x, y));
  return pcssRandRGB(uv) - lp / 9.0 + 0.5;
}
vec2 pcssVogel(int i, int n, float angle) {
  float r = sqrt(float(i) + 0.5) / sqrt(float(n));
  float t = float(i) * 2.399963 + angle;
  return vec2(cos(t), sin(t)) * r;
}
float pcssBlocker(sampler2D shadowMap, vec2 uv, float compare, float angle) {
  float texel = 1.0 / float(textureSize(shadowMap, 0).x);
  float sum = 0.0; float n = 0.0;
  for (int i = 0; i < ${PCSS_SAMPLES}; i++) {
    vec2 o = pcssVogel(i, ${PCSS_SAMPLES}, angle) * texel * (2.0 * PENUMBRA_FILTER_SIZE + ${PCSS_MIN_RADIUS}.0);
    float d = unpackRGBAToDepth(texture2D(shadowMap, uv + o));
    if (d < compare) { sum += d; n += 1.0; }
  }
  return n > 0.0 ? sum / n : -1.0;
}
float pcssFilter(sampler2D shadowMap, vec2 uv, float zr, float radius, float angle) {
  float texel = 1.0 / float(textureSize(shadowMap, 0).x);
  float s = 0.0;
  for (int i = 0; i < ${PCSS_SAMPLES}; i++) {
    vec2 o = pcssVogel(i, ${PCSS_SAMPLES}, angle) * texel * (${PCSS_MIN_RADIUS}.0 + radius * PENUMBRA_FILTER_SIZE);
    s += step(zr, unpackRGBAToDepth(texture2D(shadowMap, uv + o)));
  }
  return s / float(${PCSS_SAMPLES});
}
float PCSS(sampler2D shadowMap, vec4 coords) {
  float angle = pcssHighPass(gl_FragCoord.xy).r * PI2;
  float blocker = pcssBlocker(shadowMap, coords.xy, coords.z, angle);
  if (blocker == -1.0) return 1.0;
  float penumbra = (coords.z - blocker) / blocker;
  return pcssFilter(shadowMap, coords.xy, coords.z, 1.25 * penumbra, angle);
}
`;

let patched = false;
export const patchSoftShadows = () => {
  if (patched) return;
  patched = true;
  const original = THREE.ShaderChunk.shadowmap_pars_fragment;
  const start = original.lastIndexOf('float getShadow( sampler2D shadowMap');
  const marker = 'if ( frustumTest ) {';
  const end = original.indexOf(marker, start) + marker.length;
  if (start < 0 || end < marker.length) throw new Error('PCSS: shadow chunk layout changed');
  const hasIntensity = original.slice(start, end).includes('shadowIntensity');
  const ret = hasIntensity ? 'return mix( 1.0, PCSS( shadowMap, shadowCoord ), shadowIntensity );' : 'return PCSS( shadowMap, shadowCoord );';
  THREE.ShaderChunk.shadowmap_pars_fragment = (original.slice(0, end) + '\n' + ret + original.slice(end)).replace(
    '#ifdef USE_SHADOWMAP',
    '#ifdef USE_SHADOWMAP\n' + pcss,
  );
};
patchSoftShadows();

// --------------------------------------------------------------------------
// Floor: unlit, display-referred (alpha 0 = "do not tonemap" for the post pass).
// Grid and dotted world map are procedural in world units, so they look the
// same at 720p and 4K and stay anti-aliased into the distance.
// --------------------------------------------------------------------------
export const floorVertex = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const floorFragment = /* glsl */ `
precision highp float;
in vec3 vWorld;
out highp vec4 fragColor;
uniform vec3 uBase;          // display sRGB
uniform vec3 uHaze;          // display sRGB
uniform vec3 uCamPos;
uniform float uHazeStart;
uniform float uHazeEnd;
uniform float uFade;         // 0..1 grid+dots fade-in
uniform sampler2D uDots;     // land mask, one texel per dot
uniform vec2 uDotsSize;      // cols, rows
uniform float uDegStep;      // degrees per dot
uniform vec2 uMapOrigin;     // lon/lat at world (0,0)
uniform float uUnitsPerDeg;
uniform float uDotRadius;    // world
uniform float uDotDarken;
uniform float uMajor;        // grid spacing (world)
uniform float uMinor;
uniform float uMajorWidth;
uniform float uMinorWidth;
uniform float uMajorAlpha;
uniform float uMinorAlpha;
uniform float uDepthDim;     // slight darkening toward the camera

float gridCoverage(vec2 p, float spacing, float width) {
  vec2 d = abs(fract(p / spacing + 0.5) - 0.5) * spacing; // distance to nearest line
  vec2 aa = max(fwidth(p), vec2(1e-6));
  vec2 w = max(vec2(width * 0.5), aa * 0.5);
  vec2 cov = clamp((w - d) / aa + 0.5, 0.0, 1.0) * min(vec2(1.0), (width * 0.5) / w); // energy-preserving when sub-pixel
  return max(cov.x, cov.y);
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void main() {
  vec2 p = vWorld.xz;
  float dist = length(uCamPos - vWorld);
  vec3 col = uBase;
  // gentle large-scale light: a touch darker toward the camera
  col *= 1.0 - uDepthDim * smoothstep(-2.0, 8.0, p.y);

  // dotted world map (lon wraps; north = -z)
  float lon = uMapOrigin.x + p.x / uUnitsPerDeg;
  float lat = uMapOrigin.y - p.y / uUnitsPerDeg;
  vec2 cellF = vec2((lon + 180.0) / uDegStep, (90.0 - lat) / uDegStep);
  vec2 cell = floor(cellF);
  float dots = 0.0;
  if (cell.y >= 0.0 && cell.y < uDotsSize.y) {
    float cx = mod(cell.x, uDotsSize.x);
    float land = texelFetch(uDots, ivec2(int(cx), int(cell.y)), 0).r;
    vec2 local = (fract(cellF) - 0.5) * uDegStep * uUnitsPerDeg; // world offset from dot centre
    float aa = max(length(fwidth(p)), 1e-6);
    float d = length(local);
    float cov = clamp((uDotRadius - d) / aa + 0.5, 0.0, 1.0);
    float spacing = uDegStep * uUnitsPerDeg;
    float avg = 3.14159 * uDotRadius * uDotRadius / (spacing * spacing);
    cov = mix(cov, avg, smoothstep(0.25 * spacing, 0.7 * spacing, aa));
    dots = land * cov;
  }
  col *= 1.0 - uDotDarken * dots * uFade;

  float major = gridCoverage(p, uMajor, uMajorWidth) * uMajorAlpha;
  float minor = gridCoverage(p, uMinor, uMinorWidth) * uMinorAlpha;
  col = mix(col, vec3(1.0), max(major, minor) * uFade);

  col = mix(col, uHaze, smoothstep(uHazeStart, uHazeEnd, dist));
  fragColor = vec4(srgbToLinear(col), 0.0);
}`;

// --------------------------------------------------------------------------
// Final pass: depth of field (gather, CoC from depth), ACES tonemap for lit
// surfaces (alpha 1) and pass-through for display-referred ones (alpha 0),
// light flare, then dither ±1/255 and grain from an integer hash of pixel +
// frame. GLSL3 for uint hashing.
// --------------------------------------------------------------------------
export const postVertex = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const postFragment = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out highp vec4 fragColor;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uFocusNear;
uniform float uFocusFar;
uniform float uFarRange;
uniform float uNearRange;
uniform float uMaxCoc;       // pixels
uniform float uExposure;
uniform float uFrame;
uniform float uFlare;
uniform vec2 uFlarePos;      // uv
uniform float uGrain;
uniform float uVignette;

#define TAPS 40

float viewDist(vec2 uv) {
  float d = texture(tDepth, uv).r;
  float z = (uNear * uFar) / ((uFar - uNear) * d - uFar); // view-space z (negative)
  return -z;
}
float coc(float dist) {
  float far = smoothstep(uFocusFar, uFocusFar + uFarRange, dist);
  float near = smoothstep(uFocusNear, uFocusNear - uNearRange, dist) * 0.5;
  return uMaxCoc * max(far, near);
}

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = IN * color;
  color = RRTAndODTFit(color);
  color = OUT * color;
  return clamp(color, 0.0, 1.0);
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash01(uvec3 p) {
  return float(pcg(p.x ^ pcg(p.y ^ pcg(p.z)))) / 4294967295.0;
}

void main() {
  vec2 px = 1.0 / uRes;
  vec4 center = texture(tColor, vUv);
  float cDist = viewDist(vUv);
  float cCoc = coc(cDist);
  vec4 acc = center;
  float wsum = 1.0;
  if (cCoc > 0.35) {
    for (int i = 0; i < TAPS; i++) {
      float r = sqrt(float(i) + 0.5) / sqrt(float(TAPS));
      float t = float(i) * 2.399963;
      vec2 o = vec2(cos(t), sin(t)) * r * uMaxCoc;
      vec2 uv = vUv + o * px;
      float sCoc = coc(viewDist(uv));
      // A sample contributes if its own blur (capped by ours, so the far floor
      // never bleeds over the sharp shape) reaches this pixel.
      float w = clamp(min(sCoc, cCoc) - r * uMaxCoc + 1.0, 0.0, 1.0);
      acc += texture(tColor, uv) * w;
      wsum += w;
    }
  }
  vec4 c = acc / wsum;

  vec3 lit = aces(c.rgb);
  vec3 lin = mix(c.rgb, lit, clamp(c.a, 0.0, 1.0));
  vec3 col = linearToSrgb(lin);

  // soft light flare at the top centre (display space, screen blend)
  vec2 d = (vUv - uFlarePos) * vec2(uRes.x / uRes.y, 1.0);
  float core = exp(-dot(d / vec2(0.11, 0.08), d / vec2(0.11, 0.08)));
  float glow = exp(-dot(d / vec2(0.36, 0.26), d / vec2(0.36, 0.26)));
  float wide = exp(-dot(d / vec2(0.9, 0.55), d / vec2(0.9, 0.55)));
  float streak = exp(-pow(d.y / 0.02, 2.0)) * exp(-pow(d.x / 0.6, 2.0));
  float flare = clamp((core * 1.0 + glow * 0.5 + wide * 0.2 + streak * 0.2) * uFlare, 0.0, 1.0);
  col = 1.0 - (1.0 - col) * (1.0 - flare);

  // very light vignette
  vec2 v = vUv - 0.5;
  col *= 1.0 - uVignette * dot(v, v);

  // dither (TPDF, ±1/255) + grain, a fixed function of pixel and frame
  uvec3 seed = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(uFrame) * 2u);
  float h1 = hash01(seed);
  float h2 = hash01(seed + uvec3(0u, 0u, 1u));
  float h3 = hash01(seed + uvec3(7919u, 104729u, 0u));
  float dither = (h1 + h2 - 1.0) / 255.0;
  float grain = (h3 - 0.5) * 2.0 * uGrain;
  col += dither + grain;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// --------------------------------------------------------------------------
// Glint on the shape's top face: a soft diagonal band swept once.
// --------------------------------------------------------------------------
export const addGlint = (material: THREE.MeshPhysicalMaterial, uniforms: {uGlintPos: {value: number}; uGlintStrength: {value: number}}) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlintPos = uniforms.uGlintPos;
    shader.uniforms.uGlintStrength = uniforms.uGlintStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uGlintPos;\nuniform float uGlintStrength;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `{
          float gs = vMapUv.x * 0.8 + (1.0 - vMapUv.y) * 0.6;
          float gb = exp(-pow((gs - uGlintPos) / 0.07, 2.0));
          outgoingLight += vec3(1.0, 0.985, 0.96) * gb * uGlintStrength;
          // faint grey studio sheen (soft overhead reflection), stronger at grazing angles
          float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
          outgoingLight += vec3(0.93, 0.95, 1.0) * (0.11 + 0.08 * fres);
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'glint';
};
