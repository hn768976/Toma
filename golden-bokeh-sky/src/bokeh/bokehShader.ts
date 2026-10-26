/**
 * Golden bokeh -> blue sky fragment shader (WebGL2 / GLSL ES 3.00).
 *
 * World space is a tall virtual plate (units: frame heights, y up):
 * a field of defocused warm-light discs (rimmed "onion" bokeh, as from a
 * wide-open lens looking through sunlit foliage) fills the lower part,
 * thinning into pale haze and then an open blue sky with soft diagonal
 * light shafts. The camera samples this plate through `uCam` (offset),
 * `uZoom` and `uRoll`; depth layers get `uParallax` so a translating camera
 * shows parallax, while a pure tilt (parallax 0) moves all layers together.
 */
export const BOKEH_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;        // seconds
uniform vec2 uCam;          // camera offset on the plate (frame heights)
uniform float uZoom;        // >1 = pushed in
uniform float uRoll;        // radians
uniform float uParallax;    // 0 = pure rotation (tilt), 1 = full translation parallax
uniform float uGoldTop;     // plate height where the warm bokeh band ends
uniform float uSkyY0;       // plate height where the tilt comes to rest
// palette
uniform vec3 uSkyLight;
uniform vec3 uSkyMid;
uniform vec3 uSkyDeep;
uniform vec3 uWarmHi;
uniform vec3 uWarmMid;
uniform vec3 uWarmLow;
uniform vec3 uHaze;

out vec4 outColor;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(uint v) { return float(pcg(v)) * (1.0 / 4294967295.0); }
uint cellHash(ivec2 c, uint seed) {
  uvec2 u = uvec2(c + ivec2(4096));
  return pcg(u.x * 1973u ^ pcg(u.y * 9277u ^ seed));
}

float vnoise(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  float a = rnd(cellHash(c, seed));
  float b = rnd(cellHash(c + ivec2(1, 0), seed));
  float d = rnd(cellHash(c + ivec2(0, 1), seed));
  float e = rnd(cellHash(c + ivec2(1, 1), seed));
  return mix(mix(a, b, w.x), mix(d, e, w.x), w.y);
}

float fbm(vec2 p, uint seed) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p, seed + uint(i) * 59u);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}

// As the camera climbs away from the low sun the glare clears: from 19 s to
// 24.5 s the upper fringe of warmth and haze fades out, so the tilt comes to
// rest on clean open sky (as in the reference).
float skyCap(float y) {
  return 1.0 - smoothstep(19.0, 24.5, uTime) * smoothstep(uSkyY0 - 0.62, uSkyY0 - 0.28, y);
}

float warmTop(vec2 w) {
  // Boundary leans: foliage reaches higher on the left of the plate.
  return uGoldTop + 0.15 * (0.9 - w.x) + 0.05 * sin(w.x * 3.1 + 1.0)
    + 0.2 * (vnoise(w * vec2(1.6, 1.1) + vec2(3.0, 0.0), 29u) - 0.5);
}

// Density of the warm bokeh band at plate height y (1 deep inside, 0 in sky).
float warmDensity(vec2 w) {
  return smoothstep(warmTop(w) + 0.3, warmTop(w) - 0.7, w.y) * skyCap(w.y);
}

// Thin bright haze reaching further up into the sky than the warm band.
float hazeField(vec2 w) {
  return smoothstep(warmTop(w) + 0.5, warmTop(w) + 0.05, w.y) * skyCap(w.y);
}

// Open sky: light-to-deep blue gradient with soft diagonal light shafts.
vec3 sky(vec2 w) {
  float aspect = uResolution.x / uResolution.y;
  // Sky shafts are laid out relative to where the tilt comes to rest.
  vec2 s = vec2(w.x / aspect, w.y - uSkyY0);
  // Diagonal shafts leaning top-right -> bottom-left.
  float u = s.x - 0.32 * (s.y - 1.2);
  float drift = 0.02 * sin(uTime * 0.21);
  float shaftA = exp(-pow((u - 0.36 - drift) / 0.17, 2.0));
  float shaftB = exp(-pow((u - 0.98) / 0.09, 2.0)) * 0.25;
  float light = clamp(shaftA + shaftB, 0.0, 1.0);
  float deep = smoothstep(0.42, 1.0, s.x) * (1.0 - 0.6 * shaftB);
  vec3 left = mix(uSkyMid, uSkyLight, 0.35);
  vec3 c = mix(mix(left, uSkyMid, smoothstep(0.0, 0.5, s.x)), uSkyDeep, deep);
  c = mix(c, uSkyLight, light * 0.9);
  // Slight atmospheric streaking.
  c *= 0.97 + 0.05 * fbm(vec2(u * 7.0, s.y * 0.6 + uTime * 0.01), 3u);
  return c;
}

