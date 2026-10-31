/**
 * Procedural pool-water caustics (WebGL 2 / GLSL ES 3.00).
 *
 * Layers:
 *  1. A slow, two-stage domain warp ("liquid smear") of the sample position.
 *  2. Animated Voronoi cells: dark cell interiors read as the deep blue
 *     blotches seen through the water; their borders become the bright
 *     caustic network.
 *  3. A finer, faster Voronoi layer that adds thin bright filaments.
 *  4. Low-frequency fbm brightness drift + fine streak noise.
 * The resulting lightness L (0..1) is mapped through a 5-stop colour ramp
 * supplied by the composition (uC0..uC4), which is how Version 2 swaps
 * palette without touching the motion.
 */
export const causticFrag = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
uniform float uGrain;

out vec4 outColor;

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Gradient noise, range roughly [-0.7, 0.7].
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 ga = hash22(i + vec2(0.0, 0.0)) * 2.0 - 1.0;
  vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float va = dot(ga, f - vec2(0.0, 0.0));
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = ROT * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

// Animated Voronoi: returns (F1, F2) distances.
vec2 voronoi(vec2 x, float t) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash22(n + g);
      vec2 o = 0.5 + 0.42 * sin(t * (0.6 + 0.5 * h.yx) + 6.2831 * h);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return sqrt(vec2(f1, f2));
}

vec3 ramp(float l) {
  l = clamp(l, 0.0, 1.0) * 4.0;
  if (l < 1.0) return mix(uC0, uC1, l);
  if (l < 2.0) return mix(uC1, uC2, l - 1.0);
  if (l < 3.0) return mix(uC2, uC3, l - 2.0);
  return mix(uC3, uC4, l - 3.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Height-normalised coordinates, y up, origin at frame centre.
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;
  float t = uTime;

  // Gentle current: the whole pattern slides slowly to the upper-left.
  vec2 p = uv * 2.6 + vec2(0.02, -0.014) * t;

  // Stage 1 warp: big liquid undulation.
  vec2 w1 = vec2(
    fbm(p * 0.5 + 0.55 * vec2(cos(0.9 * t), sin(0.7 * t))),
    fbm(p * 0.5 + vec2(5.2, 1.3) + 0.55 * vec2(sin(0.8 * t), cos(0.6 * t)))
  );
  vec2 q = p + 1.05 * w1;

  // Stage 2 warp: smaller, faster ripples that smear the cell borders.
  vec2 w2 = vec2(
    fbm(q * 1.6 + vec2(1.7, 9.2) + 0.5 * vec2(cos(3.1 * t), sin(2.6 * t))),
    fbm(q * 1.6 + vec2(8.3, 2.8) + 0.5 * vec2(sin(2.9 * t), cos(3.4 * t)))
  );
  vec2 r = q + 0.40 * w2;

  // Main cells: rounded dark blotches + soft bright borders.
  vec2 v = voronoi(r, t * 1.7);
  float edge = v.y - v.x;
  float blob = 1.0 - smoothstep(0.15, 0.75, v.x);
  float interior = blob * smoothstep(0.02, 0.2, edge);
  float border = exp(-edge * 6.0);

  // Fine filaments.
  vec2 v2 = voronoi(r * 2.2 + vec2(4.0, 1.0) + 0.3 * w2, t * 3.2);
  float e2 = v2.y - v2.x;
  float fil = exp(-e2 * 10.0);

  // Depth / darkness modulation so not every cell is equally dark.
  float deep = 0.35 + 0.65 * smoothstep(-0.3, 0.3, fbm(q * 0.6 + 3.0));

  float L = 0.535;
  L -= 0.40 * interior * deep;
  L += 0.12 * border;
  L += 0.06 * fil * (0.5 + 0.5 * smoothstep(-0.2, 0.3, fbm(r * 1.3 + 7.0)));
  // Large-scale drifting brightness + slight top-of-frame glow.
  L += 0.08 * fbm(uv * 1.1 + 0.25 * vec2(cos(0.3 * t), sin(0.25 * t)) + 11.0);
  // Persistent sun-light falloff: glow at top-centre, brighter right side,
  // deeper water toward the lower-left (measured from the reference).
  vec2 g = uv - vec2(0.08, 0.55);
  L += 0.30 * exp(-dot(g, g) * 5.0);
  L += 0.13 * uv.x + 0.10 * uv.y;
  L += 0.22 * fbm(uv * 1.25 + vec2(31.0, 7.0));
  // Fine streaky detail that rides on the warp.
  L += 0.05 * fbm(r * 5.0 + 0.6 * vec2(cos(3.9 * t), sin(3.3 * t)));

  vec3 col = ramp(L);

  // Tiny static-free dither to avoid banding in the 8-bit encode.
  col += (hash12(frag + fract(t) * 91.7) - 0.5) * uGrain;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
