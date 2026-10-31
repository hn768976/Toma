/**
 * LED light-wall fragment shader (WebGL 2 / GLSL ES 3.00).
 *
 * Layout is authored in a 768x432 "reference space" (the reference clip's
 * native size) and scaled to whatever the canvas resolution is, so the
 * 3840x2160 composition renders at 5 output pixels per reference pixel.
 *
 * Grid (measured from the reference):
 *   19 columns: x = 14, 41 + 42.625*i (i = 0..16), 749
 *   10 rows:    y = 26 + 42.75*j       (j = 0..9)
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
float rowY(int j) { return 26.0 + 42.75 * float(j); }

// Per-lamp state for this frame, precomputed on the CPU (see lampState.ts):
// uLamp[(i + 1) * 10 + j] = vec4(level, r, g, b).
uniform vec4 uLamp[190];

vec3 lightContrib(vec2 q, vec2 c, vec2 id, float L, vec3 col) {
  vec2 d = q - c;
  float r = length(d);
  if (r > 64.0) return vec3(0.0);
  // Window to zero by 1.5 grid spacings so the 3x3 neighbourhood is seamless.
  float win = smoothstep(64.0, 36.0, r);
  float glow = exp(-r / (3.6 + 4.2 * L));
  // Broad bloom (sigma ~18 ref px = ~45 px @1080p): merges lit neighbours
  // into horizontal bands of light, as in the reference.
  float bloom = exp(-r * r / (2.0 * 18.0 * 18.0)) * win;
  float wide = exp(-r / (12.0 + 10.0 * L)) * win;
  vec3 far = col * (glow * 0.7 * (0.25 + 0.9 * L)
                  + wide * 0.10 * (0.15 + L)
                  + bloom * 0.37 * L * L);
  if (r > 30.0) return far;

  float h = hash21(id + 7.3);
  float a = atan(d.y, d.x);

  // Soft core: unlit lamps stay a dim soft blob rather than a pin-point.
  float coreW = 1.3 + 0.7 * L;
  float core = exp(-r * r / (2.0 * coreW * coreW));

  // 6-8 soft spikes.
  float rot = h * 6.2831 + uFrame * 0.004 * (h - 0.5);
  float nSp = (h > 0.5) ? 4.0 : 3.0;
  float s1 = pow(abs(cos(a * nSp + rot)), 7.0);
  float spikeLen = 2.5 + 6.0 * L;
  float spikes = s1 * exp(-r / spikeLen) * smoothstep(0.5, 3.0, r);

  // Lumpy halo with a petal / iris ring texture.
  float wob = noise2(vec2(a * 1.6 + h * 13.0, uFrame * 0.08 + h * 7.0));
  float R = (3.5 + 7.0 * L) * (0.82 + 0.34 * wob);
  float petals = 0.55 + 0.45 * pow(abs(cos(a * (3.0 + floor(h * 3.0)) + rot * 0.7)), 2.0);
  float tex = noise2(vec2(a * 3.0 + h * 30.0, r * 0.35 - uFrame * 0.04));
  float body = smoothstep(R, 0.0, r) * (0.3 + 0.2 * tex);
  float ring = exp(-pow((r - R * 0.55) / (R * 0.2), 2.0)) * petals * (0.05 + 0.08 * tex);
  float disc = (body + ring) * pow(L, 1.3);

  vec3 white = vec3(1.0);
  vec3 sat = col * col;
  vec3 lit = far;
  lit += mix(sat, vec3(0.8, 1.0, 1.0) * col, 0.5) * disc * 2.3;
  lit += mix(col, vec3(1.0), 0.2) * spikes * (0.15 + 0.45 * L);
  lit += mix(col, white, 0.55) * core * (0.18 + 1.25 * L);
  return lit;
}

vec3 background(vec2 q) {
  vec2 uv = q / REF;
  vec3 bg = mix(uBgLeft, uBgMid, smoothstep(0.0, 0.35, uv.x));
  bg = mix(bg, uBgRight, smoothstep(0.4, 1.0, uv.x));
  // Navy vignette: bottom, left and bottom-right corners.
  float deep = smoothstep(0.5, 1.05, uv.y) * 0.28
             + smoothstep(0.45, 0.0, uv.x) * smoothstep(0.45, 1.0, uv.y) * 0.32
             + smoothstep(0.65, 1.0, uv.x) * smoothstep(0.6, 1.0, uv.y) * 0.25
             + smoothstep(0.18, 0.0, uv.x) * 0.18;
  bg = mix(bg, uBgDeep, clamp(deep, 0.0, 1.0));
  // Top-right corner leans toward the ray colour (cyan in V1).
  float tr = smoothstep(0.6, 1.0, uv.x) * smoothstep(0.55, 0.0, uv.y);
  bg = mix(bg, uRay * 0.85, tr * 0.4);
  // Central hotspot.
  float hot = exp(-dot((uv - vec2(0.5, 0.45)) * vec2(1.6, 2.2), (uv - vec2(0.5, 0.45)) * vec2(1.6, 2.2)));
  bg *= 0.6 + 0.48 * hot;

  // Moving smoky haze.
  float hz = fbm(uv * vec2(3.2, 2.4) + vec2(uTime * 0.07, -uTime * 0.035));
  float hz2 = fbm(uv * vec2(1.5, 1.2) - vec2(uTime * 0.045, uTime * 0.012) + 5.0);
  bg *= 0.72 + 0.32 * hz + 0.12 * hz2;
  bg += uHaze * pow(hz2, 2.0) * 0.16 * (0.4 + hot);

  // 4-6 broad, soft beams fanning in from the top-right corner.
  vec2 src = vec2(800.0, -36.0);
  vec2 d = q - src;
  float ang = atan(d.y, -d.x);
  float dist = length(d);
  float beams = pow(noise1(ang * 7.5 + uTime * 0.35), 2.2) * 0.8
              + pow(noise1(ang * 13.0 - uTime * 0.5 + 4.0), 3.0) * 0.45;
  float flick = 0.7 + 0.3 * noise1(uTime * 6.0 + 20.0) + 0.15 * noise1(uTime * 13.0 + 3.0);
  float topHalf = smoothstep(0.9, 0.2, uv.y);
  bg += uRay * beams * flick * exp(-dist / 330.0) * 0.32 * topHalf;
  bg += uRay * exp(-dist / 70.0) * 0.38 * flick;
  return bg;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 q = frag / uResolution * REF;

  // Constant term compensating for the windowed far-field lamp glow.
  vec3 col = background(q) + mix(uLightLeft, uLightRight, q.x / REF.x) * 0.03;

  int ci = int(floor((q.x - 41.0) / 42.625 + 0.5));
  int rj = int(floor((q.y - 26.0) / 42.75 + 0.5));
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
