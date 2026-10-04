import { AGX_GLSL, GRAIN_GLSL, SIMPLEX3_GLSL } from "../lib/glsl";

export const fullscreenVertex = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Pass 1: raymarch the cream surface. Output: linear HDR colour, alpha =
// view depth (for depth of field).
export const creamFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform vec2 uResolution;
uniform float uPhase;     // 2*pi * (frame % 600) / 600
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform float uTanHalfFov;
uniform vec3 uBase;       // linear base colour
uniform vec3 uGlow;       // linear inner glow colour
uniform vec3 uSwirl;      // swirl centre x, y and ring radius
out vec4 outColor;
${SIMPLEX3_GLSL}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// time-looping noise: the third coordinate walks around a circle
vec2 loopC(float r, float ofs) { return r * vec2(cos(uPhase + ofs), sin(uPhase + ofs)); }
float lnoise(vec2 p, float r, float ofs) {
  vec2 c = loopC(r, ofs);
  return snoise(vec3(p.x + c.x, p.y, c.y + ofs * 3.0));
}

// Flowing domain warp shared by the sheet and the roll.
vec2 warp(vec2 p) {
  return p + 0.16 * vec2(lnoise(p * 0.55, 0.45, 0.0), lnoise(p * 0.55 + 7.3, 0.45, 2.1));
}

// Height of the base sheet.
float sheetHeight(vec2 p, vec2 w, float rho) {
  float h = 0.0;
  // gentle waves
  h += 0.10 * sin(w.x * 1.7 + w.y * 0.9 + 0.35 * sin(uPhase) + 0.6);
  h += 0.06 * sin(w.y * 2.6 - w.x * 1.1 + 0.4 * cos(uPhase) + 1.7);
  // two soft folds sweeping around the lower left
  float f1 = w.y + 0.55 * sin(w.x * 1.35 + 0.8) + 0.35;
  h += 0.16 * exp(-f1 * f1 * 7.0) * smoothstep(1.4, -1.6, w.x);
  float f2 = w.y - 0.42 * sin(w.x * 1.1 + 2.0) - 0.75;
  h += 0.12 * exp(-f2 * f2 * 9.0) * smoothstep(1.2, -1.0, w.x);
  // a big fold sweeping up from the lower left toward the top
  float f3 = w.x + 0.55 - 0.55 * w.y - 0.3 * sin(w.y * 1.6 + 0.4 * sin(uPhase));
  h += 0.3 * exp(-f3 * f3 * 1.8) * smoothstep(-1.4, 0.3, w.y);
  // a fold down the far right
  float f4 = w.x - 1.62 - 0.15 * sin(w.y * 2.0 + 0.3 * sin(uPhase));
  h += 0.2 * exp(-f4 * f4 * 9.0);
  // low smooth noise
  h += 0.035 * lnoise(w * 1.3 + 3.0, 0.35, 4.0);
  // the bowl inside the swirl
  h -= 1.0 * exp(-pow(rho / (uSwirl.z * 0.8), 2.0));
  // an S-shaped fold crest crossing the hollow, top centre to lower right
  vec2 sq = w - uSwirl.xy;
  float dl = dot(sq, normalize(vec2(0.62, -0.78))) - 0.12 * sin(sq.y * 3.0 + 0.4 * sin(uPhase));
  h += 0.16 * exp(-dl * dl / 0.006) * (1.0 - smoothstep(uSwirl.z * 0.35, uSwirl.z * 0.8, rho));
  // the sheet falls away toward the top-left corner: bright gap
  // a rounded, cloud-like opening at the top left
  float edge = 0.95 - length((p - vec2(-1.55, 1.3)) * vec2(0.72, 1.0));
  edge += 0.03 * sin(p.x * 2.3 + 0.5 * sin(uPhase));
  // a rolled lip just before the sheet drops away frames the gap
  h += 0.16 * exp(-pow((edge + 0.1) / 0.12, 2.0));
  h -= 2.4 * smoothstep(-0.02, 0.38, edge);
  return h;
}

