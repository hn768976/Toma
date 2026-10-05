import { COMMON_GLSL } from "./common";

// Cosmic-vortex look. Gas is a logarithmic spiral: in log-polar coordinates
// (ln r, theta + twist * ln r) the arms are straight, so layered fbm with a
// domain warp, sampled in those coordinates, winds into a spiral whose detail
// scales with radius. Each layer turns a whole number of times per loop;
// "boiling" evolution translates the noise around a circle in noise space
// (period = the loop). A rotating trailing spiral reads as gas flowing inward.
//
// MODE 0 = flat top-down eye, 1 = raymarched funnel surface, 2 = nebula spiral
// Compile-time quality: OCTAVES, LAYERS, MARCH_STEPS.

export const VORTEX_FRAG = /* glsl */ `
${COMMON_GLSL}

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uPhase;
uniform vec2 uCenter;          // spiral centre (frame-height units, 0 = frame centre)
uniform float uZoom;
uniform float uTwist;
uniform vec3 uTurns;           // whole turns per loop for the three layers
uniform vec2 uFreq;            // (log-radial, angular) base frequency
uniform float uStreak;         // anisotropy of the fine streak layer
uniform float uStreakMix;      // 0 = billowy clouds, 1 = streaky gas
uniform vec2 uContrast;        // density smoothstep range
uniform vec2 uTilt;            // (angle rad, squash): view the swirl obliquely (modes 0, 2)
uniform vec2 uArms;            // (count, strength) spiral-arm modulation
uniform vec2 uGlow;            // (strength, radius) core bloom (mode 0)
uniform vec3 uColGlow;
uniform vec2 uRim;             // (strength, angle) one-sided brightening of the eye rim
uniform vec2 uSide;            // (strength, angle) one-sided brightening of the gas
uniform float uNearFade;       // funnel: dark gas on the camera side
uniform float uWarp;
uniform float uEvolve;         // radius of the time circle in noise space
uniform float uCoreR;          // brightness envelope radius
uniform float uOuterR;         // wisps fade-out radius
uniform float uGain;
uniform vec3 uColBg;
uniform vec3 uColGas;
uniform vec3 uColHi;
uniform vec3 uColAccent;       // eye (0) / specks (1) / filaments (2)
uniform float uEyeR;
uniform float uRingBright;
uniform float uDarkR;
uniform float uStarDensity;
uniform float uStarBright;
uniform float uSeed;
// funnel
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalf;
uniform float uDepth;
uniform float uThroat;
uniform float uLayerSep;
uniform float uHoleR;

// Spiral gas density at log-radius lr, angle th. fpL = pixel footprint in
// log-radius units. Returns (density, streak ridge).
vec2 swirl(float lr, float th, float fpL) {
  float t = uPhase;
  vec2 tc = uEvolve * vec2(cos(TAU * t), sin(TAU * t));

  // layer 0: big clouds (also produces the warp)
  float a0 = th + uTwist * lr - TAU * uTurns.x * t;
  vec3 q0 = vec3(lr * uFreq.x, cos(a0) * uFreq.y + tc.x, sin(a0) * uFreq.y + tc.y);
  float w = fbmLod(q0, OCTAVES, fpL * uFreq.x);

  // layer 1: medium billows, domain-warped by layer 0
  float a1 = th + uTwist * lr - TAU * uTurns.y * t + uWarp * (w - 0.5) * 2.0;
  vec3 q1 = vec3(lr * uFreq.x * 2.1 + uWarp * (w - 0.5) * 3.0,
                 cos(a1) * uFreq.y * 1.7 - tc.y, sin(a1) * uFreq.y * 1.7 + tc.x);
  float c = fbmLod(q1 + 13.1, OCTAVES, fpL * uFreq.x * 2.1);

  // layer 2: fine streaks along the arms (high radial, low angular freq)
  float a2 = th + uTwist * lr - TAU * uTurns.z * t + uWarp * 0.6 * (c - 0.5);
  vec3 q2 = vec3(lr * uFreq.x * uStreak, cos(a2) * uFreq.y * 1.3 + tc.x * 0.5,
                 sin(a2) * uFreq.y * 1.3 + tc.y * 0.5);
  float s = fbmLod(q2 + 41.3, OCTAVES, fpL * uFreq.x * uStreak);
  float ridge = 1.0 - abs(2.0 * s - 1.0);
  ridge = ridge * ridge * ridge;

  float dc = smoothstep(uContrast.x, uContrast.y, 0.45 * w + 0.55 * c);
  float ds = smoothstep(uContrast.x, uContrast.y, 0.25 * w + 0.3 * c + 0.45 * s);
  float d = mix(dc, ds, uStreakMix) * (0.75 + 0.5 * s);
  if (uArms.y > 0.0) {
    // integer arm count and whole turns per loop keep this periodic
    float arm = 0.5 + 0.5 * cos(uArms.x * (th + uTwist * lr - TAU * uTurns.x * t) + 2.0 * (w - 0.5));
    d *= mix(1.0, smoothstep(0.15, 0.85, arm), uArms.y);
  }
  return vec2(d, ridge);
}

vec3 starField(vec2 p, float scale, float pxSize) {
  vec3 col = vec3(0.0);
  for (int L = 0; L < 2; L++) {
    float K = (L == 0 ? 70.0 : 18.0) * scale;
    vec2 g = p * K;
    ivec2 cell = ivec2(floor(g));
    vec3 h = hash33i(ivec3(cell, int(uSeed) + L * 517));
    if (h.z < uStarDensity * (L == 0 ? 1.0 : 0.4)) {
      vec2 sp = (vec2(cell) + 0.2 + 0.6 * h.xy) / K;
      float d = length(p - sp);
      float baseR = L == 0 ? 0.0012 : 0.0024;
      float rad = max(baseR, pxSize * 1.1);
      float flux = baseR * baseR / (rad * rad);
      float mag = pow(hash13i(ivec3(cell, 91 + L)), 5.0) * 3.0 + 0.2;
      col += vec3(exp(-d * d / (rad * rad)) * flux * mag) * (L == 0 ? 1.0 : 3.0);
      // soft glow around bright stars, windowed so it never reaches the cell edge
      if (L == 1) col += vec3(exp(-d / (rad * 4.0)) * 0.08 * mag * flux * (1.0 - smoothstep(0.08, 0.18, d * K)));
    }
  }
  return col * uStarBright;
}

// Gold-white specks on the funnel plane. Cells live in plane coordinates
// that turn rigidly with the gas (whole turns per loop), so the specks stay
// round, move with the flow and never sparkle.
float specks(vec2 xz, float fp, float K, int seed) {
  float ang = -TAU * uTurns.z * uPhase;
  vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * xz * K;
  ivec2 cell = ivec2(floor(q));
  vec3 h = hash33i(ivec3(cell, seed));
  if (h.z > uStarDensity) return 0.0;
  vec2 f = fract(q) - (0.25 + 0.5 * h.xy);
  float r0 = 0.07;
  float rad = max(r0, fp * K * 0.7);
  float flux = r0 * r0 / (rad * rad);
  return exp(-dot(f, f) / (rad * rad)) * flux * (0.3 + 3.0 * pow(hash13i(ivec3(cell, 7)), 3.0));
}

vec3 rampGas(float v) {
  vec3 c = mix(uColBg, uColGas, smoothstep(0.0, 0.55, v));
  c = mix(c, uColHi, smoothstep(0.45, 1.25, v));
  return c * (0.35 + 0.65 * smoothstep(0.0, 0.35, v));
}

#if MODE == 1
float hFun(float r) { return -uDepth * uThroat / sqrt(r * r + uThroat * uThroat); }
#endif

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uvH = (frag - 0.5 * uRes) / uRes.y;       // frame-height units
  float px = 1.0 / uRes.y;
  vec3 col = uColBg;

#if MODE == 0 || MODE == 2
  vec2 p = (uvH - uCenter) / uZoom;
  float ca = cos(uTilt.x), sa = sin(uTilt.x);
  p = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
  p.y /= uTilt.y;
  float r = max(length(p), 1e-4);
  float th = atan(p.y, p.x);
  float lr = log(r);
  float fpL = px / uZoom / r;
  vec2 g = swirl(lr, th, fpL);

  float env = exp(-pow(r / uCoreR, 1.15)) * 1.6 + 0.35 * exp(-r / uOuterR);
  float wisp = 1.0 - smoothstep(uOuterR * 0.5, uOuterR * 1.4, r);

  #if MODE == 0
    float gas = g.x * env * wisp + 0.35 * g.y * g.x * env;
    gas *= smoothstep(uEyeR * 0.85, uEyeR * 1.6, r);
    gas *= 1.0 + uSide.x * cos(th - uSide.y);
    col = rampGas(gas * uGain);
    col += uColGlow * uGlow.x * exp(-pow(r / uGlow.y, 1.3)) * (0.6 + 0.6 * g.x);
    // eye: cyan-blue disc with a small dark centre
    float eye = 1.0 - smoothstep(uEyeR * 0.9, uEyeR * 1.05, r);
    float eyeIn = smoothstep(uEyeR * 0.12, uEyeR * 0.75, r);
    vec3 eyeCol = uColAccent * (0.35 + 1.1 * eyeIn) * (0.9 + 0.2 * g.y);
    col = mix(col, eyeCol, eye);
    // blazing white ring with soft glow
    float rw = max(uEyeR * 0.09, px * 1.5 / uZoom);
    float ring = exp(-pow((r - uEyeR) / rw, 2.0)) * (1.0 - uRim.x + uRim.x * (0.5 + 0.5 * cos(th - uRim.y)));
    col += vec3(1.0, 0.97, 1.0) * uRingBright * (ring + 0.35 * exp(-abs(r - uEyeR) / (uEyeR * 0.6)));
    col += starField(uvH, 1.0, px) * (1.0 - smoothstep(0.0, 0.25, gas));
    // faint purple nebulosity that carries the haze out to the frame edges
    col += uColGas * 0.05 * smoothstep(0.3, 0.8, g.x) * exp(-r / (uOuterR * 1.5));
  #else
    // nebula: dark empty centre, thick arms with bright rims lit from inside
    float hole = smoothstep(uDarkR * 0.6, uDarkR * 2.0, r);
    vec2 g2 = swirl(lr - 0.06, th, fpL);
    float dens = g.x * env * wisp * hole;
    float dens2 = g2.x * env * wisp * hole;
    float rim = clamp((dens - dens2) * 4.0, 0.0, 1.0);
    vec3 c = rampGas(dens * uGain);
    c += uColHi * rim * dens * 2.2;
    // magenta filaments along the inner arms
    float inner = smoothstep(uDarkR * 0.8, uDarkR * 2.2, r) * (1.0 - smoothstep(uCoreR * 0.8, uCoreR * 2.4, r));
    c += uColAccent * g.y * inner * 1.6 * dens * uGain;
    float occl = smoothstep(0.0, 0.5, dens * uGain);
    col = c + starField(uvH, 1.0, px) * (1.0 - occl);
  #endif
#endif

#if MODE == 1
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 rd = normalize(uCamFwd + ndc.x * uTanHalf * aspect * uCamRight + ndc.y * uTanHalf * uCamUp);
  vec3 ro = uCamPos;
  float T = 1.0;
  vec3 acc = vec3(0.0);
  float pixAng = 2.0 * uTanHalf * px;
  for (int l = LAYERS - 1; l >= 0; l--) {
    float off = float(l) * uLayerSep;
    if (rd.y >= -1e-4) break;
    float s0 = (ro.y - off) / -rd.y;
    float s1 = (ro.y - off + uDepth) / -rd.y;
    float sa = s0, sb = s1;
    float prev = s0;
    bool hit = false;
    for (int k = 1; k <= MARCH_STEPS; k++) {
      float sk = mix(s0, s1, pow(float(k) / float(MARCH_STEPS), 1.6));
      vec3 q = ro + rd * sk;
      if (q.y - off - hFun(length(q.xz)) < 0.0) { sa = prev; sb = sk; hit = true; break; }
      prev = sk;
    }
    if (!hit) continue;
    for (int k = 0; k < 6; k++) {
      float sm = 0.5 * (sa + sb);
      vec3 q = ro + rd * sm;
      if (q.y - off - hFun(length(q.xz)) < 0.0) sb = sm; else sa = sm;
    }
    float sh = 0.5 * (sa + sb);
    vec3 q = ro + rd * sh;
    float r = max(length(q.xz), 1e-3);
    float th = atan(q.z, q.x);
    float lr = log(r);
    // footprint in log-r: distance * pixel angle / r, widened on steep walls
    float fpL = sh * pixAng / r * 1.4;
    vec2 g = swirl(lr + float(l) * 0.37, th + float(l) * 1.7, fpL);
    float depthF = clamp(-hFun(r) / uDepth, 0.0, 1.0);
    float holeM = smoothstep(uHoleR, uHoleR * 2.2, r);
    // ragged outer edge: the fade radius is modulated by the gas itself
    float outer = 1.0 - smoothstep(uOuterR * 0.3, uOuterR, r * (0.7 + 0.6 * g.x));
    float near = smoothstep(0.0, 0.9, dot(q.xz / r, normalize(uCamPos.xz + 1e-4))) * smoothstep(0.8, 2.2, r);
    outer *= 1.0 - uNearFade * near;
    float dens = g.x * holeM * outer * (l == 0 ? 1.0 : 0.6);
    // brightest on the lip and upper throat wall, fading to black at the bottom
    float lip = smoothstep(0.05, 0.45, depthF) * (1.0 - smoothstep(0.75, 0.98, depthF));
    float bright = (0.35 + 1.4 * g.y) * (0.55 + 1.3 * lip) * (1.0 + uSide.x * cos(th - uSide.y));
    vec3 c = rampGas(dens * bright * uGain);
    float a = clamp(dens * (l == 0 ? 1.6 : 1.0), 0.0, 1.0);
    float cluster = smoothstep(0.45, 0.75, vnoise(vec3(q.xz * 0.7, 3.3)));
    float sp = specks(q.xz, sh * pixAng, 14.0, 4242) * holeM * (0.25 + 1.5 * cluster);
    c += uColAccent * sp * (0.6 + 0.4 * (1.0 - depthF));
    // fine white-blue glitter riding in the gas
    float gl = specks(q.xz, sh * pixAng, 30.0, 977) * holeM * outer * (0.3 + g.x) * 1.5;
    c += mix(uColGas, uColHi, 0.7) * gl * 3.0;
    if (l == 0) {
      // bottom shell is opaque: gas over a dark funnel wall, black throat
      acc += T * c;
      T = 0.0;
    } else {
      acc += T * c * a;
      T *= 1.0 - a * 0.85;
    }
  }
  col = acc + T * uColBg;
#endif

  fragColor = vec4(col, 1.0);
}
`;
