/**
 * "Smoke Portal" fragment shader (WebGL 2 / GLSL ES 3.00).
 *
 * A glowing ring ignites around a dark core with an anamorphic lens flare,
 * then erupts into billowing smoke: a hot magenta inner plume threaded with
 * white energy filaments, wrapped in an expanding blue-violet outer cloud.
 *
 * Smoke is built from domain-warped fractal noise in a slowly swirling polar
 * frame. Every value is a pure function of the frame number (deterministic).
 * The camera (zoom / roll / pan / layer parallax) is driven by uniforms so the
 * same shader serves both the static reference framing and the alternative
 * camera-move version.
 */
export const smokeFragmentShader = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uFrame;

uniform float uZoom;       // camera zoom (>1 = closer)
uniform float uRoll;       // camera roll (radians)
uniform vec2 uPan;         // camera pan (screen units)
uniform float uParallax;   // depth separation between smoke layers (0 = flat)

uniform vec3 uInner;       // hot inner plume colour
uniform vec3 uOuter;       // outer cloud colour
uniform vec3 uCore;        // filament / ring colour
uniform vec3 uHole;        // dark core colour
uniform vec3 uFlareL;      // flare colour, left side
uniform vec3 uFlareR;      // flare colour, right side

out vec4 outColor;

const float PI = 3.14159265359;