// The rolled swirl: a closed, twisted torus whose radius, thickness and
// height change around the ring, so it reads as a curl, not a donut.
// Swirl space: slightly squeezed sideways so the hollow reads as a tall egg.
vec2 swirlQ(vec2 w) { return (w - uSwirl.xy) * vec2(1.3, 0.88); }

float swirlRoll(vec3 p, vec2 w) {
  vec2 q = swirlQ(w);
  float rho = length(q);
  float phi = atan(q.y, q.x) + 0.32 * sin(uPhase);
  float R = uSwirl.z * (1.0 + 0.10 * sin(phi + 0.9) + 0.035 * sin(2.0 * phi + uPhase));
  float r = 0.17 * (0.8 + 0.25 * sin(phi - 0.4) + 0.06 * sin(3.0 * phi - uPhase));
  float hc = 0.13 + 0.06 * sin(phi + 2.2);
  // elliptical cross-section rotating with phi (the twist)
  float tw = phi + 0.25 * sin(uPhase + phi);
  vec2 cs = vec2(rho - R + 0.05, p.z - hc);
  float c = cos(tw * 0.5 + 0.5), s = sin(tw * 0.5 + 0.5);
  cs = mat2(c, -s, s, c) * cs;
  vec2 ab = vec2(0.85, 1.55) * r;
  float k0 = length(cs / ab);
  float d1 = (k0 - 1.0) * min(ab.x, ab.y);
  // a second, outer rim around the right-hand side
  float r2 = 0.1 * smoothstep(-0.1, 0.7, cos(phi - 0.15));
  vec2 cs2 = vec2(rho - R * 1.45, p.z - 0.05);
  float d2 = length(cs2 / vec2(0.9, 1.3)) - r2;
  return min(d1, d2 * 0.8);
}

float map(vec3 p) {
  vec2 w = warp(p.xy);
  float rho = length(swirlQ(w));
  float sheet = (p.z - sheetHeight(p.xy, w, rho)) * 0.55;
  float roll = swirlRoll(p, w) * 0.8;
  return smin(sheet, roll, 0.16);
}

