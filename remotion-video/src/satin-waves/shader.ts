import { WAVE_COUNT } from "./waves";

export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

#define N_WAVES ${WAVE_COUNT}
const float TAU = 6.283185307179586;

uniform vec2  uResolution;
uniform float uT;          // loop position, 0..1
uniform float uFrame;      // for the grain
uniform vec4  uWave[N_WAVES];        // kx, ky, cycles, phase
uniform vec2  uWaveAmpBand[N_WAVES]; // amp, band
uniform float uAmpNorm;
uniform vec3  uBandFocus;  // amplitude each band keeps when fully defocused
uniform float uWarp;
uniform float uCalm;       // how flat the near-left of the frame drapes
uniform vec3  uShadow;
uniform vec3  uMid;
uniform vec3  uHigh;
uniform float uBump;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uSpecPower;
uniform float uSheen;
uniform float uGrain;
uniform float uVignette;

out vec4 outColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Aspect-correct, +y up, one unit = the frame height. Keeping the unit tied
  // to height means 1080p and 4K frame the identical image.
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

  float at = TAU * uT;

  // Depth: the lower-left of the frame reads as further away, so its high
  // spatial bands get attenuated. Killing the high bands of a band-limited
  // field *is* a defocus blur, so this buys lens softness for free.
  float depth = smoothstep(-0.55, 0.75, -(uv.x * 0.82 + uv.y * 0.38));

  // The reference keeps its left side almost flat; this holds that back
  // without flattening it completely.
  float calm = mix(uCalm, 1.0, smoothstep(-0.85, 0.60, uv.x * 0.80 + uv.y * 0.42));

  // Travelling domain warp. Both terms advance by whole cycles per loop.
  float a1 =  1.90 * uv.x + 2.40 * uv.y + at;
  float a2 = -2.30 * uv.x + 1.70 * uv.y + 2.0 * at + 1.10;
  float c1 = cos(a1);
  float c2 = cos(a2);
  vec2 p = uv + uWarp * vec2(sin(a1), sin(a2));

  // Jacobian of that warp, so the normals stay analytically exact.
  // Column 0 is d(p)/du, column 1 is d(p)/dv.
  mat2 J = mat2(
    1.0 + uWarp * c1 * 1.90, uWarp * c2 * -2.30,
    uWarp * c1 * 2.40,       1.0 + uWarp * c2 * 1.70
  );

  float h = 0.0;
  vec2 dhdp = vec2(0.0);
  for (int i = 0; i < N_WAVES; i++) {
    vec4 w = uWave[i];
    int band = int(uWaveAmpBand[i].y + 0.5);
    float focus = band == 0 ? uBandFocus.x : (band == 1 ? uBandFocus.y : uBandFocus.z);
    float amp = uWaveAmpBand[i].x * mix(1.0, focus, depth) * calm;
    float ph = w.x * p.x + w.y * p.y + w.z * at + w.w;
    h    += amp * sin(ph);
    dhdp += amp * cos(ph) * w.xy;
  }
  h *= uAmpNorm;
  dhdp *= uAmpNorm;
  vec2 grad = vec2(dot(dhdp, J[0]), dot(dhdp, J[1]));

  vec3 nrm = normalize(vec3(-grad * uBump, 1.0));

  // Key light from the upper right, matching the reference.
  vec3 lightDir = normalize(vec3(0.42, 0.52, 0.74));
  vec3 halfDir = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(nrm, halfDir), 0.0);

  // Every term is measured against what a dead-flat surface would give, so a
  // flat region lands exactly on uMid instead of on an arbitrary offset.
  float diffuse = dot(nrm, lightDir) - lightDir.z;
  float spec  = pow(nh, uSpecPower) - pow(halfDir.z, uSpecPower);
  float sheen = pow(nh, 4.0)        - pow(halfDir.z, 4.0);

  float lum = 0.5
    + uDiffuse  * diffuse
    + uSpecular * spec
    + uSheen    * sheen
    + 0.035 * h                              // crests read slightly lighter
    + 0.045 * (uv.x * 0.6 + uv.y * 0.4);     // broad studio falloff
  lum -= uVignette * dot(uv, uv);
  lum = clamp(lum, 0.0, 1.0);

  vec3 col = lum < 0.5
    ? mix(uShadow, uMid, lum * 2.0)
    : mix(uMid, uHigh, (lum - 0.5) * 2.0);

  // Dither. At this contrast, 8-bit output bands badly without it.
  col += (hash12(frag + vec2(uFrame * 37.0, uFrame * 17.0)) - 0.5) * uGrain;

  outColor = vec4(col, 1.0);
}
`;