// One layer of defocused light sources on a jittered grid. Each source is
// imaged as the lens aperture: a soft-edged hexagon (blended towards a
// circle) with a faint, partial bright edge. Radii are capped so no shape
// can reach beyond the 3x3 cells searched, which keeps edges seam-free.
// Returns accumulated light in .rgb and coverage in .a.
vec4 bokehLayer(vec2 w, float cell, float radius, uint seed, float t) {
  vec2 g = w / cell;
  ivec2 base = ivec2(floor(g));
  vec3 acc = vec3(0.0);
  float cov = 0.0;
  const float SWAY = 0.06;
  float rMax = cell * (1.0 - SWAY) / 1.04;
  float cap = skyCap(w.y);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    ivec2 c = base + ivec2(i, j);
    uint h = cellHash(c, seed);
    vec2 centre = (vec2(c) + vec2(rnd(h + 2u), rnd(h + 3u))) * cell;
    float wd = warmDensity(centre);
    if (wd < 0.02 || rnd(h + 1u) > 0.35 + 0.65 * wd) continue;
    // Foliage sway: each light source wobbles slowly.
    float ph = rnd(h + 4u) * 6.2831;
    float sp = mix(0.25, 0.7, rnd(h + 5u));
    centre += vec2(sin(t * sp + ph), cos(t * sp * 0.8 + ph * 1.3)) * cell * SWAY;
    float r = min(radius * mix(0.7, 1.3, rnd(h + 6u)), rMax);
    vec2 d = w - centre;
    float dl = length(d);
    if (dl > r * 1.04) continue;
    float th = atan(d.y, d.x);
    // Hexagonal aperture (circumradius r), rounded towards a circle.
    const float SEG = 1.0471976;
    float a6 = mod(th - rnd(h + 7u) * SEG, SEG) - SEG * 0.5;
    float qHex = dl * cos(a6) / (r * 0.8660254);
    float q = mix(qHex, dl / (r * 0.93), 0.5) * (1.0 + 0.025 * sin(3.0 * th + ph));
    float trans = smoothstep(0.02, 0.2, wd) * (1.0 - smoothstep(0.45, 0.8, wd));
    // Haze-zone sources are softer and edgeless; deep ones crisper.
    float body = 1.0 - smoothstep(mix(0.8, 0.35, trans), 1.0, q);
    float rim = exp(-pow((q - 0.96) / 0.03, 2.0)) * smoothstep(-0.5, 0.8, sin(th * 1.0 + ph * 3.0))
      * (1.0 - trans);
    // Twinkle: leaves occlude the source now and then.
    float tw = 0.65 + 0.35 * sin(t * mix(0.4, 1.1, rnd(h + 9u)) + ph * 2.0);
    float k = mix(0.12, 0.34, rnd(h + 10u)) * tw * smoothstep(0.02, 0.3, wd) * (1.0 + 0.8 * trans) * cap;
    float tone = rnd(h + 11u);
    // Bimodal: deep saturated amber sources and bright yellow-cream ones.
    vec3 warm = tone < 0.4 ? mix(uWarmLow * 0.55, uWarmLow, tone / 0.4) : mix(uWarmMid, uWarmHi * 1.05, (tone - 0.4) / 0.6);
    // Thin haze lets the sky through: cool white at the fringe, cream deeper in.
    vec3 haze = mix(mix(uSkyLight, vec3(0.97), 0.4), uHaze, smoothstep(0.08, 0.4, wd));
    vec3 col = mix(haze, warm, smoothstep(0.4, 0.85, wd));
    float a = (body + rim * 0.5) * k;
    acc += col * a;
    cov += a;
  }
  return vec4(acc, cov);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = uResolution.x / uResolution.y;
  vec2 sc = frag / uResolution.y - vec2(aspect * 0.5, 0.5);   // centred screen
  mat2 R = mat2(cos(uRoll), -sin(uRoll), sin(uRoll), cos(uRoll));
  vec2 view = R * sc / uZoom;
  vec2 centre = vec2(aspect * 0.5, 0.5);

  // Plate coordinates per depth: far (sky / haze) and near bokeh layers.
  vec2 wFar = view + centre + uCam;
  float t = uTime;

  vec3 col = sky(wFar);
  float wd = warmDensity(wFar);

  // Warm glow base under the bokeh: large blurred light mass.
  float mass = fbm(wFar * vec2(1.2, 1.6) + vec2(0.0, t * 0.01), 11u);
  float mass2 = vnoise(wFar * vec2(2.3, 2.9) + vec2(t * 0.03, 0.0), 13u);
  float massN = clamp((mass - 0.47) * 4.5 + 0.5, 0.0, 1.0);
  vec3 warmBase = mix(uWarmLow * 0.62, uWarmMid, smoothstep(0.05, 0.5, massN));
  warmBase = mix(warmBase, uWarmHi, smoothstep(0.5, 0.95, massN) * 0.9);
  warmBase *= 0.8 + 0.4 * mass2;
  // Sunlit side: brighter, yellower light on the left, deep burnt amber right.
  float lr = clamp(wFar.x / aspect, 0.0, 1.0);
  warmBase = mix(warmBase, uWarmHi, (1.0 - lr) * (1.0 - lr) * 0.35);
  warmBase *= 1.2 - 0.55 * lr;
  // Broad sunlit glow pools and shadowed gaps in the foliage.
  float env = vnoise(wFar * vec2(0.9, 1.1) + vec2(5.0, 1.0), 17u);
  warmBase *= 0.5 + 1.0 * env;
  // Transitional pale haze between the band and the sky.
  float hazeAmt = max(smoothstep(0.0, 0.22, wd), hazeField(wFar) * 0.5 * smoothstep(0.2, 0.8, massN))
    * (1.0 - smoothstep(0.45, 0.85, wd));
  vec3 hazeCol = mix(mix(col, vec3(0.97), 0.45), uHaze, smoothstep(0.1, 0.45, wd));
  col = mix(col, hazeCol, hazeAmt * (0.55 + 0.35 * mass2));
  // Thin warm light adds to the sky (glows cream, never muddy grey); dense
  // light fully covers it.
  float wa = smoothstep(0.3, 0.9, wd);
  vec3 lit = 1.0 - (1.0 - col) * (1.0 - warmBase * wa);
  col = mix(lit, warmBase, smoothstep(0.55, 0.95, wd));

  // Bokeh layers, far to near, each with its own parallax factor.
  float depths[5] = float[5](0.0, 0.15, 0.35, 0.6, 0.9);
  float radii[5] = float[5](0.17, 0.22, 0.29, 0.38, 0.5);
  for (int L = 0; L < 5; L++) {
    float cell = radii[L] * 1.45;
    vec2 w = view + centre + uCam * (1.0 + uParallax * depths[L]);
    vec4 b = bokehLayer(w, cell, radii[L], 101u + uint(L) * 977u, t);
    // Each disc is light passing through: tint towards its colour, then add glow.
    float a = clamp(b.a, 0.0, 1.0);
    vec3 tint = b.rgb / max(b.a, 1e-4);
    // Over the warm mass a source replaces what is behind it (dark ones
    // deepen the shadows); over sky and haze it only adds light.
    float over = smoothstep(0.35, 0.8, wd);
    col = mix(col, tint, a * 0.75 * over);
    col = 1.0 - (1.0 - col) * (1.0 - clamp(b.rgb * mix(0.6, 0.3, over), 0.0, 1.0));
  }

  // Warm grade: the sunlit band is saturated and contrasty (luminous yellow
  // highlights, deep burnt-amber shadows).
  float gW = smoothstep(0.35, 0.9, wd);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 graded = mix(vec3(lum), col, 0.92);
  graded = (graded - 0.58) * 1.65 + 0.6;
  // Milky veil of scattered light over the band.
  graded = mix(graded, vec3(0.96, 0.9, 0.78), 0.13);
  col = mix(col, clamp(graded, 0.0, 1.0), gW);

  // Overall lens bloom: soft light leak from the warm band.
  col += uWarmHi * 0.05 * smoothstep(0.4, 1.0, wd);
  // Fine grain to avoid banding in the smooth gradients.
  float grain = rnd(uint(frag.x) * 73856093u ^ uint(frag.y) * 19349663u ^ uint(t * 30.0 + 0.5) * 83492791u) - 0.5;
  col += grain * (1.5 / 255.0);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