vec3 calcNormal(vec3 p, float t) {
  float e = 0.0012 * t;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.02 + 0.09 * float(i);
    float d = map(p + h * n);
    occ += (h - d) * sca;
    sca *= 0.75;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

// How much light gets through: thin or concave parts glow.
float translucency(vec3 p, vec3 n) {
  float acc = 0.0;
  for (int i = 1; i <= 3; i++) {
    float d = 0.06 * float(i);
    acc += (d + map(p - n * d)) / d;
  }
  return clamp(acc / 3.0, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.02;
  for (int i = 0; i < 24; i++) {
    float h = map(ro + rd * t);
    res = min(res, 6.0 * h / t);
    t += clamp(h, 0.03, 0.25);
    if (res < 0.02 || t > 2.5) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  vec3 fwd = normalize(uCamTarget - uCamPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(fwd + right * ndc.x * aspect * uTanHalfFov + up * ndc.y * uTanHalfFov);
  vec3 ro = uCamPos;

  // start at the top of the slab the surface lives in
  float t = max(0.0, (0.95 - ro.z) / rd.z);
  float tmax = (-2.6 - ro.z) / rd.z;
  bool hit = false;
  bool escaped = false;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001 * t) { hit = true; break; }
    t += d * 0.65;
    if (t > tmax) { escaped = true; break; }
  }
  // out of steps near a grazing silhouette: treat as a hit, not a hole
  if (!escaped) hit = true;

  // bright backdrop behind the falling edge
  vec3 bg = vec3(10.0);
  if (!hit) {
    outColor = vec4(bg, tmax);
    return;
  }
  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p, t);
  vec3 v = -rd;
  vec3 L = normalize(vec3(-0.75, 0.6, 0.5));
  float ao = calcAO(p, n);
  float sh = softShadow(p + n * 0.004, L);
  float wrap = 0.45;
  float dif = clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float sky = 0.5 + 0.5 * n.z;
  vec3 h = normalize(L + v);
  float sheen = pow(max(dot(n, h), 0.0), 6.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

  vec2 w = warp(p.xy);
  float rho = length(swirlQ(w));
  float inside = 1.0 - smoothstep(uSwirl.z * 0.5, uSwirl.z * 1.0, rho);
  float tr = translucency(p, n);
  // saturated version of the glow colour for light passing through the cream
  vec3 glowSat = uGlow * uGlow / max(dot(uGlow, vec3(0.3333)), 1e-3);
  // cool base; warm only where light comes through
  // outer folds lean cool, the hollow warm
  vec3 albedo = mix(uBase * vec3(0.975, 0.985, 1.02), uGlow, 0.9 * inside * smoothstep(0.15, -0.3, p.z));
  vec3 shadeTint = mix(vec3(0.86, 0.87, 1.0), vec3(1.0), sh * dif);

  float occ = pow(ao, 1.1);
  // high key: generous fill light, soft key
  vec3 col = albedo * (1.1 * sky + 3.0 * dif * mix(0.45, 1.0, sh)) * mix(0.45, 1.0, occ) * shadeTint;
  // warm glow spots behind the thin veils and in the creases
  float spot = smoothstep(0.35, 0.72, lnoise(w * 1.3 + 11.0, 0.4, 5.0));
  float crease = smoothstep(0.85, 0.35, ao);
  col += glowSat * (0.6 + 4.5 * spot) * tr * crease;
  // the inside of the swirl is lit through the cream: bright, warm
  float core = (1.0 - smoothstep(uSwirl.z * 0.45, uSwirl.z * 0.78, rho)) * smoothstep(-0.05, -0.45, p.z);
  col += uGlow * 4.2 * core;
  col += glowSat * 1.2 * core * (1.0 - occ);
  col += vec3(1.0) * sheen * 0.8 * occ * sh;
  col += uBase * fres * 0.5 * occ;
  // fade toward the backdrop where the sheet drops away
  col = mix(col, bg, smoothstep(-0.8, -2.2, p.z));
  outColor = vec4(col, t);
}
`;

// Pass 2: depth of field, AgX tone mapping, grain, dither.
export const creamPostFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uResolution;   // output pixels
uniform float uFocusDepth;
uniform float uAperture;    // CoC in pixels per unit of |1 - zf/z|
uniform float uMaxCoc;
uniform float uExposure;
uniform float uGrainFrame;
uniform float uGrainAmount;
out vec4 outColor;
${AGX_GLSL}
${GRAIN_GLSL}

uniform float uBaseCoc;
float cocOf(float z) {
  return min(uMaxCoc, uBaseCoc + uAperture * abs(1.0 - uFocusDepth / z));
}

void main() {
  vec4 c0 = texture(uScene, vUv);
  float coc = cocOf(c0.a);
  vec3 col;
  if (coc < 0.6) {
    col = c0.rgb;
  } else {
    const int N = 56;
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    float lod = log2(max(1.0, coc * 0.24 * float(textureSize(uScene, 0).x) / uResolution.x));
    for (int i = 0; i < N; i++) {
      float r = coc * sqrt((float(i) + 0.5) / float(N));
      float a = float(i) * 2.39996323;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uResolution;
      vec4 s = textureLod(uScene, uv, lod);
      // a sharp neighbour does not spread into a blurred pixel
      float tc = cocOf(s.a);
      float w = smoothstep(r * 0.5 - 1.0, r * 0.5 + 1.0, tc) + 0.02;
      sum += s.rgb * w;
      wsum += w;
    }
    col = sum / wsum;
  }
  col = agxToneMap(col * uExposure);
  col = linearToSRGB(col);
  float g = grainNoise(gl_FragCoord.xy, uGrainFrame);
  col += g * uGrainAmount;
  col += ditherRGB(gl_FragCoord.xy, uGrainFrame);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
