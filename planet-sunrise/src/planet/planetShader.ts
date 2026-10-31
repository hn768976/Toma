/**
 * Planet-horizon sunrise fragment shader (WebGL 2 / GLSL ES 3.00).
 *
 * Authored in a 768x432 reference space (y down) and scaled to the
 * canvas, so the 3840x2160 composition renders at 5 px per ref px.
 *
 * Measured from the reference clip:
 *   - Planet limb is a circle, centre (384, -962), radius 1074 ->
 *     y = 41 at the frame edges, y ~ 112 at the centre.
 *   - Sun sits on the limb at (384, 108) and pulses on an ~88-frame
 *     cycle with 2nd/3rd harmonics (uSunPulse, computed in JS).
 *   - Lens-flare ghosts lie on the line sun -> frame centre at
 *     0.97, 1.45, 1.96, 2.17, 2.56 x (centre - sun).
 *
 * Camera: world = centre + R(roll*k) * (screen - centre) / zoom^k + pan*k,
 * with parallax factor k per layer (far stars < planet < dust), so a
 * camera move produces real depth.  Version 1 uses the identity camera.
 */
export const PLANET_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFrame;
uniform float uTime;

uniform float uSunPulse;   // ~[-1, 1]
uniform vec2 uSunScreen;   // sun position on screen (ref space)
uniform float uZoom;
uniform float uRoll;
uniform vec2 uPan;

out vec4 outColor;

const vec2 REF = vec2(768.0, 432.0);
const vec2 CENTER = vec2(384.0, 216.0);
const vec2 PC = vec2(384.0, -962.0);
const float PR = 1074.0;
const vec2 SUN = vec2(384.0, 108.0);

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise2(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

vec2 toWorld(vec2 q, float k) {
  float ang = uRoll * k;
  float c = cos(ang);
  float s = sin(ang);
  vec2 d = q - CENTER;
  d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  return CENTER + d / pow(uZoom, k) + uPan * k;
}

// Twinkling, very slowly drifting star field (cell-based, deterministic).
vec3 stars(vec2 p, float cell, float density, float seed, float sizeMax) {
  vec2 pc = p / cell;
  vec2 g = floor(pc);
  // Only the 2x2 block of cells nearest to p can contain a visible star
  // (stars are tiny relative to the cell and drift < 1 ref px).
  vec2 o = step(0.5, pc - g) - 1.0;
  vec3 acc = vec3(0.0);
  for (int dx = 0; dx <= 1; dx++) {
    for (int dy = 0; dy <= 1; dy++) {
      vec2 id = g + o + vec2(float(dx), float(dy));
      float h = hash21(id + seed);
      if (h > density) continue;
      vec2 pos = (id + 0.15 + 0.7 * vec2(hash21(id + seed + 1.3), hash21(id + seed + 2.7))) * cell;
      pos += (vec2(hash21(id + 5.1), hash21(id + 6.3)) - 0.5) * uTime * 0.18;
      float size = mix(0.32, sizeMax, pow(hash21(id + seed + 4.1), 3.0));
      float tw = 0.5 + 0.5 * sin(uTime * (1.2 + 4.0 * hash21(id + 9.9)) + h * 60.0);
      float br = mix(0.25, 1.0, pow(hash21(id + seed + 8.0), 2.0)) * (0.35 + 0.65 * tw);
      vec3 tint = mix(vec3(0.85, 0.95, 1.0), vec3(0.45, 1.0, 0.95), step(0.8, hash21(id + 3.3)));
      float d = length(p - pos);
      acc += tint * br * exp(-d * d / (2.0 * size * size));
    }
  }
  return acc;
}

vec3 space(vec2 p) {
  vec2 uv = p / REF;
  float n1 = fbm(p * 0.0055 + vec2(3.1, uTime * 0.01));
  float n2 = fbm(p * 0.012 + vec2(-uTime * 0.012, 7.7));
  vec3 base = mix(vec3(0.0, 0.035, 0.065), vec3(0.06, 0.25, 0.36), smoothstep(0.3, 0.85, n1));
  base = mix(base, vec3(0.1, 0.28, 0.32), smoothstep(0.55, 0.95, n2) * 0.4);
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.5, 0.25)) * vec2(1.0, 1.15)));
  base *= 0.28 + 0.8 * vig;
  // Broad yellow-green light cone falling from the sun.
  vec2 ds = p - SUN;
  float ang = atan(ds.x, ds.y);
  float cone = exp(-ang * ang / (2.0 * 0.42 * 0.42)) * exp(-length(ds) / 420.0);
  base += vec3(0.2, 0.27, 0.17) * cone * 0.75;
  return base;
}

