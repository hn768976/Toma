/**
 * Shader-generated background: a radial gradient lifted behind the hero
 * neuron, dithered in place.
 *
 * Dark blue gradients are the worst case for 8-bit H.264, so the dither goes
 * in here as well as after bloom. It is gated on luminance so a look whose
 * background is meant to be pure black stays exactly zero.
 */

export const BG_VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  // Drawn straight in clip space at the far plane, with depth writes off.
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const BG_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3  uInner;
uniform vec3  uOuter;
uniform vec2  uCenter;    // screen-space centre of the lift, in UV
uniform float uLift;
uniform float uGain;
uniform float uAspect;
uniform float uExposure;

varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 d = (vUv - uCenter) * vec2(uAspect, 1.0);
  float r = clamp(length(d) * 1.05, 0.0, 1.0);

  vec3 col = mix(uInner, uOuter, smoothstep(0.0, 1.0, r)) * uGain;
  col += uInner * uGain * uLift * pow(1.0 - r, 3.0);
  col *= uExposure;

  // +/- half a code value, gated so pure black is left alone.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float gate = smoothstep(0.0, 0.008, lum);
  col += (hash12(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0) * gate;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
