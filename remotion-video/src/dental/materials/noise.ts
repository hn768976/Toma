// Small GLSL noise kit shared by the arch shader and the particle effects.
//
// Deliberately hash-based rather than texture-based: every effect in this
// project has to be deterministic across render workers, and a hash gives
// the same value on every machine with nothing to load.

export const GLSL_NOISE = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

// Gradient noise, roughly -1..1.
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dot(hash33(i + vec3(0, 0, 0)), f - vec3(0, 0, 0)),
            dot(hash33(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
        mix(dot(hash33(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)),
            dot(hash33(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
    mix(mix(dot(hash33(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)),
            dot(hash33(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
        mix(dot(hash33(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)),
            dot(hash33(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y),
    u.z) * 1.6;
}

float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += gnoise(p) * amp;
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Cellular / Worley noise. Returns x = nearest distance, y = cell id hash.
// Used for gingival stippling and for the honeycomb-ish protective layer.
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float best = 8.0;
  float id = 0.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash33(i + g) * 0.5 + 0.5;
        float d = length(g + o - f);
        if (d < best) {
          best = d;
          id = dot(i + g, vec3(1.0, 57.0, 113.0));
        }
      }
    }
  }
  return vec2(best, fract(sin(id) * 43758.5453));
}
`;