vec3 planet(vec2 p, float d) {
  vec2 rel = (p - PC) / PR;
  float z = sqrt(max(0.0, 1.0 - dot(rel, rel)));
  vec3 n = vec3(rel, z);
  float lon = atan(n.x, n.z) + uTime * 0.0035;
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 tc = vec2(lon * 9.0, lat * 9.0) * 1.15;
  float cl = fbm(tc + vec2(0.0, uTime * 0.02));
  float cl2 = fbm(tc * 2.3 + 4.0);
  float clouds = smoothstep(0.45, 0.9, cl * 0.8 + cl2 * 0.3);
  float limbDist = PR - d;
  float lit = exp(-limbDist / 40.0);
  // Scattered sunlight over the night side near the sun.
  float sunScatter = exp(-length((p - SUN) * vec2(1.0, 1.6)) / 170.0);
  float sideFade = smoothstep(60.0, 300.0, abs(p.x - SUN.x));
  vec3 col = vec3(0.01, 0.045, 0.055);
  col += vec3(0.05, 0.22, 0.27) * lit;
  col += vec3(0.1, 0.36, 0.42) * clouds * (lit * 0.7 + 0.05) * sideFade;
  col += vec3(0.22, 0.38, 0.32) * clouds * exp(-limbDist / 120.0) * 0.35 * sideFade;
  col += vec3(0.34, 0.48, 0.36) * sunScatter * (0.8 + 0.2 * clouds);
  return col;
}

vec3 atmosphere(vec2 p, float d, float pulse) {
  float sd = d - PR;
  float nearSun = exp(-abs(p.x - SUN.x) / 230.0);
  float rimLine = exp(-abs(sd + 1.6) / 1.5);
  float inner = exp(-max(-sd, 0.0) / 10.0) * step(sd, 0.0);
  float outer = exp(-max(sd, 0.0) / 13.0) * step(0.0, sd);
  float haze = exp(-max(sd, 0.0) / 45.0) * step(0.0, sd);
  vec3 rimCol = mix(vec3(0.12, 0.72, 0.9), vec3(0.85, 1.0, 1.0), nearSun);
  float k = 0.75 + 0.9 * nearSun * pulse;
  return rimCol * (rimLine * 1.15 + inner * 0.38 + outer * 0.5) * k
       + vec3(0.1, 0.45, 0.55) * haze * 0.22 * (0.5 + nearSun);
}

vec3 sun(vec2 p, float pulse) {
  vec2 ds = p - SUN;
  float r = length(ds);
  float core = exp(-r * r / (2.0 * 15.0 * 15.0));
  float glow = exp(-r / 34.0) * 0.9 + exp(-r / 95.0) * 0.55 + exp(-r / 230.0) * 0.2;
  float streak = exp(-abs(ds.y) / 2.2) * exp(-abs(ds.x) / 85.0) * 0.6
               + exp(-abs(ds.y) / 9.0) * exp(-abs(ds.x) / 150.0) * 0.18;
  float ang = atan(ds.x, ds.y);
  float rays = pow(noise1(ang * 16.0 + uTime * 0.12), 2.5) * 0.6
             + pow(noise1(ang * 37.0 - uTime * 0.2 + 3.0), 3.0) * 0.4;
  rays *= exp(-r / 230.0) * smoothstep(0.0, 25.0, r);
  vec3 c = vec3(1.0, 0.98, 0.88) * core * 2.6
         + vec3(0.86, 0.96, 0.58) * glow
         + vec3(0.8, 1.0, 1.0) * streak
         + vec3(0.55, 0.75, 0.5) * rays * 0.03;
  return c * pulse;
}

