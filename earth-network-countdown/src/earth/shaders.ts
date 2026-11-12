// GLSL (WebGL 2) programs for the Earth countdown.

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3(0, 0, 0)), hash3(i + vec3(1, 0, 0)), f.x),
        mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
        mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;

/**
 * Bakes a procedural equirectangular Earth map once:
 * R = land mask, G = city lights, B = terrain detail.
 */
export const EARTH_TEX_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uTexRes;
out vec4 o;
${NOISE}
void main() {
  vec2 uv = gl_FragCoord.xy / uTexRes;
  float lon = (uv.x - 0.5) * 6.2831853;
  float lat = (uv.y - 0.5) * 3.1415927;
  vec3 p = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  vec3 w = vec3(fbm(p * 1.6 + vec3(1.0)), fbm(p * 1.6 + vec3(7.0)), fbm(p * 1.6 + vec3(13.0)));
  vec3 q = p * 1.35 + 0.75 * w;
  float h = fbm(q * 1.25 + vec3(2.0, 0.0, 5.0));
  float land = smoothstep(0.515, 0.535, h);
  float terr = fbm(p * 9.0 + vec3(3.0));
  float clusters = smoothstep(0.42, 0.72, fbm(p * 6.0 + vec3(4.0)));
  float fine = pow(vnoise(p * 300.0), 9.0) * 2.6 + pow(vnoise(p * 130.0 + 3.0), 7.0) * 1.4;
  float coast = 1.0 - smoothstep(0.0, 0.05, h - 0.525);
  float city = land * clamp(fine * (0.25 + 1.4 * clusters) + coast * clusters * 0.35 * pow(vnoise(p * 70.0), 2.0), 0.0, 1.0);
  float ice = smoothstep(1.15, 1.3, abs(lat));
  o = vec4(max(land, ice * 0.6), city * (1.0 - ice), terr, 1.0);
}`;

/** Planet, atmosphere, sun glare. Rendered into a float framebuffer. */
export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTanHalf;
uniform vec3 uCenter;
uniform mat3 uEarthRot;
uniform vec3 uSunDir;
uniform vec2 uSunPx;
uniform float uSunI;
uniform float uRimI;
uniform float uTime;
uniform vec3 uSpace, uSpaceLow, uOceanN, uLandN, uOceanD, uLandD, uCity;
uniform vec3 uRimCool, uRimWarm, uSunCore, uSunGlow, uStreak;
uniform sampler2D uEarth;
out vec4 o;
const float PI = 3.14159265;
float hash11(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  float W = uRes.x;
  float H = uRes.y;
  vec2 ndc = frag / uRes * 2.0 - 1.0;
  vec3 d = normalize(vec3(ndc.x * uTanHalf * (W / H), ndc.y * uTanHalf, -1.0));

  vec2 toSun = frag - uSunPx;
  float sunDist = length(toSun);
  float prox = exp(-pow(abs(toSun.x) / (0.21 * W), 1.7)) * exp(-max(uSunPx.y - frag.y, 0.0) / (0.4 * H));

  vec3 col = mix(uSpaceLow, uSpace, smoothstep(0.25, 0.95, frag.y / H));

  float b = dot(d, uCenter);
  float c = dot(uCenter, uCenter) - 1.0;
  float disc = b * b - c;
  vec3 closest = d * b - uCenter;
  float hgt = length(closest) - 1.0;

  float warm = clamp(prox * uRimI, 0.0, 1.0);
  vec3 rimCol = mix(uRimCool, uRimWarm, smoothstep(0.0, 0.7, warm));

  if (disc > 0.0 && b > 0.0) {
    float t = b - sqrt(disc);
    vec3 P = d * t;
    vec3 n = normalize(P - uCenter);
    vec3 ne = uEarthRot * n;
    float lat = asin(clamp(ne.y, -1.0, 1.0));
    float lon = atan(ne.z, ne.x);
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);
    dx.x -= floor(dx.x + 0.5);
    dy.x -= floor(dy.x + 0.5);
    vec4 tex = textureGrad(uEarth, uv, dx, dy);
    float land = tex.r;
    float city = tex.g;
    float terr = tex.b;
    float mu = clamp(dot(n, -d), 0.0, 1.0);
    float ndl = dot(n, uSunDir);

    vec3 night = mix(uOceanN, uLandN * (0.65 + 0.7 * terr), land);
    col = night * (0.5 + 0.5 * mu);
    // sunlit crescent near the limb
    float day = smoothstep(0.0, 0.25, ndl) * smoothstep(0.0, 0.25, 1.0 - mu);
    vec3 dayCol = mix(uOceanD, uLandD * (0.55 + 0.9 * terr), land);
    col += dayCol * day * uRimI * (0.3 + 2.6 * warm) * mix(vec3(1.0), uSunGlow * 1.3, 0.45);
    // city lights, brightest near the terminator / sunrise
    float nightMask = 1.0 - smoothstep(0.0, 0.4, ndl);
    float cityI = city * (0.12 + 2.4 * warm * warm) * (0.35 + 0.65 * nightMask);
    col += uCity * cityI * 1.4;
    // limb brightening
    float rim = pow(1.0 - mu, 4.0);
    col += rimCol * rim * (0.45 + 2.2 * warm);
    col += mix(rimCol, vec3(0.85, 0.9, 1.0), 0.35) * pow(1.0 - mu, 22.0) * (0.9 + 2.0 * warm);
    col += uRimWarm * pow(1.0 - mu, 16.0) * warm * 3.5;
  } else {
    // thin atmosphere halo just outside the limb
    float hh = max(hgt, 0.0);
    float glow = exp(-hh / 0.0045) * 0.85 + exp(-hh / 0.025) * 0.28 + exp(-hh / 0.09) * 0.06;
    col += rimCol * glow * (0.3 + 2.4 * warm);
  }

  // sun: core, halos, anamorphic streak and rays
  float si = uSunI;
  float core = exp(-pow(sunDist / (0.012 * W), 2.0)) * 3.0 + exp(-sunDist / (0.022 * W)) * 1.1;
  float halo = exp(-sunDist / (0.05 * W)) * 0.7 + exp(-sunDist / (0.2 * W)) * 0.06;
  float streak = exp(-abs(toSun.y) / (0.0016 * H)) * exp(-abs(toSun.x) / (0.28 * W)) * 1.3
               + exp(-abs(toSun.y) / (0.007 * H)) * exp(-abs(toSun.x) / (0.16 * W)) * 0.4;
  float ang = atan(toSun.y, toSun.x);
  float rays = pow(noise1(ang * 9.0 + 3.0), 3.0) * 1.1 + pow(noise1(ang * 23.0 + 11.0 + uTime * 0.12), 5.0) * 1.2;
  rays *= exp(-sunDist / (0.045 * W)) * (0.25 + 0.75 * smoothstep(-0.3, 0.7, sin(ang)));
  col += uSunCore * core * si;
  col += uSunGlow * (halo + rays * 0.9) * si;
  col += uStreak * streak * si;
  // faint warm wash over the sky when the sun is up
  col += uSunGlow * 0.012 * uRimI * exp(-sunDist / (0.35 * W));

  o = vec4(col, 1.0);
}`;