uint hashu(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float h1(ivec2 p) {
  return float(hashu(uint(p.x) * 0x9e3779b1u ^ hashu(uint(p.y) + 0x632be5abu))) * (1.0 / 4294967295.0);
}

// gradient noise, range ~[-1, 1]
vec2 grad(ivec2 p) {
  float a = h1(p) * 2.0 * PI;
  return vec2(cos(a), sin(a));
}
float gnoise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i), f);
  float b = dot(grad(i + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float c = dot(grad(i + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float d = dot(grad(i + ivec2(1, 1)), f - vec2(1.0, 1.0));
  return 1.6 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// gradient noise whose x axis repeats every \`period\` units: used for angular
// coordinates so there is no seam at the atan() branch cut (angle = +-PI).
float gnoiseP(vec2 p, int period) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  int x0 = ((i.x % period) + period) % period;
  int x1 = (x0 + 1) % period;
  float a = dot(grad(ivec2(x0, i.y)), f);
  float b = dot(grad(ivec2(x1, i.y)), f - vec2(1.0, 0.0));
  float c = dot(grad(ivec2(x0, i.y + 1)), f - vec2(0.0, 1.0));
  float d = dot(grad(ivec2(x1, i.y + 1)), f - vec2(1.0, 1.0));
  return 1.6 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// two-octave seamless angular noise; a = angle in radians
float angNoise(float a, float y, int baseCycles) {
  float x = a / (2.0 * PI) + 0.5;
  return 0.65 * gnoiseP(vec2(x * float(baseCycles), y), baseCycles)
       + 0.35 * gnoiseP(vec2(x * float(2 * baseCycles), y * 2.0 + 5.3), 2 * baseCycles);
}
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * gnoise(p);
    p = ROT * p * 2.02 + 11.3;
    a *= 0.5;
  }
  return s;
}
// billowy (turbulence) noise, ~[0, 1]
float billow(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    s += a * abs(gnoise(p));
    p = ROT * p * 2.03 + 7.7;
    a *= 0.5;
  }
  return s;
}
float noise1(float x, float seed) {
  float i = floor(x); float f = fract(x);
  float a = h1(ivec2(int(i), int(seed)));
  float b = h1(ivec2(int(i) + 1, int(seed)));
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// swirl around the core: inner smoke rotates faster than outer smoke
vec2 swirl(vec2 p, float t, float k) {
  float r = length(p);
  float ang = k * (0.07 * t + 0.35 * sin(0.45 * t + 0.5) * exp(-r * 2.5));
  return rot(ang) * p;
}

// smoke layer density: ragged radial envelope x billowy, flowing texture
float smoke(vec2 p, float t, float radius, float seed, float lobes, float flow, float warpAmt, float contrast) {
  vec2 q = swirl(p, t, flow);
  float r = length(q);
  float a = atan(q.y, q.x);
  vec2 dir = vec2(cos(a), sin(a));
  // ragged, slowly morphing outline (lobes / arms)
  float edgeN = fbm(dir * lobes + vec2(seed, t * 0.22 + seed), 4);
  float R = radius * (1.0 + 0.6 * edgeN);
  // domain warp makes billows and tendrils
  vec2 w = vec2(fbm(q * 2.4 + vec2(seed, t * 0.21), 4), fbm(q * 2.4 + vec2(-t * 0.18, seed + 3.1), 4));
  vec2 qw = q + warpAmt * w;
  float rw = length(qw);
  float env = smoothstep(R, R * 0.45, rw + 0.08 * w.x);
  float tex = 0.5 + 0.55 * fbm(qw * 3.6 + vec2(seed * 1.7, t * 0.15), 5);
  float dens = env * mix(0.25 + 1.1 * tex, smoothstep(0.30, 0.72, tex) * 1.25, contrast);
  return clamp(dens, 0.0, 1.5);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;    // y up, height = 1
  float f = uFrame;
  float t = f / 30.0;

  // ---- camera --------------------------------------------------------------
  vec2 cuv = rot(uRoll) * (uv - uPan);
  vec2 pNear = cuv / uZoom;                                 // plume / core layer
  vec2 pFar = cuv / mix(uZoom, 1.0 + (uZoom - 1.0) * 0.55, uParallax); // outer cloud (further back)

  // ---- timeline --------------------------------------------------------------
  float ignite = smoothstep(1.0, 3.5, f);                        // ring appears
  float burst = smoothstep(9.0, 22.0, f);                        // plume erupts
  float plumeR = 0.05 + 0.36 * (1.0 - exp(-max(f - 8.0, 0.0) / 17.0)) + 0.08 * smoothstep(60.0, 300.0, f);
  float outerR = plumeR * 1.12 + 0.62 * (1.0 - exp(-max(f - 16.0, 0.0) / 34.0)) + 0.10 * smoothstep(90.0, 300.0, f);
  float outerOn = smoothstep(18.0, 36.0, f);
  float hot = exp(-max(f - 12.0, 0.0) / 22.0);                  // early smoke is white-hot

  // ---- background --------------------------------------------------------------
  float vgn = length(uv * vec2(0.9, 1.2));
  vec3 col = vec3(0.012, 0.010, 0.014) * (1.0 - smoothstep(0.0, 0.9, vgn)) + vec3(0.002);

  // ---- outer blue-violet cloud ---------------------------------------------------
  float dOut = smoke(pFar, t, outerR, 4.0, 1.2, 0.5, 0.16, 0.75) * outerOn;
  float rFar = length(pFar);
  float outerShade = 0.30 + 0.95 * smoothstep(-0.45, 0.55, fbm(pFar * 2.8 + vec2(t * 0.05, 2.0), 5));
  vec3 outerCol = uOuter * outerShade * (0.55 + 0.6 * exp(-rFar / 0.45));
  float aOut = clamp(dOut * 0.9, 0.0, 1.0);
  col = mix(col, outerCol, aOut);

  // ---- inner magenta plume ------------------------------------------------------
  float dIn = smoke(pNear, t, plumeR, 1.0, 1.4, 0.8, 0.20, 0.35) * burst;
  float rN = length(pNear);
  vec3 innerCol = uInner * (0.5 + 0.25 * exp(-rN / 0.12)) * (0.6 + 0.7 * smoothstep(-0.4, 0.5, fbm(pNear * 5.0 + vec2(1.0, t * 0.2), 4)));
  innerCol = mix(innerCol, mix(uInner, uCore, 0.75), hot * 0.85);
  // soft pink/blue fringe where the plume meets the outer cloud
  innerCol = mix(innerCol, mix(uInner, uOuter, 0.45), smoothstep(0.35, 0.05, dIn) * 0.5);
  float aIn = clamp(dIn * 1.05, 0.0, 1.0);
  col = mix(col, innerCol, aIn);

  // ---- white energy filaments swirling around the core --------------------------
  vec2 qs = swirl(pNear, t, 1.4);
  vec2 fw = vec2(fbm(qs * 2.5 + vec2(t * 0.3, 1.0), 3), fbm(qs * 2.5 + vec2(7.0, -t * 0.3), 3));
  vec2 qf = qs + 0.12 * fw;
  float rf = length(qf);
  float af = atan(qf.y, qf.x);
  float ridge = 1.0 - abs(gnoiseP(vec2((af / (2.0 * PI) + 0.5) * 6.0, rf * 9.0 - t * 0.6) + fw * 2.0, 6));
  float ridge2 = 1.0 - abs(gnoise(qf * 7.0 + vec2(t * 0.4, 3.0)));
  float fil = pow(ridge, 14.0) + 0.5 * pow(ridge2, 18.0);
  float filMask = smoothstep(0.06, 0.1, rN) * (1.0 - smoothstep(0.10, max(plumeR * 0.85, 0.13), rN)) * burst;
  col += uCore * fil * filMask * (0.24 + 0.5 * hot);

  // ---- the igniting ring --------------------------------------------------------
  float ringR = 0.095 + 0.03 * burst;
  float ringN = angNoise(atan(pNear.y, pNear.x), t * 2.0, 9);
  float ringD = rN - ringR - 0.012 * ringN;
  float ringW = 0.022 + 0.012 * burst;
  float ring = exp(-pow(ringD / ringW, 2.0));
  float ringFuzz = billow(pNear * 18.0 + vec2(t * 0.8, 0.0), 3);
  float ringLevel = ignite * (1.0 - 0.8 * burst) * (0.85 + 0.3 * ringFuzz);
  col += mix(uInner, uCore, 0.7) * ring * ringLevel * 1.4;
  col += uInner * exp(-pow(ringD / 0.09, 2.0)) * ignite * 0.25 * (1.0 - 0.85 * burst);

  // bright rim right around the core (persists)
  float rimN = angNoise(atan(pNear.y, pNear.x), t * 0.8 + 3.0, 6);
  float rim = exp(-pow((rN - 0.083 - 0.01 * rimN) / 0.022, 2.0));
  col += mix(uCore, uInner, 0.3) * rim * burst * 0.55;

  // ---- dark core ---------------------------------------------------------------------
  float holeR = 0.072 + 0.004 * sin(t * 1.3);
  float hole = 1.0 - smoothstep(holeR - 0.012, holeR + 0.008, rN + 0.006 * rimN);
  vec3 holeCol = uHole * (0.6 + 0.5 * smoothstep(0.0, holeR, rN));
  col = mix(col, holeCol, hole * ignite);

  // ---- anamorphic lens flare ---------------------------------------------------------
  float flareEnv = ignite * (1.0 - smoothstep(20.0, 50.0, f)) * 1.0
                 + 0.35 * smoothstep(150.0, 175.0, f) * (1.0 - smoothstep(205.0, 260.0, f))
                 + 0.25 * smoothstep(236.0, 250.0, f) * (1.0 - smoothstep(262.0, 300.0, f));
  vec2 fuv = rot(uRoll * 0.0) * (uv - uPan * 0.5);
  float bands = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float y0 = (h1(ivec2(i, 7)) - 0.5) * 0.16;
    float w = 0.012 + 0.05 * h1(ivec2(i, 9));
    bands += exp(-pow((fuv.y - y0) / w, 2.0)) * (0.4 + 0.6 * h1(ivec2(i, 3)));
  }
  float hfall = exp(-abs(fuv.x) / 1.1);
  float flareBody = exp(-pow(fuv.y / 0.16, 2.0)) * 0.55 + bands * 0.35;
  vec3 flareCol = mix(uFlareL, uFlareR, smoothstep(-0.35, 0.35, fuv.x));
  col += flareCol * flareBody * hfall * flareEnv * 0.55;

  // ---- grade ------------------------------------------------------------------------------
  col *= mix(0.55, 1.0, smoothstep(1.15, 0.3, vgn));
  col = 1.0 - exp(-col * 1.25);
  col = pow(col, vec3(1.0 / 2.2));
  col += (h1(ivec2(frag) + ivec2(int(uFrame) * 7, 11)) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
