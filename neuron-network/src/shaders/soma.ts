/**
 * Soma shading: a hot core falling off to a glow at the rim, plus the
 * surface noise baked into the geometry so a matted cell body reads as
 * grainy rather than merely bumpy.
 */

export const SOMA_VERTEX = /* glsl */ `
attribute vec3 aSoma;   // x idle phase, y surface noise -1..1, z detail

varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vSoma;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  vSoma = aSoma;
  gl_Position = projectionMatrix * mv;
}
`;

export const SOMA_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uT;
uniform vec3  uCore;
uniform vec3  uGlow;
uniform float uBrightness;
uniform float uRimStrength;
uniform float uCorePower;
uniform float uGrain;
uniform float uCellPulse;
uniform float uCellPulseDepth;
uniform float uExposure;

varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vSoma;

void main() {
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(vViewDir);
  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);

  vec3 col = mix(uGlow, uCore, pow(ndv, uCorePower)) * uBrightness;
  col += uGlow * pow(1.0 - ndv, 2.5) * uRimStrength;

  // Surface grain, from the same noise that displaced the geometry.
  col *= 1.0 + uGrain * vSoma.y;

  // A slow idle breath keeps the field from looking frozen, at an integer
  // number of cycles so it closes with the loop.
  col *= 1.0 + 0.06 * sin(6.2831853 * 2.0 * uT + vSoma.x);
  col *= 1.0 + uCellPulse * uCellPulseDepth;
  col *= uExposure;

  gl_FragColor = vec4(col, 1.0);
}
`;
