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

// Smoke layer density: a ragged radial envelope (lobes / arms) filled with a
// mix of puffy billows and streaky radial fibres, all domain-warped.
float smoke(vec2 p, float t, float radius, vec2 stretch, float seed, float lobes,
            float flow, float warpAmt, float edgeAmt, float fiber, out float fibOut) {
  vec2 q = swirl(p, t, flow) / stretch;
  float r = length(q);
  vec2 dir = q / max(r, 1e-4);
  float edgeN = fbm(dir * lobes + vec2(seed, t * 0.2 + seed), 4);
  float R = radius * (1.0 + edgeAmt * edgeN);
  vec2 w = vec2(fbm(q * 2.2 + vec2(seed, t * 0.2), 4), fbm(q * 2.2 + vec2(-t * 0.17, seed + 3.1), 4));
  vec2 qw = q + warpAmt * w;
  float rw = length(qw);
  float env = smoothstep(R, R * 0.5, rw + 0.08 * w.x);
  float puff = 0.5 + 0.55 * fbm(qw * 3.4 + vec2(seed * 1.7, t * 0.15), 5);
  vec2 dw = qw / max(rw, 1e-4);
  float fib = 0.5 + 0.6 * fbm(dw * 7.0 + vec2(rw * 2.5 - t * 0.12, seed), 4);
  float tex = mix(puff, fib, fiber);
  // fine billowing detail (crisp smoke edges and creases)
  float det = billow(qw * 13.0 + vec2(t * 0.25, seed * 2.3), 3);
  tex *= 0.72 + 0.62 * det;
  fibOut = mix(fib, fib * (0.7 + 0.6 * det), 0.7);
  return env * smoothstep(0.15, 0.70, tex) * 1.4;
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
  float ignite = smoothstep(1.0, 3.5, f);                     // ring appears
  float grow = 1.0 - exp(-max(f - 3.0, 0.0) / 14.0);           // explosive expansion
  float burst = smoothstep(4.0, 14.0, f);
  float plumeR = 0.06 + 0.38 * grow + 0.08 * smoothstep(60.0, 300.0, f);
  float outerR = plumeR * 1.15 + 0.05 + 0.55 * (1.0 - exp(-max(f - 12.0, 0.0) / 30.0));
  float outerOn = smoothstep(9.0, 22.0, f);
  float hot = exp(-max(f - 8.0, 0.0) / 24.0);                 // early smoke is white-hot
  float settle = smoothstep(30.0, 100.0, f);                  // plume turns streaky & elongated
  vec2 stretch = mix(vec2(1.0), vec2(1.5, 0.85), settle);

  // ---- background --------------------------------------------------------------
  float vgn = length(uv * vec2(0.9, 1.2));
  vec3 col = vec3(0.012, 0.010, 0.014) * (1.0 - smoothstep(0.0, 0.9, vgn)) + vec3(0.002);

  // ---- outer blue-violet cloud ---------------------------------------------------
  float fibO;
  float dOut = smoke(pFar, t, outerR, vec2(1.15, 0.95), 4.0, 1.2, 0.5, 0.16, 0.5, 0.0, fibO) * outerOn;
  float rFar = length(pFar);
  float outerShade = (0.18 + 1.0 * smoothstep(-0.35, 0.55, fbm(pFar * 2.6 + vec2(t * 0.05, 2.0), 5))) * (0.7 + 0.6 * billow(pFar * 11.0 + vec2(3.0, t * 0.2), 3));
  vec3 outerCol = uOuter * outerShade * (0.45 + 0.6 * exp(-rFar / 0.45));
  outerCol = mix(outerCol, mix(uOuter, uInner, 0.35), 0.35 * hot);
  col = mix(col, outerCol, clamp(dOut * 0.9, 0.0, 1.0));

  // ---- inner magenta plume ------------------------------------------------------
  float fibI;
  float dIn = smoke(pNear, t, plumeR, stretch, 1.0, 1.1, 0.8, mix(0.18, 0.30, settle), mix(0.3, 0.75, settle), 0.28 * settle, fibI) * burst;
  float rN = length(pNear);
  vec3 innerCol = uInner * (0.75 + 0.45 * exp(-rN / 0.2)) * (0.75 + 0.5 * fibI);
  innerCol = mix(innerCol, mix(uInner, uCore, 0.6), hot * 0.35);
  // white-hot heart and lighter swirls inside the plume
  innerCol = mix(innerCol, mix(uInner, uCore, 0.55), clamp(exp(-rN / 0.14) * 0.4 + smoothstep(0.66, 0.98, fibI) * 0.3, 0.0, 0.55));
  innerCol *= 0.8 + 0.4 * smoothstep(0.2, 0.8, dIn);
  innerCol = mix(innerCol, mix(uInner, uOuter, 0.5), smoothstep(0.5, 0.05, dIn) * 0.45);
  col = mix(col, innerCol, clamp(dIn * 1.5, 0.0, 1.0));

  // ---- white energy ribbons looping around the core -------------------------------
  vec2 pr = pNear / mix(vec2(1.0), vec2(1.22, 0.9), settle);
  vec2 prs = swirl(pr, t, 0.6);
  float rr = length(prs);
  float ar = atan(prs.y, prs.x);
  float rib = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float Ri = (0.13 + 0.06 * fi) * (1.0 + (0.26 + 0.2 * fi) * angNoise(ar, t * 0.35 + fi * 7.0, 2 + i));
    float wi = 0.010 + 0.008 * fi;
    float fade = smoothstep(-0.35, 0.5, angNoise(ar, t * 0.5 + fi * 3.0 + 11.0, 2 + i));
    rib += exp(-pow((rr - Ri) / wi, 2.0)) * (1.0 - 0.35 * fi) * mix(0.55 + 0.45 * fade, fade, fi);
  }
  float ribGlow = exp(-pow((rr - 0.135) / 0.06, 2.0));
  // fine wisps riding the plume fibres
  float wisp = pow(max(fibI - 0.55, 0.0) * 2.2, 3.0) * (1.0 - smoothstep(0.12, max(plumeR * 0.9, 0.13), rN));
  col += uCore * (rib * 0.5 + ribGlow * 0.25 + wisp * 0.3) * burst * (0.7 + 0.6 * hot);

  // ---- the igniting ring (first frames) ------------------------------------------
  float ringR = 0.10 + 0.07 * grow;
  float ringN = angNoise(atan(pNear.y, pNear.x), t * 2.0, 9);
  float ringD = rN - ringR - 0.02 * ringN;
  float ring = exp(-pow(ringD / (0.03 + 0.03 * grow), 2.0));
  float ringFuzz = billow(pNear * 16.0 + vec2(t * 0.8, 0.0), 3);
  col += mix(uInner, uCore, 0.75) * ring * ignite * (1.0 - smoothstep(10.0, 30.0, f)) * (0.9 + 0.4 * ringFuzz) * 0.95;
  col += uInner * exp(-pow(ringD / 0.12, 2.0)) * ignite * 0.25 * (1.0 - smoothstep(8.0, 30.0, f));

  // bright rim right around the core (persists)
  float rimN = angNoise(atan(pNear.y, pNear.x), t * 0.8 + 3.0, 6);
  float rim = exp(-pow((rN - 0.085 - 0.01 * rimN) / 0.02, 2.0));
  col += mix(uCore, uInner, 0.4) * rim * burst * 0.35;

  // ---- anamorphic lens flare ---------------------------------------------------------
  float flareEnv = ignite * (1.0 - smoothstep(20.0, 50.0, f)) * 1.0
                 + 0.35 * smoothstep(150.0, 175.0, f) * (1.0 - smoothstep(205.0, 260.0, f))
                 + 0.25 * smoothstep(236.0, 250.0, f) * (1.0 - smoothstep(262.0, 300.0, f));
  vec2 fuv = rot(uRoll * 0.0) * (uv - uPan * 0.5);
  float bands = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float y0 = (h1(ivec2(i, 7)) - 0.5) * 0.36;
    float w = 0.012 + 0.05 * h1(ivec2(i, 9));
    bands += exp(-pow((fuv.y - y0) / w, 2.0)) * (0.4 + 0.6 * h1(ivec2(i, 3)));
  }
  float hfall = exp(-abs(fuv.x) / 1.1);
  float flareBody = exp(-pow(fuv.y / 0.16, 2.0)) * 0.55 + bands * 0.35;
  vec3 flareCol = mix(uFlareL, uFlareR, smoothstep(-0.35, 0.35, fuv.x));
  col += flareCol * flareBody * hfall * flareEnv * 0.55;

  // ---- dark core ---------------------------------------------------------------------
  float holeR = 0.072 + 0.004 * sin(t * 1.3);
  float hole = 1.0 - smoothstep(holeR - 0.012, holeR + 0.008, rN + 0.006 * rimN);
  vec3 holeCol = uHole * (0.6 + 0.5 * smoothstep(0.0, holeR, rN));
  col = mix(col, holeCol, hole * ignite);

  // ---- grade ------------------------------------------------------------------------------
  col *= mix(0.55, 1.0, smoothstep(1.15, 0.3, vgn));
  col = 1.0 - exp(-col * 1.25);
  col = pow(col, vec3(1.0 / 2.2));
  col += (h1(ivec2(frag) + ivec2(int(uFrame) * 7, 11)) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
