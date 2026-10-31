/**
 * WebGL 2 fragment shader: an analytically ray-traced wooden corridor lined with
 * neon rectangle "rings" at three depths, a glossy plank floor reflecting them,
 * and a film-style finish (tone map, palette grade, vignette, grain).
 */

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uFrame;
uniform float uCamZ;
uniform float uRoll;
uniform float uFocal;
uniform float uWarp;
uniform vec3  uRing;       // intensities: back rectangle, middle ring, near ring
uniform float uFill;       // wall spill light when the whole corridor is lit
uniform vec3  uBase;       // darkest tone of the image
uniform vec3  uWood;       // lit-wood tint
uniform vec3  uGlow;       // neon glow tint
uniform vec3  uCore;       // neon core tint
uniform vec3  uReflTint;   // tint for floor reflections
uniform float uExposure;

out vec4 outColor;

const float W  = 1.36;   // corridor half width
const float H  = 1.0;    // corridor half height
const float Z0 = -3.0;   // back wall (back rectangle)
const float Z1 = -1.96;  // middle ring
const float Z2 = -1.30;  // near ring
const float TUBE = 0.0175; // neon tube half width (world units)

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}

// Weathered plank albedo. 'along' runs down the plank length, 'across' across planks.
// fA / fX are the world-space pixel footprints along / across the planks; each noise
// layer fades to its average once it would be smaller than a pixel (no shimmering).
float lod(float ka, float kx, float fA, float fX) {
  return 1.0 - smoothstep(0.25, 0.8, max(fA * ka, fX * kx));
}

float wood(float along, float across, float fA, float fX) {
  const float PW = 0.095;
  float cu = across / PW;
  float pi = floor(cu);
  float pf = fract(cu);
  float seed = hash12(vec2(pi, 3.1));
  float a2 = along + seed * 7.0;
  float tone = 0.55 + 0.45 * hash12(vec2(pi, floor(a2 / (1.6 + seed))));
  // long weathered grain
  float g = mix(0.47, fbm(vec2(a2 * 8.0, across * 22.0 + seed * 10.0)), lod(8.0, 22.0, fA, fX));
  float v = tone * (0.18 + 0.95 * g * g * 1.6);
  // bright worn scratches / dry streaks
  float d1 = lod(15.0, 40.0, fA, fX);
  float sc = fbm(vec2(a2 * 15.0, across * 40.0 + 5.0));
  v += mix(0.1, 0.85 * smoothstep(0.52, 0.76, sc), d1) * tone;
  // fine fibres and pores
  float d2 = lod(26.0, 95.0, fA, fX);
  float fine = vnoise(vec2(a2 * 26.0, across * 95.0 + seed * 4.0));
  v *= mix(1.0, 0.6 + 0.8 * fine, d2);
  float d3 = lod(14.0, 140.0, fA, fX);
  v += mix(0.01, 0.35 * smoothstep(0.78, 0.95, vnoise(vec2(a2 * 14.0, across * 140.0))), d3) * tone;
  // darker rot patches
  v *= 0.45 + 0.55 * smoothstep(0.25, 0.65, fbm(vec2(a2 * 2.2, across * 7.0 + seed * 3.0)));
  // soft gaps between planks, faded out when sub-pixel
  float fw = fX / PW;
  float gw = 0.06 + fw * 1.5;
  float gap = smoothstep(0.0, gw, pf) * smoothstep(1.0, 1.0 - gw, pf);
  gap = mix(gap, 0.8, smoothstep(0.2, 0.7, fw));
  return v * mix(0.22, 1.0, gap);
}

// Distance from p to the rectangular ring (corridor perimeter) at depth zr.
float ringDist(vec3 p, float zr) {
  vec2 q = abs(p.xy) - vec2(W, H);
  float dxy = max(q.x, q.y) > 0.0 ? length(max(q, 0.0)) : -max(q.x, q.y);
  return length(vec2(dxy, p.z - zr));
}

// Ray / corridor intersection. Returns t and writes the surface id
// (0 = side wall, 1 = floor, 2 = ceiling, 3 = back wall).
float traceCorridor(vec3 ro, vec3 rd, out int sid) {
  float t = 1e9;
  sid = 0;
  if (abs(rd.x) > 1e-5) {
    float tx = ((rd.x > 0.0 ? W : -W) - ro.x) / rd.x;
    if (tx > 0.0 && tx < t) { t = tx; sid = 0; }
  }
  if (abs(rd.y) > 1e-5) {
    float ty = ((rd.y > 0.0 ? H : -H) - ro.y) / rd.y;
    if (ty > 0.0 && ty < t) { t = ty; sid = rd.y > 0.0 ? 2 : 1; }
  }
  if (rd.z < -1e-5) {
    float tz = (Z0 - ro.z) / rd.z;
    if (tz > 0.0 && tz < t) { t = tz; sid = 3; }
  }
  return t;
}

