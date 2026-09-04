// Light shafts are several stacked transparent planes with a soft gradient,
// yawed to face the camera - far cheaper than a true volumetric pass and, at
// this softness, indistinguishable from one.
export const shaftVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shaftFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uSoftness;

  varying vec2 vUv;

  void main() {
    // Gaussian across the beam, so it has no visible edge.
    float x = (vUv.x - 0.5) * 2.0;
    float across = exp(-x * x * uSoftness);

    // Brightest at the top, dissipating downward.
    float down = pow(clamp(vUv.y, 0.0, 1.0), 1.7);

    // Fade the very top too, so the plane's own edge never shows.
    down *= 1.0 - smoothstep(0.90, 1.0, vUv.y);

    gl_FragColor = vec4(uColor * across * down * uIntensity, 1.0);
  }
`;
