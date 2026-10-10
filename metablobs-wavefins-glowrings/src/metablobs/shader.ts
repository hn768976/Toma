import { BLOB_COUNT } from "./blobs";
import { NOISE_GLSL } from "../common/glsl";

// Pass 1: raymarch the smooth-union blob field into a linear HDR target.
export const BLOBS_FRAG = /* glsl */ `
#define NB ${BLOB_COUNT}
#define MAXC 12
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform vec4 uBlobs[NB];      // xyz centre, w radius
uniform float uCamZ;
uniform float uTanHalf;
uniform float uK;              // smooth-union radius
uniform int uMode;             // 0 = neon, 1 = white matte
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uBg;
uniform vec3 uBgCentre;
uniform float uGlow;           // glow halo strength (neon)

int cand[MAXC];
int nc;

float sminp(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Field restricted to the blobs whose (inflated) bounding sphere this ray touches.
// A blob it misses is > k away along the whole ray, so it cannot change the
// smooth union anywhere near the surface: skipping it is exact, not an approximation.
float mapC(vec3 p) {
  float d = 1e5;
  for (int j = 0; j < MAXC; j++) {
    if (j >= nc) break;
    vec4 b = uBlobs[cand[j]];
    d = sminp(d, length(p - b.xyz) - b.w, uK);
  }
  return d;
}

// Full field (all blobs) -- only used for the 4 AO taps.
float mapAll(vec3 p) {
  float d = 1e5;
  for (int j = 0; j < NB; j++) {
    vec4 b = uBlobs[j];
    d = sminp(d, length(p - b.xyz) - b.w, uK);
  }
  return d;
}

vec3 normalAt(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapC(p + k.xyy * e) + k.yyx * mapC(p + k.yyx * e) +
                   k.yxy * mapC(p + k.yxy * e) + k.xxx * mapC(p + k.xxx * e));
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float w = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.06 + 0.11 * float(i);
    occ += (h - mapAll(p + n * h)) * w;
    w *= 0.6;
  }
  return clamp(1.0 - 1.4 * occ, 0.0, 1.0);
}

vec3 shade(vec3 p, vec3 rd, float t) {
  vec3 n = normalAt(p, 0.0015 * t);
  vec3 v = -rd;
  float ao = ambientOcclusion(p, n);
  float nv = clamp(dot(n, v), 0.0, 1.0);
  float f = 1.0 - nv;
  if (uMode == 0) {
    vec3 LA = normalize(vec3(-0.75, 0.62, 0.42)); // colour A: upper left
    vec3 LB = normalize(vec3(0.92, -0.30, 0.30)); // colour B: right
    float wa = dot(n, LA);
    float wb = dot(n, LB);
    // broad half-and-half split: A on the upper-left side, B on the right
    float m = smoothstep(-0.45, 0.75, wb - wa);
    vec3 base = mix(uColA, uColB, m);
    float lit = 0.5 + 0.5 * clamp(max(wa, wb) * 0.7 + 0.45, 0.0, 1.0);
    vec3 col = base * lit * (0.6 + 0.4 * ao);
    // soft pale sheen on the camera-facing body, widest where the colours meet
    float sheen = smoothstep(0.25, 1.0, nv);
    col = mix(col, vec3(0.40, 0.38, 0.56) * (0.6 + 0.4 * ao), 0.5 * sheen);
    // fresnel rim, brighter in colour A
    col += uColA * pow(f, 2.6) * 0.9;
    // far blobs sit slightly darker, so the depth layering reads
    col *= mix(1.0, 0.72, smoothstep(9.0, 14.5, t));
    return col;
  }
  // White matte / porcelain
  vec3 L = normalize(vec3(-0.6, 0.7, 0.55));
  float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
  float light = clamp(0.1 + 1.1 * diff, 0.0, 1.0) * mix(0.4, 1.0, ao);
  // rounder volume: grey toward the silhouette and underside, near-white in the middle
  light *= mix(1.0, 0.55, pow(f, 1.6));
  vec3 col = mix(uColB, uColA, light);
  col += vec3(0.07) * pow(nv, 3.0) * diff;  // soft pearly sheen
  // thin translucent rim: a slightly darker grey line just inside the silhouette,
  // and a brighter band just inside that
  float band = smoothstep(0.62, 0.78, f) * (1.0 - smoothstep(0.8, 0.9, f));
  float line = smoothstep(0.88, 0.985, f);
  col += vec3(0.03) * band;
  col = mix(col, uColB * 0.95, line * 0.25);
  // depth fog: distant blobs fade toward the background
  float fog = smoothstep(7.5, 13.5, t) * 0.55;
  return mix(col, uBg, fog);
}

void main() {
  vec2 ndc = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 ro = vec3(0.0, 0.0, uCamZ);
  vec3 rd = normalize(vec3(ndc.x * aspect * uTanHalf, ndc.y * uTanHalf, -1.0));
  float pix = 2.0 * uTanHalf / uRes.y; // pixel footprint per unit distance

  // Background
  vec3 bg;
  if (uMode == 0) {
    bg = uBg;
  } else {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    bg = mix(uBg, uBgCentre, exp(-dot(q, q) / (2.0 * 0.42 * 0.42)));
    bg *= 1.0 - 0.06 * smoothstep(0.4, 1.0, length(q));
  }

  // Per-ray culling: collect blobs whose bounding sphere (r + k) the ray touches;
  // also the analytic glow distance (closest approach, in frame-height units).
  nc = 0;
  float tNear = 1e5;
  float tFar = 0.0;
  float glowScr = 1e5;
  for (int i = 0; i < NB; i++) {
    vec4 b = uBlobs[i];
    vec3 oc = ro - b.xyz;
    float tb = -dot(oc, rd);
    if (tb <= 0.0) continue;
    vec3 cl = oc + rd * tb;
    float dc = length(cl);
    glowScr = min(glowScr, max(dc - b.w, 0.0) / (tb * 2.0 * uTanHalf));
    float R = b.w + uK + 0.05;
    if (dc < R && nc < MAXC) {
      float hh = sqrt(R * R - dc * dc);
      tNear = min(tNear, tb - hh);
      tFar = max(tFar, tb + hh);
      cand[nc] = i;
      nc++;
    }
  }

  vec3 col = bg;
  if (uMode == 0) {
    // Soft glow halo in colour A, ~4% of frame height wide, cut to exactly zero
    // beyond 4.5% so blobs wrapping outside the frame never pop.
    float g = exp(-glowScr / 0.0075) * (1.0 - smoothstep(0.025, 0.045, glowScr));
    col += uColA * g * uGlow;
  }

  if (nc > 0) {
    float t = max(tNear, 0.0);
    float minRatio = 1e5;
    float tMin = t;
    bool hit = false;
    for (int s = 0; s < 96; s++) {
      vec3 p = ro + rd * t;
      float d = mapC(p);
      float ratio = d / t;
      if (ratio < minRatio) { minRatio = ratio; tMin = t; }
      if (d < 0.35 * pix * t) { hit = true; break; }
      t += d;
      if (t > tFar) break;
    }
    if (hit) {
      col = shade(ro + rd * t, rd, t);
    } else if (minRatio < pix) {
      // Silhouette anti-aliasing: shade the closest approach and blend by coverage.
      float cov = 1.0 - clamp(minRatio / pix, 0.0, 1.0);
      col = mix(col, shade(ro + rd * tMin, rd, tMin), cov);
    }
  }
  outColor = vec4(col, 1.0);
}
`;

// Pass 2: bloom add, tone shoulder, sRGB, grain + dither.
export const BLOBS_FINAL_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uGrain;
uniform int uFrameMod;
${NOISE_GLSL}
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  c += texture(uBloom, vUv).rgb * uBloomStrength;
  // gentle shoulder above 0.8 so hot overlaps don't clip hard
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + over / (1.0 + over * 2.5);
  vec3 s = linearToSrgb(c);
  s = grainAndDither(s, uGrain, 0.0, uFrameMod);
  outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;
