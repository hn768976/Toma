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

// Night sky: gradient, horizon haze, milky way, star layers, the full moon and
// its halo.
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uMoonDir;
uniform float uMoonRadius;    // angular radius (rad)
uniform float uPixelAngle;    // angular size of one output pixel
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uLowSky;
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
  // below the horizon the sky keeps going, darkening through a soft haze band
  col = mix(col, uLowSky, smoothstep(0.0, -0.3, el));
  float haze = exp(-abs(el) / 0.07);

  // milky way: a soft band along a great circle, broken up by dust lanes
  float band = exp(-pow(dot(d, uMilkyWayNormal) / 0.12, 2.0));
  float mw = fbm3(d * 6.0);
  float dust = smoothstep(0.45, 0.7, fbm3(d * 13.0 + 4.0));
  float grain = fbm3(d * 40.0);
  col += uMilkyWay * band * (0.2 + 0.9 * mw * grain) * (1.0 - 0.6 * dust);

  // stars (denser inside the milky way band)
  float stars = starLayer(d, 0.0035, 0.32 + 0.3 * band, 0.0)
              + starLayer(d, 0.0016, 0.25 + 0.35 * band, 71.0) * 0.8
              + starLayer(d, 0.0009, 0.2 + 0.5 * band, 13.0) * 0.6;
  col += vec3(0.85, 0.9, 1.0) * stars * (1.0 - 0.85 * haze)
         * smoothstep(uMoonRadius * 1.15, uMoonRadius * 1.8, acos(clamp(dot(d, uMoonDir), -1.0, 1.0)));

  // moon halo
  float cosA = clamp(dot(d, uMoonDir), -1.0, 1.0);
  float ang = acos(cosA);
  float rim = max(ang - uMoonRadius, 0.0);
  col += uMoonGlow * (exp(-rim / 0.02) * 0.45 + exp(-rim / 0.07) * 0.22 + exp(-rim / 0.3) * 0.04);


  // moon disc
  if (ang < uMoonRadius + 3.0 * uPixelAngle) {
    vec3 mr = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 mu = cross(mr, uMoonDir);
    vec2 l = vec2(dot(d, mr), dot(d, mu)) / sin(uMoonRadius);
    float z = sqrt(max(0.0, 1.0 - dot(l, l)));
    vec3 sp = vec3(l, z);
    // maria: large dark basins with fairly crisp shorelines and smooth floors
    vec3 w = vec3(fbm3(sp * 1.6 + 4.0), fbm3(sp * 1.6 + 9.0), 0.0);
    float basin = fbm3(sp * 2.2 + w * 1.1 + vec3(3.0, 1.0, 7.0)) + 0.12 * (l.y * 0.7 + l.x * 0.3);
    float maria = smoothstep(0.47, 0.6, basin);
    maria *= 0.55 + 0.45 * fbm3(sp * 5.0 + 1.0);
    // highland grain
    float grain = fbm3(sp * 34.0 + 2.0);
    // fresh craters: small bright spots with soft halos, at two scales
    float fresh = 0.0;
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 11.0 : 24.0;
      vec3 cg = sp * sc + float(k) * 17.0;
      vec3 ci = floor(cg);
      vec3 cf = fract(cg) - 0.5 - (vec3(hash13(ci), hash13(ci + 3.1), hash13(ci + 7.3)) - 0.5) * 0.6;
      float on = step(0.72, hash13(ci + 5.0));
      float r = length(cf) / (0.05 + 0.08 * hash13(ci + 11.0));
      fresh += on * (smoothstep(1.0, 0.3, r) * 0.6 + smoothstep(2.6, 1.0, r) * 0.15);
    }
    // a Tycho-like crater in the south with long bright rays
    vec2 ty = vec2(-0.18, -0.62);
    vec2 tv = l - ty;
    float td = length(tv);
    float rays = pow(vnoise(vec3(atan(tv.y, tv.x) * 9.0, 0.0, 3.0)), 6.0) * exp(-td * 2.6);
    float tycho = smoothstep(0.06, 0.02, td) + smoothstep(0.14, 0.05, td) * 0.35;
    vec3 albedo = mix(uMoonLight, uMoonShadow, maria * 0.9);
    albedo *= 0.88 + 0.18 * grain;
    albedo = mix(albedo, uMoonLight * 1.05, clamp(fresh * 0.9 + rays * 0.8 + tycho * 0.6, 0.0, 1.0));
    albedo *= 1.0 - 0.32 * smoothstep(-0.2, 1.0, l.x);   // darker right limb
    albedo *= 0.86 + 0.14 * pow(z, 0.5);   // gentle limb darkening
    float edge = smoothstep(uMoonRadius + 1.2 * uPixelAngle, uMoonRadius - 1.2 * uPixelAngle, ang);
    col = mix(col, albedo, edge);
  }

  col += (hash12(gl_FragCoord.xy + uTime * 37.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