/** Instanced capsules: network edges, nodes and stars (additive). */
export const LINE_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aCorner;   // (-1|1, -1|1)
layout(location=1) in vec4 iP;        // p0.xy, p1.xy in px (y up)
layout(location=2) in vec4 iCol;      // rgb, alpha
layout(location=3) in vec3 iW;        // half width, glow radius, glow amount
uniform vec2 uRes;
out vec2 vLocal;
out float vLen;
out vec4 vCol;
out vec3 vW;
void main() {
  vec2 a = iP.xy;
  vec2 b = iP.zw;
  vec2 dir = b - a;
  float L = length(dir);
  vec2 t = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-t.y, t.x);
  float ext = max(iW.x, iW.y * 2.5) + 1.5;
  vec2 base = aCorner.x < 0.0 ? a - t * ext : b + t * ext;
  vec2 p = base + nrm * aCorner.y * ext;
  vLocal = vec2(dot(p - a, t), dot(p - a, nrm));
  vLen = L;
  vCol = iCol;
  vW = iW;
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;

export const LINE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in float vLen;
in vec4 vCol;
in vec3 vW;
out vec4 o;
void main() {
  float x = clamp(vLocal.x, 0.0, vLen);
  float d = length(vec2(vLocal.x - x, vLocal.y));
  float a = clamp(vW.x + 0.5 - d, 0.0, 1.0);
  if (vW.y > 0.0) a += vW.z * exp(-(d * d) / (vW.y * vW.y));
  o = vec4(vCol.rgb * vCol.a * a, 0.0);
}`;

/** Final pass: tone map, glitch, HUD overlay, vignette, dither. */
export const POST_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D uScene;
uniform sampler2D uHud;
uniform vec4 uHudRect;   // x, y (bottom-left, px, y up), w, h
uniform float uGlitch;
uniform float uSeed;
out vec4 o;
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 sceneAt(vec2 uv, float split) {
  vec3 c;
  c.r = texture(uScene, uv + vec2(split, 0.0)).r;
  c.g = texture(uScene, uv).g;
  c.b = texture(uScene, uv - vec2(split, 0.0)).b;
  return c;
}
vec4 hudAt(vec2 uv) {
  vec2 hp = (uv * uRes - uHudRect.xy) / uHudRect.zw;
  if (hp.x < 0.0 || hp.y < 0.0 || hp.x > 1.0 || hp.y > 1.0) return vec4(0.0);
  return texture(uHud, vec2(hp.x, 1.0 - hp.y));
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 suv = uv;
  vec2 huv = uv;
  float split = 0.0;
  if (uGlitch > 0.0) {
    float bands = 18.0 + floor(h2(vec2(uSeed, 1.0)) * 46.0);
    float band = floor(uv.y * bands + h2(vec2(uSeed, 2.0)) * 3.0);
    float r = h2(vec2(band, uSeed));
    if (r < uGlitch * 0.35) {
      suv.x += (h2(vec2(band, uSeed + 7.0)) - 0.5) * 0.04 * uGlitch;
      huv = suv;
      split = 0.003 * uGlitch;
      if (h2(vec2(band, uSeed + 13.0)) < 0.3) {
        float edge = h2(vec2(band, uSeed + 19.0));
        suv.x = h2(vec2(band, uSeed + 23.0)) < 0.5 ? max(suv.x, edge) : min(suv.x, edge);
      }
    }
  }
  vec3 c = sceneAt(suv, split);
  // soft highlight roll-off (keeps the glare from clipping harshly)
  c = 1.0 - exp(-c * 1.05);
  vec4 hud = hudAt(huv);
  c = c * (1.0 - hud.a) + hud.rgb;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - smoothstep(0.55, 1.25, length(p)) * 0.45;
  c += (h2(frag + fract(uSeed * 0.123) * 91.0) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;
