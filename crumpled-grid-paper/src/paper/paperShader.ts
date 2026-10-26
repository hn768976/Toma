/**
 * Crumpled graph-paper fragment shader (WebGL2 / GLSL ES 3.00).
 *
 * The sheet is a procedural heightfield: anisotropic low-frequency waves
 * plus a set of random fold creases (sharp crest, smooth falloff) and a
 * fine paper grain. Normals from finite differences are lit by a single
 * key light; a broad exposure gradient mimics the photographed reference.
 * The grid is drawn in paper space and slightly warped by the folds.
 * Each `uState` is a different crumple of the same sheet (stop-motion).
 */
export const PAPER_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uState;        // 0..7 crumple state
uniform float uExposure;     // per-state exposure jitter
uniform vec3 uPaperColor;    // base paper albedo
uniform vec3 uLineColor;     // grid ink colour
uniform vec3 uShadowTint;    // multiplied into shadowed areas
uniform float uGridColumns;  // grid cells across the frame width

out vec4 outColor;

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(uint v) { return float(pcg(v)) * (1.0 / 4294967295.0); }

float lattice(ivec2 c, uint seed) {
  uvec2 u = uvec2(c + ivec2(4096));
  return rnd(u.x * 1973u ^ pcg(u.y * 9277u ^ seed));
}

float vnoise(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 c = ivec2(i);
  float a = lattice(c, seed);
  float b = lattice(c + ivec2(1, 0), seed);
  float d = lattice(c + ivec2(0, 1), seed);
  float e = lattice(c + ivec2(1, 1), seed);
  return mix(mix(a, b, w.x), mix(d, e, w.x), w.y) * 2.0 - 1.0;
}

float fbm(vec2 p, uint seed) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p, seed + uint(i) * 131u);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s;
}

const int CREASES = 30;

// Height of the crumpled sheet at p (units: frame heights).
float height(vec2 p, uint seed) {
  // Folds in the reference run mostly lower-left -> upper-right.
  const float baseAngle = 0.52;
  mat2 rot = mat2(cos(baseAngle), -sin(baseAngle), sin(baseAngle), cos(baseAngle));
  vec2 q = rot * p;
  float h = 0.060 * fbm(vec2(q.x * 1.3, q.y * 2.0) + float(seed % 97u), seed);

  for (int i = 0; i < CREASES; i++) {
    uint k = seed * 7919u + uint(i) * 104729u;
    vec2 c = vec2(rnd(k + 1u) * 2.2 - 0.2, rnd(k + 2u) * 1.4 - 0.2);
    float cross = step(0.62, rnd(k + 3u));
    float ang = baseAngle + (rnd(k + 4u) - 0.5) * 2.0 + cross * (1.45 + (rnd(k + 5u) - 0.5) * 0.6);
    vec2 dir = vec2(cos(ang), sin(ang));
    float len = mix(0.25, 1.3, rnd(k + 6u));
    float w = mix(0.03, 0.2, rnd(k + 7u));
    float amp = mix(0.02, 0.13, rnd(k + 8u) * rnd(k + 10u)) * (rnd(k + 9u) < 0.5 ? -1.0 : 1.0);
    vec2 d = p - c;
    float along = dot(d, dir);
    float perp = dot(d, vec2(-dir.y, dir.x));
    float fade = 1.0 - smoothstep(len * 0.35, len * 0.5, abs(along));
    float r = sqrt(perp * perp + 2e-6) / w;
    float x = max(1.0 - r, 0.0);
    h += amp * w * x * x * fade;
  }
  return h;
}

// Fine fibre grain (kept separate so it shades but does not warp the grid).
float grainHeight(vec2 p, uint seed) {
  return 0.00006 * vnoise(p * 300.0, seed + 17u) + 0.00022 * vnoise(p * 80.0, seed + 23u);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  float H = uResolution.y;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = px / H;
  uint seed = uint(uState) * 1013u + 77u;

  float e = 1.0 / H;
  float h0 = height(p, seed);
  float hx = height(p + vec2(e, 0.0), seed);
  float hy = height(p + vec2(0.0, e), seed);
  vec2 grad = vec2(hx - h0, hy - h0) / e;
  float g0 = grainHeight(p, seed);
  vec2 gGrad = vec2(grainHeight(p + vec2(e, 0.0), seed) - g0, grainHeight(p + vec2(0.0, e), seed) - g0) / e;

  vec3 N = normalize(vec3(-(grad + gGrad), 1.0));
  vec3 L = normalize(vec3(0.55, -0.35, 0.75));
  float shade = dot(N, L) / L.z;
  shade -= 1.0;
  shade = clamp(1.0 + shade * (shade > 0.0 ? 2.1 : 1.3), 0.5, 2.4);

  // Broad exposure fall-off: darker upper-left, brighter lower-right.
  vec2 n = vec2(p.x / aspect, p.y);
  float global = 0.80 + 0.30 * n.x + 0.30 * (1.0 - n.y);
  global *= 1.0 - 0.10 * pow(length(n - vec2(0.55, 0.5)) * 1.2, 2.0);
  global *= uExposure;

  // Paper albedo with subtle mottling.
  float mottle = 1.0 + 0.06 * fbm(p * 9.0, seed + 5u) + 0.03 * vnoise(p * 140.0, seed + 9u);
  vec3 paper = uPaperColor * mottle;
  vec3 lit = paper * shade * global;
  lit *= mix(uShadowTint, vec3(1.0), smoothstep(0.55, 1.05, shade));

  // Grid in (slightly fold-warped) paper space.
  float ang = (rnd(seed + 3u) - 0.5) * 0.002;
  mat2 gr = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  float spacing = uResolution.x / uGridColumns;
  // The sheet is re-photographed in nearly the same place each state.
  vec2 offset = (vec2(0.3, 0.6) + (vec2(rnd(seed + 1u), rnd(seed + 2u)) - 0.5) * 0.14) * spacing;
  vec2 g = (gr * (px - uResolution * 0.5) + offset - grad * H * 0.011) / spacing;
  vec2 dCell = abs(fract(g) - 0.5);
  float dist = (0.5 - max(dCell.x, dCell.y)) * spacing;
  float lineW = H * 0.00105;
  float aa = H * 0.0011;
  float line = 1.0 - smoothstep(lineW - aa, lineW + aa, dist);
  float ink = 0.80 + 0.20 * vnoise(p * 6.0 + 3.0, seed + 41u) + 0.08 * vnoise(p * 90.0, seed + 43u);
  vec3 lineCol = uLineColor * ink * mix(0.55, 1.0, clamp(shade, 0.0, 1.3)) * global;
  vec3 col = mix(lit, max(lit, lineCol), line);

  // Sensor grain (changes with each exposure / state).
  float grain = (rnd(uint(px.x) * 73856093u ^ uint(px.y) * 19349663u ^ seed) - 0.5) * 0.012;
  col += grain;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