// Neon emission seen at a surface point: crisp tube core + soft halo.
// sigma is the blur width (pixel footprint / gloss).
vec2 neonAt(vec3 p, float sigma) {
  float d0 = ringDist(p, Z0);
  float d1 = ringDist(p, Z1);
  float d2 = ringDist(p, Z2);
  float s = max(TUBE, sigma);
  float k = TUBE / s;
  float i2 = 1.0 / (2.0 * s * s);
  float core = uRing.x * k * exp(-d0 * d0 * i2)
             + uRing.y * 0.55 * k * exp(-d1 * d1 * i2)
             + uRing.z * 0.65 * k * exp(-d2 * d2 * i2);
  float halo = uRing.x * (0.22 / (1.0 + pow(d0 / 0.035, 2.0)) + 0.05 / (1.0 + pow(d0 / 0.3, 2.0)))
             + uRing.y * (0.07 / (1.0 + pow(d1 / 0.03, 2.0)) + 0.012 / (1.0 + pow(d1 / 0.22, 2.0)))
             + uRing.z * (0.16 / (1.0 + pow(d2 / 0.04, 2.0)) + 0.03 / (1.0 + pow(d2 / 0.3, 2.0)));
  return vec2(core, halo);
}

// Light falling on a wall point from the rings.
float illum(vec3 p) {
  float d0 = ringDist(p, Z0);
  float d1 = ringDist(p, Z1);
  float d2 = ringDist(p, Z2);
  // the back rectangle washes the back wall softly
  float back = (p.z < Z0 + 0.01) ? 1.0 : 0.6;
  float l = uRing.x * back * (0.14 / (1.0 + pow(d0 / 0.5, 2.0)) + 0.05)
          + uRing.y * (0.16 / (1.0 + pow(d1 / 0.3, 2.0)) + 0.03 / (1.0 + pow(d1 / 1.0, 2.0)))
          + uRing.z * (0.45 / (1.0 + pow(d2 / 0.33, 2.0)) + 0.08 / (1.0 + pow(d2 / 1.1, 2.0)));
  // overall spill when every ring is on (stronger near the camera)
  float toward = smoothstep(Z0, Z2, p.z);              // rises towards the near ring
  float behind = 1.0 - 0.55 * smoothstep(Z2, Z2 + 1.2, p.z); // fades past it, near the camera
  l += uFill * (0.05 + 0.27 * toward * behind);
  return l;
}


void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / (0.5 * uRes.y);
  // the reference's vanishing point sits slightly right of frame centre
  uv.x -= 0.043;
  // glitch lens warp (pincushion), bounded so the frame edges never fold over
  float r2 = dot(uv, uv);
  uv *= 1.0 + uWarp * min(r2, 0.6);
  float cr = cos(uRoll);
  float sr = sin(uRoll);
  // positive roll rotates the image clockwise on screen
  uv = mat2(cr, sr, -sr, cr) * uv;

  vec3 ro = vec3(0.0, 0.0, uCamZ);
  vec3 rd = normalize(vec3(uv, -uFocal));
  float pixAngle = 2.0 / (uRes.y * uFocal);

  int sid;
  float t = traceCorridor(ro, rd, sid);
  vec3 p = ro + rd * t;
  float cosI = max(0.05, abs(sid == 3 ? rd.z : (sid == 0 ? rd.x : rd.y)));
  float fIso = t * pixAngle;      // footprint along axes not foreshortened
  float fFore = fIso / cosI;      // footprint along the receding axis
  float foot = t * pixAngle / max(0.25, cosI);

  // plank albedo in surface space
  float alb;
  if (sid == 0) alb = wood(p.z + (p.x > 0.0 ? 11.0 : 0.0), p.y + 3.0, fFore, fIso);
  else if (sid == 1) alb = wood(p.x + 5.0, p.z + 7.0, fIso, fFore);
  else if (sid == 2) alb = wood(p.x + 2.0, p.z + 13.0, fIso, fFore);
  else alb = wood(p.x + 4.0, p.y + 1.0, fIso, fIso);

  float light = illum(p);
  vec2 neon = neonAt(p, foot * 0.6);

  vec3 col = uBase;
  col += uWood * alb * light;

  // glossy floor reflection of the neon (stretched, softened streaks)
  float refl = 0.0;
  if (sid == 1) {
    vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
    rr = normalize(rr + vec3(0.0, 0.0, 0.0));
    int sid2;
    float t2 = traceCorridor(p + rr * 1e-3, rr, sid2);
    vec3 q = p + rr * t2;
    float blur = foot * 0.6 + t2 * 0.035;
    vec2 n2 = neonAt(q, blur);
    float fres = 0.3 + 0.7 * pow(1.0 - abs(rd.y), 3.0);
    float rough = 0.45 + 0.55 * clamp(alb * 1.4, 0.0, 1.0);
    refl = (n2.x * 1.3 + n2.y * 1.1) * fres * rough * 0.9;
  }

  float glow = neon.y + refl;
  col += uGlow * glow * 1.25;
  col += uCore * neon.x * 1.6;
  col += uReflTint * refl * 0.3;

  // filmic exposure
  col = 1.0 - exp(-col * uExposure);
  // gentle vignette
  vec2 vq = (frag / uRes) - 0.5;
  float vig = 1.0 - 1.0 * pow(length(vq * vec2(1.2, 0.9)) * 1.3, 2.0);
  col = uBase * mix(0.85, 1.0, vig) + max(col - uBase, 0.0) * clamp(vig, 0.0, 1.0);
  // fine film grain
  float gr = hash12(frag + vec2(uFrame * 17.13, uFrame * 3.71)) - 0.5;
  col += gr * 0.018;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
