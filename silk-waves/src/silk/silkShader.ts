/**
 * Fragment shader for the "Silk Waves" composition.
 *
 * The image is built procedurally (no textures):
 *  - a soft radial background that is darkest in a tilted, eye-shaped
 *    void in the centre,
 *  - two families of translucent silk strands (an upper "dome" family and a
 *    lower "bowl" family) that sweep from lower-left to upper-right,
 *  - each strand has a sharp sheen edge, a soft trailing veil and fine
 *    hair-like fibres, and a per-strand amount of defocus,
 *  - every motion term is periodic over LOOP_SECONDS, so the clip loops.
 */
export const SILK_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;       // seconds
uniform float u_loop;       // loop length in seconds
uniform vec3 u_bgCenter;    // colour of the central void
uniform vec3 u_bgEdge;      // colour of the outer folds
uniform vec3 u_veil;        // colour of the soft translucent veils
uniform vec3 u_sheen;       // colour of the bright sheen edges
uniform vec3 u_fiber;       // colour of the brightest fibre glints
uniform float u_exposure;   // global intensity multiplier
uniform float u_angle;      // strand direction (radians)
uniform float u_frame;      // frame index, for dithering

out vec4 outColor;

const float TAU = 6.28318530718;
const int STRANDS = 24;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Strand parameters. x: base radius, y: curvature, z: tilt, w: wave amp
vec4 strandShape(int i) {
  float fi = float(i);
  float h1 = hash11(fi * 7.31 + 1.7);
  float h2 = hash11(fi * 3.17 + 9.1);
  float h3 = hash11(fi * 5.93 + 4.4);
  float h4 = hash11(fi * 2.71 + 6.2);
  return vec4(
    0.26 + 0.30 * h1,
    0.22 + 0.30 * h2,
    -0.05 + 0.10 * h3,
    0.022 + 0.045 * h4
  );
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * u_resolution) / u_resolution.y;   // y up, |y|<=0.5

  float ca = cos(u_angle);
  float sa = sin(u_angle);
  // s: along strands, n: across strands
  float s = ca * p.x + sa * p.y;
  float n = -sa * p.x + ca * p.y;

  float ph = TAU * u_time / u_loop;     // loop phase

  // ---------- background --------------------------------------------------
  // Elliptical distance: darkest in the centre, lighter towards the folds.
  vec2 e = vec2(s / 1.1, (n + 0.02 * sin(ph)) / 0.48);
  float r = length(e);
  vec3 col = mix(u_bgCenter, u_bgEdge, smoothstep(0.05, 1.7, r));

  // Very broad, slow fabric folds that give the backdrop some volume.
  float folds = 0.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float c = (fk < 2.0 ? 1.0 : -1.0) * (0.30 + 0.12 * mod(fk, 2.0));
    float yk = c - sign(c) * 0.26 * s * s
      + 0.05 * sin(1.7 * s + fk * 1.9 + ph * (1.0 + mod(fk, 2.0)));
    float dk = (n - yk) / 0.16;
    folds += exp(-dk * dk) * (0.55 + 0.45 * sin(2.0 * s + fk + ph));
  }
  col += u_veil * folds * 0.10;

  // ---------- silk strands ------------------------------------------------
  vec3 light = vec3(0.0);
  for (int i = 0; i < STRANDS; i++) {
    float fi = float(i);
    float side = (i % 2 == 0) ? 1.0 : -1.0;     // upper / lower family
    vec4 sh = strandShape(i);
    float m = 2.0 + mod(fi, 2.0);               // integer loop multiplier
    float phase = hash11(fi * 1.37 + 2.0) * TAU;
    float freq = 1.4 + 1.6 * hash11(fi * 4.1 + 0.3);

    float wave = sh.w * sin(freq * s + phase + m * ph)
               + 0.6 * sh.w * sin(2.3 * freq * s - phase * 1.3 - 2.0 * ph);
    float breathe = 0.04 * sin(ph + phase);
    float centre = side * (sh.x + breathe - sh.y * s * s) + sh.z * s + wave;

    // derivative along s for an approximate perpendicular distance
    float dc = side * (-2.0 * sh.y * s) + sh.z
             + sh.w * freq * cos(freq * s + phase + m * ph)
             + 0.6 * sh.w * 2.3 * freq * cos(2.3 * freq * s - phase * 1.3 - 2.0 * ph);
    float d = (n - centre) / sqrt(1.0 + dc * dc);

    // far away from this strand nothing visible is added (perf early-out)
    if (abs(d) > 0.2) continue;

    // defocus: some strands are soft and wide, others crisp
    float blur = 0.6 + pow(hash11(fi * 9.7 + 3.3), 1.2) * 4.5;
    float w = (0.0025 + 0.003 * hash11(fi * 6.6)) * (1.0 + blur);
    float energy = 1.0 / pow(1.0 + blur, 0.55);

    // Strands fade in and out along their length.
    float s0 = -1.25 + 0.4 * hash11(fi * 8.8 + 1.0);
    float s1 = 0.75 + 0.5 * hash11(fi * 2.2 + 5.0);
    float span = smoothstep(s0, s0 + 0.35, s) * (1.0 - smoothstep(s1 - 0.35, s1, s));
    float shimmer = 0.75 + 0.25 * sin(2.6 * s + phase * 2.0 + ph * m);
    // brighter lobes towards the left/right, dimmer across the centre and
    // for the lower family (the reference reads as a draped sheet)
    float lobe = 0.7 + 0.5 * smoothstep(0.15, 0.7, abs(s));
    float family = side > 0.0 ? 1.0 : 0.75;
    float amount = span * shimmer * energy * lobe * family;
    if (amount < 0.002) continue;

    // Outward side gets the soft veil, inward side the sharp edge.
    float dOut = d * side;
    float edge = exp(-(d * d) / (w * w));
    float veil = dOut > 0.0
      ? exp(-dOut / (w * 9.0 + 0.02)) * 0.35
      : exp(-(dOut * dOut) / (w * w * 2.0)) * 0.35;

    // Fine fibres: high frequency across, low frequency along the strand.
    float fib = vnoise(vec2(s * 5.0 + fi * 13.0, d * 0.3 * u_resolution.y / (1.0 + blur)));
    fib = mix(0.2, 1.15, fib * fib);
    float fibZone = exp(-abs(dOut) / (w * 2.5 + 0.002));

    light += u_veil * veil * amount;
    light += u_sheen * edge * amount * mix(0.6, 1.0, fib);
    light += u_fiber * fibZone * amount * fib * fib * 0.55 / (1.0 + 0.6 * blur);
  }
  col += light * u_exposure;

  // Gentle vignette.
  vec2 q = frag / u_resolution - 0.5;
  col *= 1.0 - 0.35 * dot(q, q);

  // Dither to avoid banding in the dark gradients after H.264 encoding.
  float dither = hash12(frag + fract(u_frame * 0.618) * 113.0) - 0.5;
  col += dither * (2.5 / 255.0);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
