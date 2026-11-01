/**
 * Depth-of-field post pass: gathers a golden-angle disc of samples whose
 * radius follows the circle of confusion computed from the depth buffer.
 * Samples are weighted by their own blur amount so sharp foreground pins do
 * not bleed into blurred background areas.
 */
export const DOF_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const DOF_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uFocusRange;
uniform float uMaxBlur;

float linearDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

float coc(float d) {
  return clamp(abs(d - uFocus) / uFocusRange - 0.15, 0.0, 1.0);
}

const int TAPS = 40;
const float GOLDEN = 2.39996323;

void main() {
  float centerCoc = coc(linearDepth(vUv));
  vec3 sum = texture2D(tColor, vUv).rgb;
  float wsum = 1.0;
  float radius = centerCoc * uMaxBlur;
  if (radius > 0.5) {
    for (int i = 1; i < TAPS; i++) {
      float fi = float(i);
      float r = sqrt(fi / float(TAPS)) * radius;
      vec2 off = vec2(cos(fi * GOLDEN), sin(fi * GOLDEN)) * r / uResolution;
      vec2 uv = vUv + off;
      float sc = coc(linearDepth(uv));
      float w = smoothstep(0.0, 1.0, sc * uMaxBlur - r + 1.0);
      w = max(w, 0.05);
      sum += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  vec3 col = sum / wsum;
  // Subtle vignette.
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.22;
  gl_FragColor = vec4(col, 1.0);
}`;
