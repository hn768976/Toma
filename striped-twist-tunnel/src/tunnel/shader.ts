/**
 * Op-art twisted triangular funnel with stripes running along its rulings.
 *
 * Geometry: a stack of equilateral-triangle "rings". Ring k sits at depth
 * z_k = uZ0 * uSegGrowth^k, is scaled by uSegShrink^k and rotated by
 * k * uSegTwist. Between two rings every face is the ruled (bilinear) patch
 * that joins matching perimeter points, so stripes are straight rulings while
 * the twisted faces fold over and produce curved silhouettes. In perspective
 * each ring appears a constant factor smaller than the previous one, so the
 * funnel is self-similar.
 *
 * Rendering: each pixel's ray is intersected analytically with the patches,
 * slab by slab (depth increases monotonically along the ray, so the first slab
 * with a hit holds the visible surface). Inside a slab the depth parameter v is
 * linear in t, which turns the ray / bilinear patch test into a quadratic.
 */
export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2  uResolution;
uniform float uPhase;        // stripe scroll in stripe pairs
uniform float uTime;         // seconds (film grain only)
uniform float uSegTwist;     // rotation between consecutive rings (radians)
uniform float uSegGrowth;    // depth ratio between consecutive rings (> 1)
uniform float uSegShrink;    // size ratio between consecutive rings (< 1)
uniform float uZ0;           // depth of ring 0
uniform float uCircumradius; // triangle circumradius of ring 0
uniform float uPairsPerFace; // stripe pairs on each face
uniform float uFov;          // tan(half vertical fov)
uniform vec2  uLook;         // camera yaw / pitch (radians)
uniform float uRoll;         // camera roll (radians)
uniform float uBaseRot;      // rotation of ring 0
uniform vec3  uInk;
uniform vec3  uPaper;
uniform vec3  uDeep;
uniform vec3  uDeepInk;
uniform vec3  uFog;          // colour the far end of the tunnel dissolves into
uniform float uDepthNear;    // ring index where depth tint starts
uniform float uDepthFar;     // ring index where depth tint is full
uniform float uFogNear;      // ring index where the end fog starts
uniform float uFogFar;       // ring index where the end fog is complete
uniform float uGrain;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const int FIRST_RING = -6;
const int RING_COUNT = 34;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

