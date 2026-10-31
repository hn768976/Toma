/**
 * Flowing satin / silk cloth — WebGL 2 fragment shader.
 *
 * The cloth is a procedural height field made of several diagonal folds
 * (running from upper-left to lower-right, like the reference) whose
 * positions, widths and curvature evolve smoothly over time. Normals are
 * taken from the height-field gradient and shaded with a soft diffuse
 * term plus an anisotropic, satin-style sheen. A faint brushed-fibre
 * texture runs along the folds, and a low-frequency vignette keeps the
 * corners dark.
 *
 * Colour is applied at the very end through a three-stop tint ramp
 * (shadow / mid / highlight) so alternate palettes are just uniforms.
 */
export const SILK_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uGain;        // global exposure envelope (animated in JS)
uniform float uExposure;    // per-version exposure multiplier
uniform vec3  uShadowTint;
uniform vec3  uMidTint;
uniform vec3  uHighTint;
uniform float uSheen;       // strength of the specular sheen
uniform float uContrast;

out vec4 outColor;

// ---------------------------------------------------------------- noise ---
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
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

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

// Fold orientation (y-up space): folds run down and to the right at
// roughly 36 degrees, slowly swaying a few degrees over time.
vec2 foldDir(float t) {
  float a = radians(-39.0 + 4.0 * sin(0.21 * t + 0.4));
  return vec2(cos(a), sin(a));
}

// A single satin fold profile: broad rounded crest, tighter trough.
float foldProfile(float x) {
  float s = sin(x);
  return s - 0.25 * s * s;
}

// Cloth height field.
float height(vec2 p, float t) {
  vec2 d = foldDir(t);
  vec2 n = vec2(-d.y, d.x);
  float u = dot(p, n);   // across the folds
  float v = dot(p, d);   // along the folds

  // Gentle bending of the folds along their length.
  float bend = 0.045 * sin(1.15 * v + 0.30 * t + 0.6)
             + 0.020 * sin(2.40 * v - 0.42 * t + 2.1)
             + 0.050 * (fbm(vec2(v * 0.8 + 0.04 * t, 0.12 * t)) - 0.5);
  float uu = u + bend;

  float h = 0.0;
  // Primary wide folds drifting slowly across the frame.
  h += 0.60 * foldProfile(3.9 * uu + 0.42 * t + 0.4);
  // Secondary folds travelling the other way -> folds merge and split.
  h += 0.34 * foldProfile(6.8 * uu - 0.33 * t + 1.9 + 0.45 * sin(0.7 * v + 0.18 * t));
  // Narrower creases.
  h += 0.16 * foldProfile(12.0 * uu + 0.66 * t + 4.0 + 0.8 * sin(1.3 * v - 0.25 * t));
  h += 0.06 * foldProfile(21.0 * uu - 0.52 * t + 0.7 + 0.8 * sin(2.1 * v + 0.35 * t));
  return h * 0.30;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uResolution) / uResolution.y;
  // Motion speed calibrated against the reference (mean frame-to-frame
  // difference).
  float t = uTime * 1.1;

  // Gradient by central differences (resolution-independent epsilon).
  float e = 0.0015;
  float hx = height(p + vec2(e, 0.0), t) - height(p - vec2(e, 0.0), t);
  float hy = height(p + vec2(0.0, e), t) - height(p - vec2(0.0, e), t);
  vec3 N = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));

  // Key light raking across the folds (from the upper-right) so the folds
  // read with deep, almost black shadows on their far side.
  vec3 L = normalize(vec3(0.50, 0.72, 0.40));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);

  float ndl = dot(N, L);
  // Contrast curve: faces turned away go fully black, lit faces form broad
  // soft bands like the reference.
  float diff = smoothstep(0.10, 0.98, ndl);
  diff = diff * diff;

  // Anisotropic satin sheen: highlight stretched along the fold direction.
  vec2 d2 = foldDir(t);
  vec3 T = normalize(vec3(d2, 0.0));
  float th = dot(T, H);
  float sinTH = sqrt(max(1.0 - th * th, 0.0));
  float aniso = pow(sinTH, 30.0) * smoothstep(0.55, 0.95, ndl);
  float spec = pow(max(dot(N, H), 0.0), 24.0);

  float lum = 0.23 * diff + uSheen * (0.07 * aniso + 0.06 * spec);

  // Brushed fibre texture running along the folds.
  float u = dot(p, vec2(-d2.y, d2.x));
  float v = dot(p, d2);
  float fibre = fbm(vec2(v * 9.0, u * 900.0));
  lum *= 0.95 + 0.10 * fibre;

  // Light falloff: brightest on the left / upper-left, fading towards
  // the right and the corners like the reference.
  vec2 q = frag / uResolution;
  float fall = 1.0 - smoothstep(0.15, 1.05, length((q - vec2(0.18, 0.62)) * vec2(1.0, 1.15)));
  lum *= mix(0.22, 1.25, fall);

  lum *= uGain * uExposure;
  lum = pow(max(lum, 0.0), uContrast);

  // Three-stop tint ramp.
  float s1 = smoothstep(0.0, 0.18, lum);
  float s2 = smoothstep(0.12, 0.55, lum);
  vec3 tint = mix(mix(uShadowTint, uMidTint, s1), uHighTint, s2);
  vec3 col = lum * tint;

  // Tiny dither to avoid banding in the deep shadows after H.264.
  col += (hash12(frag + fract(t) * 91.7) - 0.5) / 255.0;

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