vec3 ghost(vec2 q, vec2 pos, float rad, vec3 col, float soft) {
  float d = length(q - pos);
  float disc = smoothstep(rad, rad * (1.0 - soft), d);
  float glow = exp(-d / (rad * 0.9)) * 0.35;
  return col * (disc + glow);
}

vec3 flares(vec2 q, float pulse) {
  vec2 axis = CENTER - uSunScreen;
  vec3 c = vec3(0.0);
  c += ghost(q, uSunScreen + axis * 0.97, 9.0, vec3(0.5, 0.82, 1.0) * 0.9, 0.95);
  c += ghost(q, uSunScreen + axis * 0.97, 2.5, vec3(0.8, 0.95, 1.0) * 0.8, 0.9);
  c += ghost(q, uSunScreen + axis * 1.45, 5.0, vec3(0.55, 0.6, 0.32) * 0.35, 0.7);
  c += ghost(q, uSunScreen + axis * 1.96, 8.5, vec3(1.0, 0.8, 0.28) * 0.75, 0.35);
  c += ghost(q, uSunScreen + axis * 2.17, 6.5, vec3(1.0, 0.72, 0.2) * 0.55, 0.4);
  // Large faint ring ghost.
  vec2 rp = uSunScreen + axis * 2.56;
  float rd = length(q - rp);
  float ring = smoothstep(46.0, 40.0, rd) * (0.35 + 0.65 * smoothstep(20.0, 44.0, rd));
  c += vec3(0.55, 0.55, 0.3) * ring * 0.16;
  c += vec3(0.4, 0.45, 0.25) * exp(-rd / 30.0) * 0.12;
  // Soft veil along the flare axis.
  vec2 dir = normalize(axis);
  vec2 rel = q - uSunScreen;
  float along = dot(rel, dir);
  float across = abs(dot(rel, vec2(-dir.y, dir.x)));
  c += vec3(0.35, 0.4, 0.25) * exp(-across / 18.0) * smoothstep(0.0, 120.0, along)
       * exp(-along / 260.0) * 0.12;
  return c * pulse;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 q = frag / uResolution * REF;

  float pulse = 1.0 + 0.16 * uSunPulse;

  // Layers with parallax: far nebula/stars (0.35), planet & sun (1.0), dust (1.35).
  vec2 pFar = toWorld(q, 0.35);
  vec2 pMid = toWorld(q, 0.7);
  vec2 p = toWorld(q, 1.0);
  vec2 pNear = toWorld(q, 1.35);

  float d = length(p - PC);
  float aa = 0.6 / pow(uZoom, 1.0);
  float inside = smoothstep(PR + aa, PR - aa, d);

  vec3 sky = vec3(0.0);
  if (inside < 1.0) {
    sky = space(pFar);
    sky += stars(pFar, 8.0, 0.3, 1.0, 0.8) * 0.6;
    sky += stars(pMid, 21.0, 0.45, 11.0, 1.2) * 0.75;
  }
  vec3 col = sky;
  if (inside > 0.0) col = mix(sky, planet(p, d), inside);
  // Floating near-field dust motes (in front of everything).
  col += stars(pNear + vec2(uTime * 2.2, -uTime * 1.1), 37.0, 0.25, 23.0, 1.0) * 0.4;

  col += atmosphere(p, d, pulse);
  col += sun(p, pulse);
  col += flares(q, pulse);

  // Highlight shoulder + roll to white.
  vec3 shoulder = 0.8 + 0.2 * (1.0 - exp(-(col - 0.8) / 0.2));
  vec3 mapped = mix(col, shoulder, step(0.8, col));
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  mapped = mix(mapped, vec3(1.0), smoothstep(1.2, 3.0, lum) * 0.7);

  float grain = hash21(frag + fract(uFrame * 0.618) * 1000.0) - 0.5;
  mapped += grain * (2.0 / 255.0);
  outColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
`;