vec2 ringVertex(float k, int j) {
  float a = 0.5 * PI + float(j) * TAU / 3.0 + uBaseRot + k * uSegTwist;
  return uCircumradius * pow(uSegShrink, k) * vec2(cos(a), sin(a));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1, 0));
  float c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 frag = vUv * uResolution;
  vec2 ndc = (frag - 0.5 * uResolution) / (0.5 * uResolution.y);

  vec3 rd = normalize(vec3(ndc * uFov, 1.0));
  rd.xy = rot(uRoll) * rd.xy;
  rd.yz = rot(uLook.y) * rd.yz;
  rd.xz = rot(uLook.x) * rd.xz;
  vec3 ro = vec3(0.0);

  bool hit = false;
  float bestT = 1e9, hitU = 0.0, hitV = 0.0, hitRing = 0.0;
  int hitFace = 0;
  vec3 hitN = vec3(0.0, 0.0, -1.0);

  for (int r = 0; r < RING_COUNT; r++) {
    float k = float(FIRST_RING + r);
    float zA = uZ0 * pow(uSegGrowth, k);
    float zB = zA * uSegGrowth;
    // Ray parameter range for this depth slab.
    float tA = (zA - ro.z) / rd.z, tB = (zB - ro.z) / rd.z;
    if (tB <= 0.0) continue;
    float v0 = (ro.z - zA) / (zB - zA);
    float v1 = rd.z / (zB - zA);
    for (int j = 0; j < 3; j++) {
      int j2 = (j + 1) % 3;
      vec2 A = ringVertex(k, j),       B = ringVertex(k, j2);
      vec2 C = ringVertex(k + 1.0, j), D = ringVertex(k + 1.0, j2);
      vec2 e0 = A + (C - A) * v0, e1 = (C - A) * v1;
      vec2 f0 = B + (D - B) * v0, f1 = (D - B) * v1;
      vec2 d0 = f0 - e0, d1 = f1 - e1;
      vec2 w0 = ro.xy - e0, w1 = rd.xy - e1;
      float qa = cross2(d1, w1);
      float qb = cross2(d0, w1) + cross2(d1, w0);
      float qc = cross2(d0, w0);
      float roots[2];
      int nRoots = 0;
      if (abs(qa) < 1e-9) {
        if (abs(qb) > 1e-12) { roots[0] = -qc / qb; nRoots = 1; }
      } else {
        float disc = qb * qb - 4.0 * qa * qc;
        if (disc >= 0.0) {
          float sq = sqrt(disc);
          roots[0] = (-qb - sq) / (2.0 * qa);
          roots[1] = (-qb + sq) / (2.0 * qa);
          nRoots = 2;
        }
      }
      for (int i = 0; i < 2; i++) {
        if (i >= nRoots) break;
        float t = roots[i];
        if (t < max(tA, 1e-4) || t > tB || t >= bestT) continue;
        vec2 dd = d0 + d1 * t;
        vec2 ww = w0 + w1 * t;
        float u = dot(ww, dd) / dot(dd, dd);
        if (u < 0.0 || u > 1.0) continue;
        float v = v0 + v1 * t;
        bestT = t; hitU = u; hitV = v; hitFace = j; hitRing = k; hit = true;
        vec3 Pu = vec3(mix(B - A, D - C, v), 0.0);
        vec3 Pv = vec3(mix(C - A, D - B, u), zB - zA);
        hitN = normalize(cross(Pu, Pv));
      }
    }
    if (hit) break;
  }

  vec3 col;
  float ringDepth = hit ? hitRing + hitV : float(FIRST_RING + RING_COUNT);
  float depthMix = smoothstep(uDepthNear, uDepthFar, ringDepth);
  if (hit) {
    if (dot(hitN, rd) > 0.0) hitN = -hitN;
    float u = float(hitFace) + hitU;
    float stripeCoord = u * uPairsPerFace - uPhase;
    float w = clamp(fwidth(stripeCoord), 1e-4, 0.3);
    // Anti-aliased square wave: 1 = ink, 0 = paper.
    float stripe = clamp((abs(fract(stripeCoord) - 0.5) - 0.25) / (2.0 * w) + 0.5, 0.0, 1.0);

    vec3 paper = mix(uPaper, uDeep, depthMix);
    vec3 ink = mix(uInk, uDeepInk, depthMix);

    // Per-wall shading: each face is lit according to its orientation.
    vec3 L = normalize(vec3(-0.45, 0.55, -0.7));
    float lambert = clamp(dot(hitN, L), 0.0, 1.0);
    float light = mix(0.74, 1.07, lambert);
    // Soft occlusion into the creases / corners of each ring.
    float creaseDist = min(hitU, 1.0 - hitU);
    float ao = mix(0.8, 1.0, smoothstep(0.0, 0.22, creaseDist));
    ao *= mix(0.86, 1.0, smoothstep(0.0, 0.3, hitV));

    col = mix(paper, ink, stripe) * light * ao;

    // Paper fibre texture locked to the surface.
    vec2 surf = vec2(u * 40.0, (hitRing + hitV) * 30.0);
    float fib = valueNoise(surf * vec2(1.0, 0.5)) * 0.5 + valueNoise(surf * 3.7) * 0.5;
    col *= 1.0 + (fib - 0.5) * 0.07;

    // The far end of the tunnel dissolves into a soft, light fog.
    col = mix(col, uFog, smoothstep(uFogNear, uFogFar, ringDepth));
  } else {
    col = uFog;
  }

  // Tiny round dust flecks (1-2 px at 1080p), fixed on screen like film dust.
  float fleckCell = 9.0 * uResolution.y / 1080.0;
  vec2 cell = floor(frag / fleckCell);
  vec2 fc = (cell + vec2(hash12(cell), hash12(cell + 17.0))) * fleckCell;
  float fr = fleckCell / 9.0;
  float fleck = step(0.985, hash12(cell + 3.1)) * smoothstep(2.2 * fr, 0.8 * fr, length(frag - fc));
  col = mix(col, uPaper * 1.08, fleck * 0.45);

  // Film grain and a gentle vignette.
  float g = hash12(frag + fract(uTime * 7.31) * 911.0) - 0.5;
  col += g * uGrain;
  vec2 vq = vUv - 0.5;
  col *= 1.0 - dot(vq, vq) * 0.3;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
