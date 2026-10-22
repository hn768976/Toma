/**
 * Procedural satellite terrain: desert valley, braided river wash, mountain
 * ranges, a gridded town and a centre-pivot farming district, evaluated
 * analytically in world space.
 *
 * The full terrain function is expensive (hillshaded multi-octave noise), so
 * it is baked once into two luminance textures by the TerrainBake-* stills
 * (`npm run bake`): a regional texture and a high-detail texture around the
 * farm district. The per-frame VIEW shader samples those textures through the
 * perspective camera and adds the HUD grid, scan lens, grade and grain.
 */

// World bounds of the baked textures: [minX, minY, maxX, maxY].
export const WIDE_BOUNDS = [-80, -60, 80, 60] as const;
export const CLOSE_BOUNDS = [-12, -9, 12, 9] as const;
export const BAKE_SIZE = { wide: [6144, 4608], close: [6144, 4608] } as const;

const LIB = /* glsl */ `
// ---------------------------------------------------------------- noise
uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
float hash21(vec2 p) {
  ivec2 i = ivec2(floor(p));
  uint h = hashu(uint(i.x) * 1597334677u ^ hashu(uint(i.y) + 0x9e3779b9u));
  return float(h) / 4294967295.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Octave count adapts to the pixel footprint so detail appears as we zoom
// in and distant terrain doesn't alias.
float fbm(vec2 p, float px, int maxOct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i >= maxOct) break;
    float fade = clamp(1.6 - px * 2.0, 0.0, 1.0);
    s += a * (vnoise(p) - 0.5) * (i < 2 ? 1.0 : fade);
    n += a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3;
    px *= 2.0;
    a *= 0.5;
  }
  return 0.5 + s / n;
}
float ridged(vec2 p, float px, int maxOct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= maxOct) break;
    float fade = clamp(1.6 - px * 2.0, 0.0, 1.0);
    float r = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    s += a * r * r * (i < 2 ? 1.0 : fade);
    n += a;
    p = mat2(1.7, 1.1, -1.1, 1.7) * p + 9.1;
    px *= 2.0;
    a *= 0.5;
  }
  return s / n;
}
float aaStep(float edge, float x, float w) {
  return smoothstep(edge - w, edge + w, x);
}

// ---------------------------------------------------------------- features
// River centreline y(x): a wandering wash crossing the valley.
float riverY(float x) {
  return -6.0 + 0.16 * x + 2.6 * sin(x * 0.09 + 0.6) + 1.1 * sin(x * 0.23 + 2.0)
    + 3.0 * (vnoise(vec2(x * 0.06, 4.2)) - 0.5) + 0.8 * (vnoise(vec2(x * 0.3, 8.7)) - 0.5);
}

// Mountain height field (0 on the valley floor).
float mtnMaskAt(vec2 p, float px) {
  vec2 warp = vec2(vnoise(p * 0.03), vnoise(p * 0.03 + 9.0)) - 0.5;
  vec2 q = p + warp * 18.0;
  float valley = abs(p.y - riverY(p.x) + 2.0);
  float m = smoothstep(0.48, 0.64, fbm(q * 0.045 + 4.0, px * 0.045, 4)) * smoothstep(8.0, 22.0, valley);
  float massif = smoothstep(9.0, 3.0, length((p - vec2(-22.0, -21.0)) * vec2(0.8, 1.2)) + 6.0 * (vnoise(p * 0.2) - 0.5));
  float north = smoothstep(9.0, 3.0, length((p - vec2(-14.0, 22.0)) * vec2(0.6, 1.0)) + 5.0 * (vnoise(p * 0.18 + 3.0) - 0.5));
  return max(m, max(massif, north));
}
float heightAt(vec2 p, float px) {
  float m = mtnMaskAt(p, px);
  float r = ridged(p * 0.16, px * 0.16, 8);
  return m * (0.3 + 1.4 * r * r) + 0.15 * fbm(p * 0.4, px * 0.4, 5);
}

// Hand-laid fields around the main pivot cluster (cell size 1.6).
// Codes: 0 bare/light, 1 dark pivot, 2 dark square, 3 half pivot,
// 4 textured mid, 5 small dark pivot, 6 dark pivot with light wedge.
int fieldCode(ivec2 c) {
  // Rows from top (j = 3) to bottom (j = -3), columns i = -5..5.
  const int W = 11;
  const int rows[77] = int[77](
    0,4,0,1,0,0,1,5,0,0,0,
    0,0,4,0,0,4,1,0,0,0,0,
    0,4,0,1,4,2,2,5,0,1,0,
    4,0,0,4,5,2,0,5,4,0,0,
    0,0,4,5,6,2,5,4,0,0,4,
    0,4,1,1,1,4,1,0,4,0,0,
    0,0,0,4,0,0,4,0,0,0,0
  );
  int i = c.x + 5, j = 3 - c.y;
  if (i < 0 || i >= W || j < 0 || j > 6) return -1;
  return rows[j * W + i];
}

// Returns field luminance, or -1 outside the farm district.
float farm(vec2 p, float px, float farmMask) {
  float cell = 1.6;
  vec2 g = p / cell;
  ivec2 c = ivec2(floor(g));
  vec2 f = fract(g) - 0.5; // -0.5..0.5 within cell
  float rnd = hash21(vec2(c) + 31.0);
  float rnd2 = hash21(vec2(c) * 1.7 + 5.0);
  int code = fieldCode(c);
  if (code < 0) {
    // Procedural fields further out: mostly bare, the odd pivot.
    float dens = 0.12 * farmMask;
    code = rnd < dens ? (rnd2 < 0.5 ? 1 : 5) : (rnd2 < 0.5 ? 0 : 4);
  }
  float w = px / cell;
  float d = length(f);
  // Bare soil base with plough striping.
  float stripe = 0.5 + 0.5 * sin((rnd2 > 0.5 ? f.x : f.y) * 90.0);
  float soil = 0.62 + 0.3 * (fbm(p * 1.5, px * 1.5, 7) - 0.5) + 0.1 * (rnd - 0.5) + 0.08 * (fbm(p * 12.0, px * 12.0, 4) - 0.5);
  soil += 0.05 * stripe * clamp(1.0 - w * 40.0, 0.0, 1.0);
  float lum = soil;
  if (code == 4) lum = 0.46 + 0.16 * rnd + 0.1 * stripe * clamp(1.0 - w * 30.0, 0.0, 1.0);
  float darkCrop = 0.05 + 0.1 * fbm(p * 2.5, px * 2.5, 5) + 0.04 * rnd2;
  // Faint wheel-track rings on pivots.
  float rings = 0.012 * sin(d * 120.0) * clamp(1.0 - w * 60.0, 0.0, 1.0);
  if (code == 1 || code == 5 || code == 6 || code == 3) {
    float r = code == 5 ? 0.36 : 0.47;
    float inside = 1.0 - aaStep(r, d, w * 1.2);
    float crop = darkCrop + rings;
    if (code == 3) inside *= aaStep(0.0, f.x * (rnd > 0.5 ? 1.0 : -1.0), w);
    if (code == 6) {
      float a = atan(f.y, f.x);
      crop = mix(crop, 0.34, step(0.0, sin(a * 1.0 + 1.2)) * 0.6);
    }
    lum = mix(lum, crop, inside);
    // Pivot centre point.
    lum = mix(lum, 0.8, (1.0 - aaStep(0.012, d, w)) * inside);
  } else if (code == 2) {
    vec2 q = abs(f) - 0.36;
    float sd = length(max(q, 0.0)) - 0.1;
    lum = mix(lum, darkCrop + rings, 1.0 - aaStep(0.0, sd, w));
  }
  // Farmsteads: small buildings in some corners.
  vec2 corner = f - vec2(0.38, -0.38) * sign(vec2(rnd - 0.5, rnd2 - 0.5));
  vec2 bq = abs(corner) - vec2(0.05, 0.03);
  float bd = length(max(bq, 0.0));
  float bmask = (hash21(vec2(c) + 77.0) > 0.55) ? 1.0 - aaStep(0.0, bd, w) : 0.0;
  lum = mix(lum, rnd > 0.5 ? 0.95 : 0.15, bmask * 0.9);
  // Regional blotches that ignore field boundaries.
  lum += 0.2 * (fbm(p * 0.35 + 8.0, px * 0.35, 5) - 0.5);
  // Section roads between fields.
  vec2 e = 0.5 - abs(f);
  float road = 1.0 - aaStep(0.012, min(e.x, e.y), w);
  lum = mix(lum, 0.84, road * 0.6);
  return lum;
}

float town(vec2 p, float px) {
  // Fine street grid with random block brightness.
  float blk = 0.22;
  vec2 g = p / blk;
  vec2 f = fract(g) - 0.5;
  float r = hash21(floor(g) + 3.0);
  float w = px / blk;
  float street = 1.0 - aaStep(0.07, min(0.5 - abs(f.x), 0.5 - abs(f.y)), w);
  float lum = 0.45 + 0.3 * r;
  // Small structures inside blocks.
  vec2 sub = fract(g * 3.0) - 0.5;
  lum += 0.15 * (step(0.25, abs(sub.x)) - 0.5) * clamp(1.0 - w * 6.0, 0.0, 1.0);
  return mix(lum, 0.92, street);
}

float terrain(vec2 p, float px) {
  float dRiver = p.y - riverY(p.x);

  // --- valley floor albedo
  float big = fbm(p * 0.05, px * 0.05, 4);
  float lum = 0.62 + 0.18 * (big - 0.5);
  float sand = smoothstep(0.5, 0.72, fbm(p * 0.11 + 7.0, px * 0.11, 5));
  lum = mix(lum, 0.86, sand * 0.6);
  lum += 0.22 * (fbm(p * 1.1, px * 1.1, 7) - 0.5);
  lum += 0.08 * (fbm(p * 0.3 + 21.0, px * 0.3, 6) - 0.5);
  lum += 0.17 * (fbm(p * 5.0, px * 5.0, 6) - 0.5);
  lum += 0.1 * (fbm(p * 14.0, px * 14.0, 5) - 0.5);
  // Dry gullies: thin bright dendritic channels.
  vec2 gq = p * 0.7 + vec2(fbm(p * 0.3, px * 0.3, 3), fbm(p * 0.3 + 5.0, px * 0.3, 3)) * 3.0;
  float gul = 1.0 - abs(vnoise(gq) * 2.0 - 1.0);
  float gul2 = 1.0 - abs(vnoise(gq * 2.3 + 11.0) * 2.0 - 1.0);
  float gw = clamp(px * 6.0, 0.02, 0.2);
  float gmask = smoothstep(0.45, 0.7, vnoise(p * 0.08 + 2.0));
  lum += gmask * (0.09 * smoothstep(1.0 - gw * 1.2, 1.0, gul) + 0.05 * smoothstep(1.0 - gw * 2.0, 1.0, gul2));
  // Scrub and structures: sparse dark/bright specks.
  float spk = hash21(floor(p * 18.0));
  float spkFade = clamp(1.0 - px * 12.0, 0.0, 1.0);
  lum += spkFade * (spk > 0.996 ? -0.2 : (spk < 0.004 ? 0.15 : 0.0));

  // --- mountains with hillshade
  float e = max(px, 0.02);
  float h0 = heightAt(p, px);
  float hx = heightAt(p + vec2(e, 0.0), px);
  float hy = heightAt(p + vec2(0.0, e), px);
  vec3 n = normalize(vec3((h0 - hx) / e, (h0 - hy) / e, 0.55));
  float shade = clamp(dot(n, normalize(vec3(-0.6, 0.5, 0.6))), 0.0, 1.0);
  float m = mtnMaskAt(p, px);
  float mtnLum = 0.07 + 0.95 * pow(shade, 1.6) + 0.25 * smoothstep(1.1, 1.6, h0);
  // Floor also gets subtle relief from the low-amplitude part of the height.
  lum *= 0.82 + 0.3 * shade;
  lum = mix(lum, mtnLum, smoothstep(0.15, 0.5, m));

  // --- braided river wash
  float wwidth = 1.0 + 0.9 * vnoise(vec2(p.x * 0.08, 1.0));
  float braid = fbm(vec2(p.x * 0.3, dRiver * 2.2), px * 2.2, 6);
  float off = dRiver + (braid - 0.5) * 1.4;
  float wash = 1.0 - smoothstep(wwidth * 0.5, wwidth * 1.5, abs(off));
  float channels = smoothstep(0.5, 0.6, fbm(vec2(p.x * 0.5, dRiver * 4.0) + 3.0, px * 4.0, 6));
  lum = mix(lum, 0.95 - 0.12 * channels, wash * 0.85);
  // Green-belt shadow just outside the wash.
  lum -= 0.12 * (smoothstep(wwidth * 1.3, wwidth * 1.8, abs(off)) - smoothstep(wwidth * 1.8, wwidth * 3.0, abs(off)));

  // --- town north-west of the farms
  vec2 tp = p - vec2(-9.0, 7.0);
  float tmask = 1.0 - smoothstep(4.5, 8.0, length(tp * vec2(0.7, 1.0)) + 3.0 * (fbm(p * 0.25, px * 0.25, 4) - 0.5));
  tmask *= smoothstep(0.0, 2.0, dRiver);
  lum = mix(lum, town(p, px), tmask * 0.8);

  // --- farm district
  float fmask = 1.0 - smoothstep(8.5, 12.5, length(p * vec2(0.75, 1.0)) + 3.0 * (fbm(p * 0.15 + 3.0, px * 0.15, 3) - 0.5));
  fmask *= smoothstep(-0.5, 1.0, dRiver);
  if (fmask > 0.001) {
    lum = mix(lum, farm(p, px, fmask), fmask);
  }

  // --- highway / rail and desert tracks
  float hd = abs(dot(p - vec2(1.0, 5.6), normalize(vec2(0.42, 1.0))));
  lum = mix(lum, 0.28, (1.0 - aaStep(0.035, hd, px)) * 0.7);
  lum = mix(lum, 0.92, (1.0 - aaStep(0.012, abs(hd - 0.16), px)) * 0.6);
  float t1 = abs(dot(p - vec2(-30.0, 10.0), normalize(vec2(0.25, 1.0))));
  lum = mix(lum, 0.85, (1.0 - aaStep(0.03, t1, px)) * 0.4 * (1.0 - fmask) * (1.0 - m));
  float t2 = abs(p.x - 14.0 + 0.3 * p.y);
  lum = mix(lum, 0.82, (1.0 - aaStep(0.03, t2, px)) * 0.35 * step(p.y, 4.0) * (1.0 - fmask) * (1.0 - m));
  return clamp(lum, 0.0, 1.0);
}

`;

