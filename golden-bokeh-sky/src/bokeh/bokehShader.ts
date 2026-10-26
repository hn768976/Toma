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

// Density of the warm bokeh band at plate height y (1 deep inside, 0 in sky).
float warmDensity(vec2 w) {
  // Boundary leans: foliage reaches higher on the left of the plate.
  float top = uGoldTop + 0.3 * (0.9 - w.x) + 0.05 * sin(w.x * 3.1 + 1.0)
    + 0.22 * (vnoise(w * vec2(1.6, 1.1) + vec2(3.0, 0.0), 29u) - 0.5);
  // Nothing warm survives above where the camera comes to rest: open sky.
  return smoothstep(top + 0.3, top - 0.7, w.y) * (1.0 - smoothstep(uSkyY0 - 0.05, uSkyY0 + 0.3, w.y));
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

// One layer of defocused light discs on a jittered grid. Shapes are soft,
// slightly irregular (petal-like) and only faintly rimmed, as in the
// reference. Returns accumulated light in .rgb and coverage in .a.
vec4 bokehLayer(vec2 w, float cell, float radius, uint seed, float t) {
  vec2 g = w / cell;
  ivec2 base = ivec2(floor(g));
  vec3 acc = vec3(0.0);
  float cov = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    ivec2 c = base + ivec2(i, j);
    uint h = cellHash(c, seed);
    vec2 centre = (vec2(c) + vec2(rnd(h + 2u), rnd(h + 3u))) * cell;
    float wd = warmDensity(centre);
    if (wd < 0.02 || rnd(h + 1u) > 0.25 + 0.75 * wd) continue;
    // Foliage sway: each light source wobbles slowly.
    float ph = rnd(h + 4u) * 6.2831;
    float sp = mix(0.25, 0.7, rnd(h + 5u));
    centre += vec2(sin(t * sp + ph), cos(t * sp * 0.8 + ph * 1.3)) * cell * 0.08;
    float r = radius * mix(0.7, 1.3, rnd(h + 6u));
    vec2 d = w - centre;
    float dl = length(d);
    if (dl > r * 1.25) continue;
    float th = atan(d.y, d.x);
    float wob = 1.0 + 0.07 * sin(3.0 * th + ph + t * 0.3) + 0.04 * sin(5.0 * th + ph * 2.0);
    float q = dl / (r * wob);
    float body = 1.0 - smoothstep(0.62, 1.0, q);
    float rim = exp(-pow((q - 0.94) / 0.05, 2.0)) * smoothstep(-0.3, 0.9, sin(th + ph * 3.0));
    // Twinkle: leaves occlude the source now and then.
    float tw = 0.65 + 0.35 * sin(t * mix(0.4, 1.1, rnd(h + 9u)) + ph * 2.0);
    float trans = smoothstep(0.02, 0.2, wd) * (1.0 - smoothstep(0.45, 0.8, wd));
    float k = mix(0.10, 0.30, rnd(h + 10u)) * tw * smoothstep(0.02, 0.3, wd) * (1.0 + 1.2 * trans);
    float tone = rnd(h + 11u);
    vec3 warm = tone < 0.5 ? mix(uWarmLow, uWarmMid, tone * 2.0) : mix(uWarmMid, uWarmHi, tone * 2.0 - 1.0);
    vec3 col = mix(uHaze, warm, smoothstep(0.4, 0.85, wd));
    float a = (body + rim * 0.45) * k;
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
  float massN = clamp((mass - 0.47) * 3.2 + 0.5, 0.0, 1.0);
  vec3 warmBase = mix(uWarmLow * 0.85, uWarmMid, smoothstep(0.1, 0.55, massN));
  warmBase = mix(warmBase, uWarmHi, smoothstep(0.55, 0.95, massN) * 0.85);
  warmBase *= 0.86 + 0.28 * mass2;
  // Sunlit side: brighter, yellower light on the left, deeper amber right.
  float lr = clamp(wFar.x / aspect, 0.0, 1.0);
  warmBase = mix(warmBase, uWarmHi, (1.0 - lr) * 0.22);
  warmBase *= 1.04 - 0.14 * lr;
  // Transitional pale haze between the band and the sky.
  float hazeAmt = smoothstep(0.0, 0.22, wd) * (1.0 - smoothstep(0.45, 0.85, wd));
  col = mix(col, uHaze, hazeAmt * smoothstep(0.15, 0.75, massN) * 0.8);
  col = mix(col, warmBase, smoothstep(0.42, 0.9, wd));

  // Bokeh layers, far to near, each with its own parallax factor.
  float depths[4] = float[4](0.0, 0.25, 0.55, 0.9);
  float cells[4] = float[4](0.17, 0.24, 0.33, 0.46);
  float radii[4] = float[4](0.15, 0.21, 0.29, 0.40);
  for (int L = 0; L < 4; L++) {
    vec2 w = view + centre + uCam * (1.0 + uParallax * depths[L]);
    vec4 b = bokehLayer(w, cells[L], radii[L], 101u + uint(L) * 977u, t);
    // Each disc is light passing through: tint towards its colour, then add glow.
    float a = clamp(b.a, 0.0, 1.0);
    vec3 tint = b.rgb / max(b.a, 1e-4);
    col = mix(col, tint, a * 0.6);
    col = 1.0 - (1.0 - col) * (1.0 - clamp(b.rgb * 0.35, 0.0, 1.0));
  }

  // Overall lens bloom: soft light leak from the warm band.
  col += uWarmHi * 0.05 * smoothstep(0.4, 1.0, wd);
  // Fine grain to avoid banding in the smooth gradients.
  float grain = rnd(uint(frag.x) * 73856093u ^ uint(frag.y) * 19349663u ^ uint(t * 30.0 + 0.5) * 83492791u) - 0.5;
  col += grain * (1.5 / 255.0);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
