// Shared GLSL helpers.
const NOISE = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1, 0, 0));
  float n010 = hash13(i + vec3(0, 1, 0));
  float n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1));
  float n101 = hash13(i + vec3(1, 0, 1));
  float n011 = hash13(i + vec3(0, 1, 1));
  float n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
`;

export const SKY_VERTEX = /* glsl */ `
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
varying vec3 vRay;
void main() {
  vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0);
  v /= v.w;
  vRay = (uCamWorld * vec4(v.xyz, 0.0)).xyz;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Night sky: gradient, milky way, two star layers, the full moon and its halo.
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uMoonDir;
uniform float uMoonRadius;    // angular radius (rad)
uniform float uPixelAngle;    // angular size of one output pixel
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uMilkyWay;
uniform vec3 uMilkyWayNormal;
uniform vec3 uMoonGlow;
uniform vec3 uMoonLight;
uniform vec3 uMoonShadow;
varying vec3 vRay;
${NOISE}

float starLayer(vec3 d, float cellRad, float density, float seed) {
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 g = vec2(az * cos(el), el) / cellRad;
  vec2 cell = floor(g);
  float h = hash12(cell + seed);
  if (h > density) return 0.0;
  vec2 off = vec2(hash12(cell + seed + 17.0), hash12(cell + seed + 41.0)) - 0.5;
  vec2 f = fract(g) - 0.5 - off * 0.8;
  float distPx = length(f) * cellRad / uPixelAngle;
  float size = 0.7 + 1.3 * pow(hash12(cell + seed + 5.0), 8.0);
  float bright = 0.1 + 0.45 * pow(hash12(cell + seed + 9.0), 4.0);
  float tw = 0.8 + 0.2 * sin(uTime * (2.0 + 4.0 * h) + h * 50.0);
  return exp(-distPx * distPx / (size * size)) * bright * tw;
}

