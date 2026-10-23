// Full-screen fragment shader for the "Moonlit Sea" composition.
// Coordinates are normalised by frame height, so the shot frames identically
// at 4K, 1080p or any other 16:9 size.

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;

// Palette (linear 0..1 sRGB values)
uniform vec3 uPink;      // warm upper-sky cloud colour
uniform vec3 uSalmon;    // dense warm cloud colour
uniform vec3 uBlue;      // cool cloud bands
uniform vec3 uLavender;  // base sky colour
uniform vec3 uHorizon;   // haze at the horizon line
uniform vec3 uWaterTop;  // water colour right below the horizon
uniform vec3 uWaterLow;  // water colour at the bottom of frame
uniform vec3 uMoon;      // moon surface tint
uniform vec3 uGlow;      // moon halo tint

out vec4 outColor;

const float HORIZON = -0.1667;           // 288 / 432 from the top in the reference
const vec2 MOON_C = vec2(0.0, 0.0833);   // 180 / 432 from the top
const float MOON_R = 0.106;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
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

float fbm(vec2 p, int oct) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    v += a * vnoise(p);
    p = rot * p * 2.03 + vec2(11.7, 3.1);
    a *= 0.5;
  }
  return v;
}

// Painterly, horizontally-stretched cloud bands drifting right-to-left.
vec3 sky(vec2 p, float t, int oct) {
  vec2 q = vec2(p.x * 0.7 + t * 0.15, p.y * 3.6);
  float w = fbm(q * 0.9 + vec2(t * 0.06, t * 0.19), oct);
  float n1 = fbm(q + 1.8 * vec2(w, w * 0.4) + vec2(t * 0.065, 1.3 - t * 0.05), oct);
  float n2 = fbm(q * 1.25 + vec2(-t * 0.08, 5.2 + t * 0.05) + 1.2 * w, oct);

  float h = smoothstep(-0.18, 0.5, p.y);
  vec3 col = mix(uLavender, uPink, clamp(h * 0.62 + (n2 - 0.5) * 0.9, 0.0, 1.0));
  col = mix(col, uSalmon, smoothstep(0.48, 0.70, n2) * (0.85 - 0.3 * h));
  col = mix(col, uPink, smoothstep(0.55, 0.75, n2 + 0.15 * h) * h * 0.8);
  col = mix(col, uBlue, smoothstep(0.48, 0.68, n1) * 0.82);
  // Haze towards the horizon line.
  col = mix(col, uHorizon, smoothstep(0.16, 0.0, p.y - HORIZON) * 0.65);
  return col;
}

// Returns (coverage, shade) for the moon disc at point p.
vec2 moonDisc(vec2 p) {
  vec2 d = (p - MOON_C) / MOON_R;
  float r = length(d);
  float cover = 1.0 - smoothstep(0.985, 1.0, r);
  if (cover <= 0.0) return vec2(0.0);
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec2 uv = d / (0.6 + 0.4 * z); // gentle spherical wrap
  float maria = smoothstep(0.48, 0.7, fbm(uv * 1.6 + vec2(4.0, 1.0), 5));
  float mottling = fbm(uv * 6.0 + 9.0, 4);
  // Scatter of small craters.
  float craters = 0.0;
  vec2 g = uv * 5.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = floor(g) + vec2(float(i), float(j));
      vec2 o = hash22(cell);
      float rad = 0.12 + 0.22 * hash12(cell + 7.0);
      float dist = length(g - cell - o);
      float rim = smoothstep(rad, rad * 0.75, dist) - smoothstep(rad * 0.7, rad * 0.3, dist) * 0.6;
      craters += rim * step(0.45, hash12(cell + 3.0));
    }
  }
  float shade = 1.0 - 0.24 * maria - 0.14 * (mottling - 0.5) - 0.09 * craters;
  shade *= mix(0.9, 1.0, z); // limb darkening
  return vec2(cover, shade);
}

