/**
 * Two full-screen passes that bracket the cloth: a background wash underneath
 * and film grain on top. Both bypass the matrices — `position` is already in
 * clip space — so they need no camera-relative placement.
 */
export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BACKGROUND_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uBackground;
uniform vec3 uHorizon;
uniform float uHorizonY;
uniform float uHorizonSpread;
varying vec2 vNdc;

void main() {
  // A barely-there lift behind the cloth so the top of frame is near-black but
  // not dead flat.
  float t = 1.0 - smoothstep(0.0, uHorizonSpread, abs(vNdc.y - uHorizonY));
  float vign = 1.0 - 0.35 * dot(vNdc * vec2(0.7, 1.0), vNdc * vec2(0.7, 1.0));
  gl_FragColor = vec4(mix(uBackground, uHorizon, t * 0.6) * vign, 1.0);
}
`;

export const GRAIN_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uSeed;
uniform float uAmount;
varying vec2 vNdc;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // Per-pixel, per-frame grain. It doubles as a dither: the dark falloff of the
  // cloth would otherwise band once the video is encoded to 8-bit yuv420p.
  float n = hash(gl_FragCoord.xy + vec2(uSeed * 37.13, uSeed * 91.71));
  float signed = n - 0.5;
  // Mixing toward white or black at a low alpha gives a symmetric +/- grain
  // with plain alpha blending.
  gl_FragColor = vec4(vec3(step(0.0, signed)), abs(signed) * 2.0 * uAmount);
}
`;
