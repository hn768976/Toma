import { SIMPLEX_4D } from "./noise";
import { SURFACE } from "./surface";

/**
 * An opaque backing for the cloth, sitting a hair below the lines and written
 * into the depth buffer before them.
 *
 * Without it the cloth is a transparent mesh: you see the far side of every
 * fold through the gaps between the near lines, and two line families
 * superimposed at slightly different pitches is a moire generator. Real cloth
 * occludes itself, and so does this.
 */
export const SOLID_VERTEX = /* glsl */ `
${SIMPLEX_4D}
${SURFACE}

uniform float uBackOffset;   // push the fill below the lines, world units
uniform vec3  uLightDir;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uDiffusePow;
uniform float uTroughDarken;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uGridU;
uniform float uGridV;

varying float vBright;
varying float vFade;

void main() {
  vec2 uv = position.xy;

  vec3 P  = surfacePos(uv);
  vec3 Pu = surfacePos(uv + vec2(uGridU, 0.0));
  vec3 Pv = surfacePos(uv + vec2(0.0, uGridV));
  vec3 N = normalize(cross(Pv - P, Pu - P));

  P -= uPlaneN * uBackOffset;

  float hNorm = dot(P, uPlaneN) / max(uAmp, 1e-3);
  float occ = mix(uTroughDarken, 1.0, smoothstep(-1.0, 0.55, hNorm));
  vBright = (uAmbient + uDiffuse * pow(clamp(dot(N, normalize(uLightDir)), 0.0, 1.0), uDiffusePow)) * occ;

  vec4 clip = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
  float viewDist = -(modelViewMatrix * vec4(P, 1.0)).z;
  vFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, viewDist);
  gl_Position = clip;
}
`;

export const SOLID_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uShadow;
uniform vec3 uMid;
uniform vec3 uHot;
uniform vec3 uBackground;
uniform float uFillStrength;

varying float vBright;
varying float vFade;

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uShadow, uMid, t * 2.0) : mix(uMid, uHot, (t - 0.5) * 2.0);
}

void main() {
  // Barely lit — the fill is there to occlude, not to be seen. What little of
  // it shows through the gaps between lines reads as the cloth itself.
  vec3 col = mix(uBackground, ramp(vBright) * uFillStrength, vFade);
  gl_FragColor = vec4(col, 1.0);
}
`;
