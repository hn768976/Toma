/** GLSL for the rack fronts and the light streams. */

export const HASH_GLSL = /* glsl */ `
uint hashU(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
`;

export const rackVertex = /* glsl */ `
attribute float aVariant;
attribute float aSeed;
varying vec2 vUv;
varying float vVariant;
varying float vSeed;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vVariant = aVariant;
  vSeed = aSeed;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const rackFragment = /* glsl */ `
uniform sampler2D uBase;
uniform sampler2D uMask;
uniform float uFrame;        // looped frame, 0..599
uniform vec3 uGreen;
uniform vec3 uBlue;
uniform vec3 uWhite;
uniform float uLedGain;
uniform float uBaseGain;
uniform vec3 uWashColor;
uniform float uWash;
uniform vec3 uSheen;
uniform vec3 uEdgeColor;
uniform vec3 uBaseTint;
varying vec2 vUv;
varying float vVariant;
varying float vSeed;
varying vec3 vWorld;
${HASH_GLSL}
#include <fog_pars_fragment>

const float PERIODS[12] = float[](8.0, 10.0, 12.0, 15.0, 20.0, 24.0, 30.0, 40.0, 50.0, 60.0, 100.0, 150.0);

void main() {
  vec2 auv = vec2((vUv.x + vVariant) / 4.0, vUv.y);
  vec3 base = texture(uBase, auv).rgb;
  vec4 m = texture(uMask, auv);
  float id = floor(m.g * 255.0 + 0.5);
  uint h = hashU(uint(id) * 2654435761u ^ uint(vSeed) * 40503u);
  // every period divides 600, so the pattern at frame 600 equals frame 0
  float P = PERIODS[h % 12u];
  float slot = floor(uFrame / P);
  uint hb = hashU(h ^ uint(slot) * 374761393u);
  float on = id < 0.5 ? 1.0 : (float(hb % 100u) < 72.0 ? 1.0 : 0.12);
  vec3 ledCol = m.b < 0.25 ? uGreen : (m.b < 0.75 ? uBlue : uWhite);
  vec3 col = base * uBaseGain * uBaseTint;
  col += ledCol * m.r * on * uLedGain;
  // glass door: light sheen towards the top, wash from the light streams
  float sheen = smoothstep(0.35, 1.0, vUv.y) * 0.5 + 0.08;
  col += uSheen * sheen;
  col += uWashColor * uWash * (0.25 + 0.75 * smoothstep(0.0, 1.0, vUv.y));
  float edgeMask = smoothstep(0.02, 0.0, vUv.x) + smoothstep(0.98, 1.0, vUv.x);
  col += uEdgeColor * edgeMask * smoothstep(0.1, 0.25, vUv.y) * smoothstep(0.95, 0.8, vUv.y);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

/**
 * Light streams: thin camera-facing ribbons along a polyline, with bright
 * heads racing along them. Head positions repeat every 600 frames
 * (uPhase is cyc(frame, 1, 600) and every line moves a whole number of
 * wrap lengths per loop).
 */
export const streamVertex = /* glsl */ `
attribute float aSide;        // -1 / +1
attribute float aS;           // arc length along the line
attribute vec3 aDir;          // line tangent
attribute vec4 aLine;         // speed (wraps/loop), wrap length, phase, brightness
attribute float aTrail;
varying float vS;
varying vec4 vLine;
varying float vTrail;
varying float vSide;
uniform float uMinWidth;      // radians per pixel-ish, keeps far lines >= ~1px
uniform float uWidth;
#include <fog_pars_vertex>
void main() {
  vS = aS;
  vLine = aLine;
  vTrail = aTrail;
  vSide = aSide;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  vec3 side = normalize(cross(aDir, toCam));
  float dist = length(cameraPosition - wp.xyz);
  float w = max(uWidth, dist * uMinWidth);
  wp.xyz += side * aSide * w * 0.5;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const streamFragment = /* glsl */ `
uniform float uPhase;
uniform float uGain;
uniform float uBaseGlow;
uniform vec3 uColor;
uniform vec3 uHot;
varying float vS;
varying vec4 vLine;
varying float vTrail;
varying float vSide;
#include <fog_pars_fragment>
void main() {
  float speed = vLine.x;
  float wrap = vLine.y;
  float head = (fract(uPhase * speed + vLine.z)) * wrap;
  // distance behind the head, along the direction of travel
  float d = mod(head - vS, wrap);
  float trail = exp(-d / vTrail);
  float core = exp(-d / (vTrail * 0.08));
  float across = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
  float a = vLine.w * (uBaseGlow + trail * 1.2 + core * 3.5) * uGain;
  vec3 col = mix(uColor, uHot, clamp(core * 0.5, 0.0, 1.0)) * a * across;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;
