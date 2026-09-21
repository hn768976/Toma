/**
 * Drifting particles and junction sparks.
 *
 * Both are point sprites whose position is computed entirely in the vertex
 * shader from baked Lissajous parameters and the loop position, so nothing
 * is uploaded per frame and the paths close exactly. Integer frequencies are
 * what guarantee the close.
 */

export const PARTICLE_VERTEX = /* glsl */ `
attribute vec3 aAmp;
attribute vec3 aFreq;    // integers
attribute vec3 aPhase;
attribute vec2 aMisc;    // x size, y brightness

uniform float uT;
uniform float uPixelScale;

varying float vBright;

void main() {
  vec3 p = position + aAmp * sin(6.2831853 * (aFreq * uT + aPhase));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aMisc.x * uPixelScale / max(0.001, -mv.z));
  vBright = aMisc.y;
}
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uExposure;

varying float vBright;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float a = exp(-r * r * 3.2) * smoothstep(1.0, 0.7, r);
  // Discard the transparent corners so the sprite does not write a square
  // of depth, which would make depth of field blur a block of background.
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor * vBright * a * uExposure, a);
}
`;

export const SPARK_VERTEX = /* glsl */ `
attribute vec3 aMisc;    // x phase, y size, z star rotation

uniform float uPixelScale;

varying float vPhase;
varying float vRot;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aMisc.y * uPixelScale / max(0.001, -mv.z));
  vPhase = aMisc.x;
  vRot = aMisc.z;
}
`;

export const SPARK_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uT;
uniform float uCycles;   // integer, so the flash pattern closes
uniform float uStrength;
uniform vec3  uColor;
uniform float uExposure;

varying float vPhase;
varying float vRot;

void main() {
  // Brief and sharp: present in some frames, absent in others.
  float flash = pow(max(0.0, sin(6.2831853 * uCycles * uT + vPhase)), 40.0);
  if (flash < 0.004) discard;

  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  if (r > 1.0) discard;

  float ang = atan(q.y, q.x) + vRot;
  float rays =
      pow(abs(cos(ang * 2.0)), 90.0)
    + pow(abs(cos(ang * 2.0 + 0.785398)), 140.0) * 0.45;
  float core = exp(-r * r * 60.0);
  float a = clamp(core + rays * (1.0 - r) * (1.0 - r) * 0.8, 0.0, 1.0);
  if (a < 0.02) discard;

  gl_FragColor = vec4(uColor * a * flash * uStrength * uExposure, a * flash);
}
`;
