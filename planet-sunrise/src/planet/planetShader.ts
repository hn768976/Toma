/**
 * Planet-horizon sunrise fragment shader (WebGL 2 / GLSL ES 3.00).
 *
 * Authored in a 768x432 reference space (y down) and scaled to the
 * canvas, so the 3840x2160 composition renders at 5 px per ref px.
 *
 * Measured from the reference clip:
 *   - Planet limb is a circle, centre (384, -932.5), radius 1046.5 ->
 *     y = 41 at the frame edges, y = 114 at the centre.
 *   - Sun sits on the limb at (384, 116) and pulses following the
 *     reference's measured brightness curve (uSunPulse, from JS).
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
const vec2 PC = vec2(384.0, -932.5);
const float PR = 1046.5;
const vec2 SUN = vec2(384.0, 116.0);

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
      // Sparkle: mostly dim with brief bright peaks (~3x swing).
      float tw = 0.5 + 0.5 * sin(uTime * (2.0 + 5.0 * hash21(id + 9.9)) + h * 60.0);
      float br = mix(0.3, 1.0, pow(hash21(id + seed + 8.0), 1.5)) * (0.35 + 1.6 * pow(tw, 8.0));
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
  vec3 base = mix(vec3(0.0, 0.1, 0.16), vec3(0.06, 0.28, 0.4), smoothstep(0.3, 0.85, n1));
  base = mix(base, vec3(0.1, 0.3, 0.36), smoothstep(0.55, 0.95, n2) * 0.4);
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.5, 0.25)) * vec2(1.0, 1.15)));
  base *= 0.3 + 0.78 * vig;
  // Teal-black corners.
  float corner = smoothstep(0.35, 0.75, length((uv - vec2(0.5, 0.35)) * vec2(1.0, 1.3)));
  base = mix(base, vec3(0.0, 0.1, 0.17), corner * 0.9);
  // Right side of the nebula is darker / greener than the left.
  base *= mix(vec3(1.0), vec3(0.95, 0.8, 0.68), smoothstep(0.45, 0.95, uv.x));
  // Broad light cone falling from the sun.
  vec2 ds = p - SUN;
  float ang = atan(ds.x, ds.y);
  float cone = exp(-ang * ang / (2.0 * 0.42 * 0.42)) * exp(-length(ds) / 420.0);
  base += vec3(0.36, 0.4, 0.26) * cone * 0.8;
  return base;
}

vec3 planet(vec2 p, float d) {
  vec2 rel = (p - PC) / PR;
  float z = sqrt(max(0.0, 1.0 - dot(rel, rel)));
  vec3 n = vec3(rel, z);
  float lon = atan(n.x, n.z) + uTime * 0.0035;
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 tc = vec2(lon * 9.0, lat * 9.0) * 1.4;
  float cl = fbm(tc + vec2(0.0, uTime * 0.02));
  float cl2 = fbm(tc * 2.3 + 4.0);
  // Dark cloud blotches, lit (bright edges) only near the rim.
  float clouds = smoothstep(0.48, 0.78, cl * 0.8 + cl2 * 0.3);
  float limbDist = PR - d;
  float lit = exp(-limbDist / 38.0);
  float sunScatter = exp(-length((p - SUN) * vec2(0.8, 1.7)) / 160.0);
  vec3 col = vec3(0.025, 0.13, 0.16);                    // teal night side
  col *= 0.55 + 0.45 * smoothstep(250.0, 0.0, limbDist);
  col = mix(col, vec3(0.03, 0.08, 0.13), clouds * 0.75); // dark blue blotches
  col += vec3(0.06, 0.32, 0.4) * lit * (0.5 + 0.5 * (1.0 - clouds));
  col += vec3(0.3, 0.55, 0.6) * clouds * lit * 0.5;      // rim-lit cloud edges
  col += vec3(0.4, 0.5, 0.36) * sunScatter * (0.75 + 0.25 * clouds);
  return col;
}

vec3 atmosphere(vec2 p, float d, float pulse) {
  float sd = d - PR;
  float nearSun = exp(-abs(p.x - SUN.x) / 120.0);
  // Soft, saturated cyan rim (~25 ref px of glow), white only near the sun.
  float rimLine = exp(-pow(sd / 3.2, 2.0));
  float inner = exp(-max(-sd, 0.0) / 9.0) * step(sd, 0.0);
  float outer = exp(-max(sd, 0.0) / 9.0) * step(0.0, sd);
  float haze = exp(-max(sd, 0.0) / 40.0) * step(0.0, sd);
  vec3 rimCol = mix(vec3(0.05, 0.72, 0.92), vec3(0.75, 1.0, 1.0), nearSun);
  float k = 0.7 + 0.8 * nearSun * pulse;
  return rimCol * (rimLine * 0.75 + inner * 0.45 + outer * 0.55) * k
       + vec3(0.05, 0.42, 0.55) * haze * 0.25 * (0.5 + nearSun);
}

vec3 sun(vec2 p, float pulse) {
  vec2 ds = p - SUN;
  float r = length(ds);
  // Wide horizontal glare ellipse along the rim (about 2:1).
  float re = length(ds * vec2(0.5, 1.0));
  float core = exp(-re * re / (2.0 * 14.0 * 14.0));
  float glow = exp(-re / 30.0) * 0.95 + exp(-r / 85.0) * 0.5 + exp(-r / 220.0) * 0.2;
  float streak = exp(-abs(ds.y) / 2.2) * exp(-abs(ds.x) / 85.0) * 0.4
               + exp(-abs(ds.y) / 9.0) * exp(-abs(ds.x) / 150.0) * 0.05;
  float ang = atan(ds.x, ds.y);
  float rays = pow(noise1(ang * 16.0 + uTime * 0.12), 2.5) * 0.6
             + pow(noise1(ang * 37.0 - uTime * 0.2 + 3.0), 3.0) * 0.4;
  rays *= exp(-r / 230.0) * smoothstep(0.0, 25.0, r);
  vec3 c = vec3(0.95, 1.0, 1.0) * core * 2.6
         + vec3(0.8, 0.96, 0.86) * glow
         + vec3(0.7, 1.0, 1.0) * streak
         + vec3(0.55, 0.8, 0.75) * rays * 0.03;
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
  vec2 dir = normalize(axis);
  vec3 c = vec3(0.0);
  // Soft blue-white ghost.
  c += ghost(q, uSunScreen + axis * 0.97, 16.0, vec3(0.4, 0.75, 1.0) * 0.45, 1.0);
  c += ghost(q, uSunScreen + axis * 0.97, 4.0, vec3(0.75, 0.92, 1.0) * 0.7, 0.9);
  // Soft amber blob.
  c += ghost(q, uSunScreen + axis * 1.45, 20.0, vec3(0.5, 0.4, 0.16) * 0.22, 1.0);
  // Gold ghosts (lower one oval, elongated along the flare axis).
  c += ghost(q, uSunScreen + axis * 1.96, 11.0, vec3(0.85, 0.55, 0.06) * 0.75, 0.35);
  vec2 o = q - (uSunScreen + axis * 2.17);
  vec2 oo = vec2(dot(o, vec2(-dir.y, dir.x)), dot(o, dir) / 1.3);
  float od = length(oo);
  c += vec3(0.75, 0.52, 0.1) * (smoothstep(8.5, 5.0, od) + exp(-od / 7.0) * 0.3) * 0.55;
  // Large disc ghost: amber-brown fill, soft edge, plus a faint outer ring.
  vec2 rp = uSunScreen + axis * 2.56;
  float rd = length(q - rp);
  float disc = smoothstep(46.0, 40.0, rd) * (0.45 + 0.55 * smoothstep(18.0, 44.0, rd));
  c += vec3(0.3, 0.24, 0.06) * disc * 0.3;
  c += vec3(0.4, 0.42, 0.25) * exp(-pow((rd - 60.0) / 4.0, 2.0)) * 0.07;
  // Soft veil along the flare axis.
  vec2 rel = q - uSunScreen;
  float along = dot(rel, dir);
  float across = abs(dot(rel, vec2(-dir.y, dir.x)));
  c += vec3(0.35, 0.42, 0.3) * exp(-across / 18.0) * smoothstep(0.0, 120.0, along)
       * exp(-along / 260.0) * 0.12;
  return c * pulse;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 q = frag / uResolution * REF;

  float pulse = 1.0 + 0.26 * uSunPulse;

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
    sky += stars(pFar, 8.0, 0.45, 1.0, 0.85) * 0.8;
    sky += stars(pMid, 19.0, 0.6, 11.0, 1.25) * 1.0;
  }
  vec3 col = sky;
  if (inside > 0.0) col = mix(sky, planet(p, d), inside);
  // Floating near-field dust motes (in front of everything).
  col += stars(pNear + vec2(uTime * 2.2, -uTime * 1.1), 30.0, 0.3, 23.0, 1.0) * 0.55;
  // Sparse stars/dust also read over the planet's night side.
  if (inside > 0.0) col += stars(pMid, 26.0, 0.35, 31.0, 1.0) * 0.55 * inside;

  col += atmosphere(p, d, pulse);
  col += sun(p, pulse);
  col += flares(q, pulse);

  // Highlight shoulder + roll to white.
  // Grade: cooler (less red, more blue), teal-black corners.
  col *= vec3(1.0, 1.0, 0.94);
  vec3 shoulder = 0.8 + 0.2 * (1.0 - exp(-(col - 0.8) / 0.2));
  vec3 mapped = mix(col, shoulder, step(0.8, col));
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  mapped = mix(mapped, vec3(1.0), smoothstep(1.2, 3.0, lum) * 0.7);

  float grain = hash21(frag + fract(uFrame * 0.618) * 1000.0) - 0.5;
  mapped += grain * (6.0 / 255.0);
  outColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
`;