export const BAKE_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform vec4 uBounds;
out vec4 outColor;
const float K = 0.5358983848622454;
${LIB}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // Image rows run top-down, so flip y: texture v = 0 is the max-y edge.
  vec2 p = vec2(mix(uBounds.x, uBounds.z, uv.x), mix(uBounds.y, uBounds.w, uv.y));
  float px = (uBounds.z - uBounds.x) / uResolution.x;
  float l = terrain(p, px);
  outColor = vec4(vec3(l), 1.0);
}
`;

export const VIEW_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform vec3 uCamP, uCamF, uCamR, uCamU;
uniform float uTime;
uniform sampler2D uWide, uClose;
uniform vec4 uWideB, uCloseB;
uniform vec3 uShadow, uMid, uLight, uHaze;
uniform vec3 uGridColor;
uniform float uGridAlpha, uGridPeriod;
uniform vec2 uLensC;
uniform float uLensR, uLensReveal, uLensAlpha, uSweep;
uniform vec3 uLensTint;
uniform float uExposure, uVignette;

out vec4 outColor;
const float K = 0.5358983848622454;

uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return x;
}
float hash21(vec2 p) {
  ivec2 i = ivec2(floor(p));
  uint h = hashu(uint(i.x) * 1597334677u ^ hashu(uint(i.y) + 0x9e3779b9u));
  return float(h) / 4294967295.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, float px, int maxOct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= maxOct) break;
    s += a * (vnoise(p) - 0.5);
    n += a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.3;
    a *= 0.5;
  }
  return 0.5 + s / n;
}
float aaStep(float edge, float x, float w) {
  return smoothstep(edge - w, edge + w, x);
}
vec2 texUV(vec2 p, vec4 b) {
  return vec2((p.x - b.x) / (b.z - b.x), (b.w - p.y) / (b.w - b.y));
}

float sampleTerrain(vec2 p, float px) {
  vec2 uw = texUV(p, uWideB);
  float lw = texture(uWide, uw).r;
  vec2 uc = texUV(p, uCloseB);
  float closeTexel = (uCloseB.z - uCloseB.x) / ${BAKE_SIZE.close[0]}.0;
  float wideTexel = (uWideB.z - uWideB.x) / ${BAKE_SIZE.wide[0]}.0;
  float inside = smoothstep(0.0, 0.03, min(min(uc.x, 1.0 - uc.x), min(uc.y, 1.0 - uc.y)));
  float useClose = inside * smoothstep(wideTexel * 1.2, wideTexel * 0.6, px);
  float l = lw;
  if (useClose > 0.0) l = mix(lw, texture(uClose, uc).r, useClose);
  // Sub-texel grain so extreme close-ups keep some tooth.
  float fine = (vnoise(p * 260.0) - 0.5) * 0.05 * smoothstep(closeTexel * 1.5, closeTexel * 0.5, px);
  float outside = 1.0 - smoothstep(0.0, 0.02, min(min(uw.x, 1.0 - uw.x), min(uw.y, 1.0 - uw.y)));
  return mix(l + fine, 0.55, outside);
}

vec3 grade(float l) {
  l = clamp(l * uExposure, 0.0, 1.0);
  l = mix(l, l * l * (3.0 - 2.0 * l), 0.45); // S-curve contrast
  vec3 c = l < 0.5 ? mix(uShadow, uMid, l * 2.0) : mix(uMid, uLight, l * 2.0 - 1.0);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y; // y up
  vec3 dir = normalize(uCamF + (uv.x * uCamR + uv.y * uCamU) * K);
  float t = -uCamP.z / min(dir.z, -1e-4);
  vec2 p = (uCamP + dir * t).xy;
  // World size of one pixel at this point (grazing angle accounted for).
  float px = t * K / uResolution.y / max(-dir.z, 0.2);

  float l = sampleTerrain(p, px);

  // World-space HUD grid printed on the ground.
  vec2 gq = abs(fract(p / uGridPeriod + 0.5) - 0.5) * uGridPeriod;
  float gl = 1.0 - aaStep(px * 0.7, min(gq.x, gq.y), px * 0.5);
  vec3 col = grade(l);
  // Atmospheric haze with distance (matters for oblique views).
  float tCenter = -uCamP.z / uCamF.z;
  float haze = smoothstep(1.4, 3.2, t / tCenter);
  col = mix(col, uHaze, haze * 0.75);
  col = mix(col, uGridColor, gl * uGridAlpha);

  // ---- scan lens
  vec2 sp = vec2(frag.x, uResolution.y - frag.y) / uResolution.y; // y down, height units
  vec2 lc = uLensC * vec2(uResolution.x / uResolution.y, 1.0);
  vec2 dv = sp - lc;
  float r = length(dv);
  float pxs = 1.0 / uResolution.y;
  if (uLensAlpha > 0.0) {
    // angle measured clockwise from 12 o'clock, 0..1
    float ang = fract(atan(dv.x, -dv.y) / 6.2831853 + 1.0);
    float rev = 1.0 - aaStep(uLensReveal, ang, 0.01);
    if (uLensReveal >= 1.0) rev = 1.0;
    float rIn = uLensR, rOut = uLensR * 1.2;
    // Frosted ring: terrain pushed toward white with soft, noisy edges.
    float n = fbm(dv * 40.0 + 3.0, 0.0, 4);
    float ring = smoothstep(rIn - 0.004, rIn + 0.002, r) * (1.0 - smoothstep(rOut - 0.02 - 0.015 * n, rOut + 0.004, r));
    vec3 frost = mix(col, vec3(0.93, 0.96, 0.98), 0.72 + 0.18 * (n - 0.5));
    frost += 0.04 * (fbm(p * 1.5, px, 3) - 0.5);
    // Interior: brightened and tinted.
    float inner = 1.0 - smoothstep(rIn - 0.002, rIn + 0.002, r);
    vec3 tinted = mix(col, col * uLensTint * 1.05 + 0.05, 0.75);
    // Radar sweep wedge trailing the sweep angle.
    float sa = atan(dv.x, -dv.y);
    float rel = fract((uSweep - sa) / 6.2831853);
    float wedge = (1.0 - smoothstep(0.0, 0.16, rel)) * step(0.0, rel);
    tinted = mix(tinted, tinted * 1.18 + vec3(0.03, 0.05, 0.04), wedge * 0.8);
    float edge = 1.0 - smoothstep(0.0, pxs * 1.5, abs(rel * 6.2831853 * r));
    tinted = mix(tinted, vec3(0.92, 0.97, 0.95), edge * 0.35);
    vec3 lensCol = mix(col, tinted, inner);
    lensCol = mix(lensCol, frost, ring);
    // Outer bloom.
    float bloom = exp(-pow((r - rOut) / 0.05, 2.0)) * 0.12;
    lensCol += bloom;
    col = mix(col, lensCol, uLensAlpha * rev);
  }

  // Vignette and slight top haze like a long-lens satellite pass.
  vec2 vn = frag / uResolution - 0.5;
  float vig = 1.0 - uVignette * dot(vn * vec2(1.1, 1.3), vn * vec2(1.1, 1.3)) * 2.2;
  col *= vig;
  // Gentle film grain (stable per frame).
  float gr = hash21(frag + floor(uTime * 30.0) * 17.0) - 0.5;
  col += gr * 0.018;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