void main() {
  vec3 d = normalize(vRay);
  float el = d.y;

  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, el));

  // milky way: a soft band along a great circle, broken up by dust lanes
  float band = exp(-pow(dot(d, uMilkyWayNormal) / 0.12, 2.0));
  float mw = fbm3(d * 6.0);
  float dust = smoothstep(0.45, 0.7, fbm3(d * 13.0 + 4.0));
  float grain = fbm3(d * 40.0);
  col += uMilkyWay * band * (0.2 + 0.9 * mw * grain) * (1.0 - 0.6 * dust);

  // stars (denser inside the milky way band)
  float stars = starLayer(d, 0.0035, 0.45 + 0.4 * band, 0.0)
              + starLayer(d, 0.0016, 0.35 + 0.45 * band, 71.0) * 0.8
              + starLayer(d, 0.0009, 0.2 + 0.5 * band, 13.0) * 0.6;
  col += vec3(0.85, 0.9, 1.0) * stars * smoothstep(-0.02, 0.06, el);

  // moon halo
  float cosA = clamp(dot(d, uMoonDir), -1.0, 1.0);
  float ang = acos(cosA);
  float rim = max(ang - uMoonRadius, 0.0);
  col += uMoonGlow * (exp(-rim / 0.022) * 0.6 + exp(-rim / 0.07) * 0.25 + exp(-rim / 0.3) * 0.04);

  // holes in the cloud deck show dim cloud below
  col = mix(col, uBelow, smoothstep(0.0, -0.04, el));

  // moon disc
  if (ang < uMoonRadius + 3.0 * uPixelAngle) {
    vec3 mr = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 mu = cross(mr, uMoonDir);
    vec2 l = vec2(dot(d, mr), dot(d, mu)) / sin(uMoonRadius);
    float z = sqrt(max(0.0, 1.0 - dot(l, l)));
    vec3 sp = vec3(l, z);
    float maria = smoothstep(0.44, 0.58, fbm3(sp * 1.7 + vec3(3.0, 1.0, 7.0)));
    maria *= 0.7 + 0.3 * fbm3(sp * 5.0 + 1.0);
    float speck = fbm3(sp * 14.0 + 2.0);
    // small craters: bright rims around darker floors
    vec3 cg = sp * 9.0;
    vec3 ci = floor(cg);
    vec3 cf = fract(cg) - 0.5 - (vec3(hash13(ci), hash13(ci + 3.1), hash13(ci + 7.3)) - 0.5) * 0.5;
    float cr = length(cf) / (0.12 + 0.18 * hash13(ci + 11.0));
    float craterRim = smoothstep(0.75, 1.0, cr) * smoothstep(1.25, 1.0, cr) * step(0.75, hash13(ci + 5.0));
    float craterFloor = smoothstep(0.9, 0.5, cr) * step(0.75, hash13(ci + 5.0));
    vec3 albedo = mix(uMoonLight, uMoonShadow, maria * 0.95);
    albedo *= 0.9 + 0.2 * speck;
    albedo *= 1.0 - 0.05 * craterFloor;
    albedo = mix(albedo, uMoonLight * 1.06, craterRim * 0.6);
    albedo *= 0.8 + 0.2 * pow(z, 0.5);   // limb darkening
    float edge = smoothstep(uMoonRadius + 1.2 * uPixelAngle, uMoonRadius - 1.2 * uPixelAngle, ang);
    col = mix(col, albedo, edge);
  }

  col += (hash12(gl_FragCoord.xy + uTime * 37.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const CLOUD_VERTEX = /* glsl */ `
attribute vec4 iPosSize;   // xyz world centre, w radius
attribute vec4 iData;      // atlas cell, horizontal flip, shade, opacity
uniform float uAtlasCells;
varying vec2 vUv;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vDir;
varying float vShade;
varying float vAlpha;
varying float vFlip;
varying float vDist;
void main() {
  vec3 c = iPosSize.xyz;
  float s = iPosSize.w;
  vec3 d = normalize(c - cameraPosition);
  // billboard that stays upright in world space (correct under camera roll)
  vec3 r = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, d);
  vec3 wp = c + (r * position.x + u * position.y) * s;
  vRight = r;
  vUp = u;
  vDir = normalize(wp - cameraPosition);
  vShade = iData.z;
  vAlpha = iData.w;
  vFlip = iData.y;
  vDist = length(c - cameraPosition);
  vec2 luv = uv;
  if (iData.y < 0.0) luv.x = 1.0 - luv.x;
  vec2 cell = vec2(mod(iData.x, uAtlasCells), floor(iData.x / uAtlasCells));
  vUv = (cell + luv) / uAtlasCells;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

export const CLOUD_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uMoonDir;
uniform vec3 uCloudDark;
uniform vec3 uCloudLit;
uniform vec3 uMoonColor;
uniform vec3 uFogColor;
uniform vec3 uFogGlow;
uniform float uFogNear;
uniform float uFogFar;
uniform float uBacklight;
varying vec2 vUv;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vDir;
varying float vShade;
varying float vAlpha;
varying float vFlip;
varying float vDist;
void main() {
  // shallow depth of field: puffs right next to the lens are softened
  float defocus = 2.2 * (1.0 - smoothstep(5.0, 20.0, vDist));
  vec4 tx = texture2D(uAtlas, vUv, defocus);
  float a = tx.r * vAlpha;
  if (a < 0.003) discard;
  vec2 nxy = tx.gb * 2.0 - 1.0;
  nxy.x *= vFlip;
  float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
  vec3 n = normalize(vRight * nxy.x + vUp * nxy.y - vDir * nz);

  float skyLight = 0.5 + 0.5 * n.y;
  skyLight *= skyLight;
  // crevices between billows (low thickness inside the silhouette) stay dark
  float cavity = mix(0.72, 1.0, smoothstep(0.0, 0.6, tx.a));
  float moonLight = max(dot(n, uMoonDir), 0.0);
  float toMoon = max(dot(vDir, uMoonDir), 0.0);
  float thin = 1.0 - tx.a;
  // silver lining: thin edges of clouds between us and the moon glow
  float forward = pow(toMoon, 10.0) * (0.2 + thin * thin * 2.2);
  float forwardWide = pow(toMoon, 3.0) * thin * 0.35;

  float lit = clamp(skyLight * vShade * cavity * 1.3, 0.0, 1.0);
  vec3 col = mix(uCloudDark, uCloudLit, lit * lit * (1.6 - 0.6 * lit));
  col += uMoonColor * (moonLight * 0.28 * vShade + (forward + forwardWide) * uBacklight);
  // bright rims along the upper outlines of billows
  float rimL = pow(1.0 - nz, 3.0) * smoothstep(-0.1, 0.7, n.y + 0.5 * dot(n, uMoonDir));
  col += uMoonColor * rimL * 0.06 * vShade * smoothstep(0.5, 1.0, tx.r);

  float fog = smoothstep(uFogNear, uFogFar, vDist);
  vec3 fogCol = uFogColor + uFogGlow * (pow(toMoon, 18.0) * 0.8 + pow(toMoon, 4.0) * 0.25);
  col = mix(col, fogCol, fog);
  gl_FragColor = vec4(col * a, a);
}
`;