vec3 stars(vec2 p, float t) {
  vec3 acc = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 38.0 : 61.0;
    vec2 g = p * scale;
    vec2 cell = floor(g);
    float h = hash12(cell + float(layer) * 17.0);
    float density = layer == 0 ? 0.045 : 0.018;
    if (h < density) {
      vec2 o = hash22(cell + 3.7) * 0.4 + 0.3;
      float d = length(g - cell - o) / scale;
      float size = (layer == 0 ? 0.0024 : 0.0017) * (0.6 + 0.6 * hash12(cell + 9.1));
      float tw = 0.65 + 0.35 * sin(t * (1.5 + 3.0 * hash12(cell + 1.3)) + h * 40.0);
      float core = smoothstep(size, size * 0.25, d);
      // Halo is clipped well inside the cell so no square edges show.
      float halo = exp(-d / (size * 1.6)) * 0.25 * smoothstep(size * 2.2, size, d);
      acc += vec3(1.0, 0.97, 1.0) * (core + halo) * tw;
    }
  }
  return acc;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  vec3 col;

  if (p.y >= HORIZON) {
    col = sky(p, t, 5);

    float dm = length(p - MOON_C) / MOON_R;
    // Halo
    col += uGlow * (0.05 * exp(-(dm - 1.0) * 4.0) + 0.015 * exp(-(dm - 1.0) * 0.8)) * step(1.0, dm);
    col += stars(p, t) * smoothstep(1.2, 2.4, dm);

    vec2 m = moonDisc(p);
    col = mix(col, uMoon * m.y + uGlow * 0.06, m.x);
  } else {
    float depth = HORIZON - p.y;                 // 0 at horizon, ~0.33 at bottom
    float z = 1.0 / max(depth, 0.004);           // perspective distance proxy
    vec2 wp = vec2(p.x * z, z);                   // position on the water plane

    // Animated wave normal (sum of directional sines + noise)
    float wt = t * 1.7;
    vec2 nrm = vec2(0.0);
    nrm.x += 0.55 * sin(wp.x * 2.3 + wp.y * 0.7 + wt * 1.3);
    nrm.x += 0.35 * sin(wp.x * 4.1 - wp.y * 1.3 - wt * 1.7);
    nrm.y += 0.60 * sin(wp.y * 1.9 + wt * 1.2 + 0.4 * sin(wp.x * 1.3));
    nrm.y += 0.30 * sin(wp.y * 3.7 - wp.x * 0.8 - wt * 2.1);
    nrm += (vec2(vnoise(wp * 1.7 + wt * 0.4), vnoise(wp * 1.7 - wt * 0.4 + 5.0)) - 0.5) * 0.9;

    float amp = 0.09 * depth + 0.003;
    vec2 swirl = vec2(fbm(wp * vec2(0.35, 0.6) + vec2(t * 0.15, 0.0), 3), fbm(wp * vec2(0.35, 0.6) + vec2(4.0, -t * 0.1), 3)) - 0.5;
    vec2 refl = vec2(p.x + nrm.x * amp * 1.4 + swirl.x * 0.12 * depth, HORIZON + depth * 0.75 + nrm.y * amp * 0.5 + swirl.y * 0.05);
    vec3 skyR = sky(refl, t, 3);

    float k = smoothstep(0.0, 0.33, depth);
    vec3 base = mix(uWaterTop, uWaterLow, k);
    // Horizontal streaks keep the reflected bands from looking glassy.
    float streak = fbm(vec2(p.x * 1.2 + t * 0.03, z * 0.9), 3);
    col = mix(base, skyR, 0.7 + 0.1 * k);
    col = mix(col, uBlue, smoothstep(0.55, 0.75, streak) * 0.35 * k);

    // Broken moon path: mirrored disc torn into zig-zagging ripple bands.
    float wob = sin(z * 6.5 + wt * 1.1) * 0.7 + sin(z * 11.0 - wt * 1.4) * 0.3;
    float zig = wob * 0.032 * smoothstep(0.02, 0.25, depth);
    vec2 mp = vec2(p.x + zig + nrm.x * amp * 1.2, HORIZON + depth * 0.95 + nrm.y * amp * 1.6);
    vec2 mr = moonDisc(mp);
    float rag = vnoise(vec2(p.x * 28.0, z * 3.0 - wt * 0.5)) - 0.5;
    float strips = smoothstep(0.12, 0.55, sin(z * 4.2 + nrm.y * 1.8 - wt * 1.6) * 0.5 + 0.5 + 0.2 * nrm.x + 0.45 * rag);
    float path = mr.x * strips;
    float feather = smoothstep(0.0, 0.35, mr.x * (1.0 - smoothstep(0.75, 1.0, length((mp - MOON_C) / MOON_R))));
    // Translucent and sky-tinted, keeping the moon's surface detail visible.
    vec3 moonRefl = mix(uMoon, uGlow, 0.3) * (0.62 + 0.38 * mr.y);
    col = mix(col, moonRefl, path * feather * 0.66);
    // Soft glow column under the moon.
    float colGlow = exp(-pow(p.x / (MOON_R * 1.3), 2.0)) * smoothstep(0.03, 0.12, depth);
    col += uGlow * colGlow * 0.06;

    // Sparse glints
    vec2 gp = wp * vec2(9.0, 2.2);
    vec2 gc = floor(gp + vec2(t * 0.6, 0.0));
    float gh = hash12(gc);
    vec2 gf = (fract(gp + vec2(t * 0.6, 0.0)) - 0.5) * vec2(0.7, 2.2);
    float glint = step(0.993, gh) * smoothstep(0.2, 0.0, length(gf))
                * (0.5 + 0.5 * sin(t * 6.0 + gh * 50.0));
    col += vec3(1.0) * glint * 0.4 * smoothstep(0.08, 0.2, depth);

    // Slightly darker band right at the horizon.
    col = mix(col, uWaterTop, smoothstep(0.06, 0.0, depth) * 0.6);
  }

  // Soft fine grain to avoid gradient banding in the 8-bit encode.
  col += (hash12(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) / 255.0;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
