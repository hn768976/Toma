// Fragment shader for "Sunburst Flare": a blown-out sun behind foliage with
// a starburst, defocused leaf highlights, veiling glare and lens-flare ghosts.
//
// Coordinates (CPU + GPU): p.x in [0, aspect], p.y in [0, 1] top -> bottom,
// all measured in frame heights. Discs, ghosts and the sun are passed in
// already projected to screen space (the camera lives on the CPU side);
// the procedural background is mapped through the same camera via uCam.

export const MAX_DISCS = 72;
export const MAX_GHOSTS = 8;

export const SUNBURST_FRAG = /* glsl */ `#version 300 es
precision highp float;

#define MAX_DISCS ${MAX_DISCS}
#define MAX_GHOSTS ${MAX_GHOSTS}
#define TAU 6.28318530718

uniform vec2  uRes;
uniform float uTime;
uniform float uFrame;
uniform float uExposure;             // measured light curve (see lightCurve.ts)
uniform vec4  uCam;                  // offset.xy, zoom, roll (rad)
uniform vec2  uSun;                  // sun, screen space
uniform float uSunPow;               // light breathing
uniform float uRayRot;               // starburst rotation (rad)

uniform int   uDiscCount;
uniform vec4  uDisc[MAX_DISCS];      // x, y, r, alpha
uniform vec4  uDiscCol[MAX_DISCS];   // linear rgb, softness

uniform int   uGhostCount;
uniform vec4  uGhost[MAX_GHOSTS];    // x, y, r, intensity
uniform vec4  uGhostCol[MAX_GHOSTS]; // linear rgb, type (0 disc, 1 hexagon, 2 streak, 3 ring)
uniform vec4  uGhostShape[MAX_GHOSTS]; // stretch.x, stretch.y, rotation, softness

uniform vec3 uBgDark;
uniform vec3 uBgLight;
uniform vec3 uBgLow;
uniform vec3 uLeaf;
uniform vec3 uGlare;
uniform vec3 uSunCol;
uniform vec3 uRayCol;

out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 5.31;
    a *= 0.5;
  }
  return s;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float blob(vec2 p, vec2 c, vec2 r) { vec2 q = (p - c) / r; return exp(-dot(q, q)); }

float hexDist(vec2 q) {
  q = abs(q);
  return max(q.x * 0.866025 + q.y * 0.5, q.y);
}

vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes.y;
  vec2 C = vec2(aspect * 0.5, 0.5);
  float t = uTime;

  // world-space coordinate of this pixel (camera pan / zoom / roll)
  vec2 q = rot(-uCam.w) * (p - C) / uCam.z + C + uCam.xy;

  // ---------- defocused foliage background ----------
  float gx = smoothstep(0.1, 1.6, q.x);
  vec3 col = mix(uBgDark, uBgLight, gx);
  col = mix(col, uBgLow, smoothstep(0.45, 1.05, q.y) * (1.0 - gx * 0.6) * 0.8);
  float n1 = fbm(q * 2.2 + vec2(t * 0.01, -t * 0.007));
  float n2 = fbm(q * 3.6 - vec2(t * 0.012, t * 0.004) + 9.0);
  col = mix(col, uLeaf, smoothstep(0.5, 0.75, n1) * 0.55 * (1.0 - smoothstep(0.9, 1.5, q.x)));
  col *= 0.8 + 0.35 * smoothstep(0.3, 0.7, n2);

  // ---------- veiling glare around the sun ----------
  vec2 sd = p - uSun;
  float r2 = dot(sd, sd);
  float glare = exp(-r2 / 0.09) * 1.1 + exp(-r2 / 0.4) * 0.55 + exp(-r2 / 2.0) * 0.22;
  col += uGlare * glare * uSunPow;

  // ---------- defocused leaf-gap highlights & small bokeh ----------
  for (int i = 0; i < MAX_DISCS; i++) {
    if (i >= uDiscCount) break;
    vec4 D = uDisc[i];
    vec2 dp = p - D.xy;
    float r = D.z;
    if (abs(dp.x) > r * 1.35 || abs(dp.y) > r * 1.35) continue;
    float d = length(dp);
    vec4 Cc = uDiscCol[i];
    float e = r * Cc.w;
    float m = 1.0 - smoothstep(r - e, r + e * 0.4, d);
    float rim = smoothstep(r - e * 2.0, r - e * 0.3, d);
    col += Cc.rgb * D.w * m * (0.88 + 0.2 * rim) * uSunPow;
  }

  // ---------- the sun: blown core, partially occluded by fluttering leaves ----------
  vec2 wq = q * 4.5 + vec2(fbm(q * 3.0 + t * 0.03), fbm(q * 3.0 - t * 0.025 + 4.0)) * 1.2;
  float leaf = fbm(wq + vec2(t * 0.09, -t * 0.07));
  float occl = smoothstep(0.32, 0.6, leaf);
  vec2 sdE = sd * vec2(0.85, 1.0);
  float rE = dot(sdE, sdE);
  float core = exp(-rE / 0.007) * 5.0 + exp(-rE / 0.03) * 2.2 * occl + exp(-rE / 0.06) * 0.8 * occl + exp(-r2 / 0.0015) * 6.0;
  col += uSunCol * core * uSunPow;

  // ---------- starburst ----------
  float ang = atan(sd.y, sd.x) + uRayRot;
  float dist = sqrt(r2);
  vec2 cs = vec2(cos(ang), sin(ang));
  float s1 = vnoise(cs * 9.0 + vec2(t * 0.12, 0.0));
  float s2 = vnoise(cs * 19.0 + vec2(0.0, t * 0.18) + 17.0);
  float s3 = vnoise(cs * 31.0 + vec2(t * 0.2, 3.0));
  float spikes = pow(s1, 5.0) * 0.9 + pow(s2, 6.0) * 0.8 + pow(s3, 6.0) * 0.5;
  float radial = smoothstep(0.03, 0.14, dist) * exp(-dist / 0.17);
  // the lower half of the burst reads more strongly (sky above is blown out)
  float lowerBias = 0.6 + 0.4 * smoothstep(-0.2, 0.6, sd.y / max(dist, 1e-4));
  col += uRayCol * spikes * radial * lowerBias * uSunPow;

  // ---------- lens flare ghosts (screen space) ----------
  for (int i = 0; i < MAX_GHOSTS; i++) {
    if (i >= uGhostCount) break;
    vec4 G = uGhost[i];
    vec4 GC = uGhostCol[i];
    vec4 GS = uGhostShape[i];
    vec2 gp = rot(GS.z) * (p - G.xy);
    gp /= GS.xy;
    float r = G.z;
    float d;
    float type = GC.w;
    float m;
    if (type < 0.5) {
      d = length(gp);
      float e = r * GS.w;
      m = 1.0 - smoothstep(r - e, r + e * 0.3, d);
      m *= 0.8 + 0.3 * smoothstep(r * 0.2, r, d) + 0.15 * (1.0 - smoothstep(0.0, r * 0.6, length(gp - vec2(r * 0.25, -r * 0.2))));
    } else if (type < 1.5) {
      d = hexDist(gp);
      float e = r * GS.w;
      m = 1.0 - smoothstep(r - e, r + e * 0.3, d);
      m += exp(-dot(gp, gp) / (r * r * 0.08)) * 1.8;
    } else if (type < 2.5) {
      d = length(gp);
      m = exp(-(d * d) / (r * r));
    } else {
      d = length(gp);
      float w = r * GS.w;
      m = exp(-pow((d - r) / w, 2.0));
    }
    col += GC.rgb * m * G.w * uSunPow;
  }

  // ---------- tone: soft shoulder, highlights roll off to white ----------
  float mx = max(max(col.r, col.g), col.b);
  col = mix(col, vec3(mx), smoothstep(0.9, 3.0, mx) * 0.85);
  vec3 hi = max(col - 0.72, 0.0);
  col = min(col, 0.72) + hi / (1.0 + hi * 1.25);
  col = min(col, vec3(1.0));

  vec3 srgb = toSRGB(col) * uExposure;
  float g = hash12(gl_FragCoord.xy + fract(uFrame * 0.6180339) * 917.0) - 0.5;
  srgb += g * (2.4 / 255.0);
  outColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;
