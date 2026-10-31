/**
 * LED light-wall fragment shader (WebGL 2 / GLSL ES 3.00).
 *
 * Layout is authored in a 768x432 "reference space" (the reference clip's
 * native size) and scaled to whatever the canvas resolution is, so the
 * 3840x2160 composition renders at 5 output pixels per reference pixel.
 *
 * Grid (measured from the reference):
 *   19 columns: x = 14, 41 + 42.625*i (i = 0..16), 749
 *   10 rows:    y = 26.5 + 42.3*j      (j = 0..9)
 *
 * Each light flickers on a ~5-frame correlation time (matches the
 * reference's temporal autocorrelation), with a weaker horizontally
 * correlated "chase" term and a global flicker term.
 */
export const LED_WALL_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFrame;
uniform float uTime;

uniform vec3 uBgLeft;
uniform vec3 uBgMid;
uniform vec3 uBgRight;
uniform vec3 uBgDeep;
uniform vec3 uLightLeft;
uniform vec3 uLightRight;
uniform vec3 uLightAccent;
uniform vec3 uHaze;
uniform vec3 uRay;
uniform float uExposure;

out vec4 outColor;

const vec2 REF = vec2(768.0, 432.0);

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
  for (int i = 0; i < 4; i++) {
    s += a * noise2(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

float colX(int i) {
  if (i <= -1) return 14.0;
  if (i >= 17) return 749.0;
  return 41.0 + 42.625 * float(i);
}
float rowY(int j) { return 26.5 + 42.3 * float(j); }

// Per-lamp state for this frame, precomputed on the CPU (see lampState.ts):
// uLamp[(i + 1) * 10 + j] = vec4(level, r, g, b).
uniform vec4 uLamp[190];

vec3 lightContrib(vec2 q, vec2 c, vec2 id, float L, vec3 col) {
  vec2 d = q - c;
  float r = length(d);
  if (r > 64.0) return vec3(0.0);
  float glow = exp(-r / (2.4 + 4.6 * L));
  // Window to zero by 1.5 grid spacings so the 3x3 neighbourhood is seamless.
  float wide = exp(-r / (12.0 + 10.0 * L)) * smoothstep(64.0, 38.0, r);
  // Far field: only the soft glows matter (core/spikes/halo are < 1/255 here).
  if (r > 30.0) {
    return col * (glow * 0.8 * (0.3 + 0.9 * L) + wide * 0.14 * (0.2 + L));
  }
  float h = hash21(id + 7.3);
  float a = atan(d.y, d.x);

  float coreW = 0.8 + 1.0 * L;
  float core = exp(-r * r / (2.0 * coreW * coreW));

  float rot = h * 6.2831 + uFrame * 0.006 * (h - 0.5);
  float s1 = pow(abs(cos(a * 4.0 + rot)), 30.0);
  float s2 = pow(abs(cos(a * 7.0 + rot * 1.7 + 1.0)), 60.0);
  float spikeLen = 2.0 + 5.0 * L;
  float spikes = (s1 * 0.8 + s2 * 0.6) * exp(-r / spikeLen) * smoothstep(0.4, 2.0, r);

  // Fuzzy, irregular-edged halo "ball" (the dominant look of a lit lamp).
  float R = (4.0 + 10.5 * L) * (0.8 + 0.38 * noise2(vec2(a * 1.6 + h * 13.0, uFrame * 0.12 + h * 7.0)));
  float tex = noise2(vec2(a * 3.0 + h * 30.0, r * 0.4 - uFrame * 0.05));
  float disc = smoothstep(R, R * 0.3, r) * (0.32 + 0.3 * tex) * pow(L, 1.4);

  vec3 white = vec3(1.0);
  vec3 sat = col * col;
  vec3 lit = col * (glow * 0.8 * (0.3 + 0.9 * L)
                  + wide * 0.14 * (0.2 + L)
                  + spikes * 0.0);
  lit += mix(sat, vec3(0.8, 1.0, 1.0) * col, 0.5) * disc * 2.0;
  lit += col * spikes * (0.25 + 0.5 * L);
  lit += mix(col, white, 0.6) * core * (0.4 + 0.9 * L);
  return lit;
}

vec3 background(vec2 q) {
  vec2 uv = q / REF;
  vec3 bg = mix(uBgLeft, uBgMid, smoothstep(0.0, 0.35, uv.x));
  bg = mix(bg, uBgRight, smoothstep(0.4, 1.0, uv.x));
  float deep = smoothstep(0.55, 1.15, uv.y) * 0.5
             + smoothstep(0.45, 0.0, uv.x) * smoothstep(0.55, 1.0, uv.y) * 0.5
             + smoothstep(0.2, 0.0, uv.x) * 0.25;
  bg = mix(bg, uBgDeep, clamp(deep, 0.0, 1.0));

  // Slowly drifting volumetric haze.
  float hz = fbm(uv * vec2(3.2, 2.4) + vec2(uTime * 0.055, -uTime * 0.028));
  float hz2 = fbm(uv * vec2(1.5, 1.2) - vec2(uTime * 0.035, uTime * 0.01) + 5.0);
  bg *= 0.42 + 0.7 * hz + 0.3 * hz2;
  bg += uHaze * pow(hz2, 2.0) * 0.18;

  // Light rays fanning in from the top-right corner.
  vec2 src = vec2(800.0, -36.0);
  vec2 d = q - src;
  float ang = atan(d.y, -d.x);
  float dist = length(d);
  float rays = pow(noise1(ang * 26.0 + uTime * 0.55), 3.0) * 0.85
             + pow(noise1(ang * 63.0 - uTime * 0.85 + 4.0), 4.0) * 0.6;
  bg += uRay * rays * exp(-dist / 95.0) * 0.45;
  bg += uRay * exp(-dist / 55.0) * 0.35;
  return bg;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 q = frag / uResolution * REF;

  // Constant term compensating for the windowed far-field lamp glow.
  vec3 col = background(q) + mix(uLightLeft, uLightRight, q.x / REF.x) * 0.035;

  int ci = int(floor((q.x - 41.0) / 42.625 + 0.5));
  int rj = int(floor((q.y - 26.5) / 42.3 + 0.5));
  for (int i = ci - 1; i <= ci + 1; i++) {
    if (i < -1 || i > 17) continue;
    for (int j = rj - 1; j <= rj + 1; j++) {
      if (j < 0 || j > 9) continue;
      vec2 id = vec2(float(i), float(j));
      vec2 c = vec2(colX(i), rowY(j));
      vec4 lamp = uLamp[(i + 1) * 10 + j];
      col += lightContrib(q, c, id, lamp.x, lamp.yzw);
    }
  }

  // Soft-shoulder tone map (keeps saturated mids, rolls highlights to white).
  col *= uExposure;
  vec3 shoulder = 0.78 + 0.22 * (1.0 - exp(-(col - 0.78) / 0.22));
  vec3 mapped = mix(col, shoulder, step(0.78, col));
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  mapped = mix(mapped, vec3(1.0), smoothstep(1.6, 4.5, lum) * 0.6);

  // Fine film grain (deterministic) to avoid banding in the 8-bit output.
  float grain = hash21(frag + fract(uFrame * 0.618) * 1000.0) - 0.5;
  mapped += grain * (1.5 / 255.0);
  outColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
}
`;
