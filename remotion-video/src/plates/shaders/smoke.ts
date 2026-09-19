import { GLSL_LIB } from "./lib";

/**
 * Plate 03 - SMOKE / FOG.
 *
 * Reference: volumetric fog billowing through frame, keyed from the upper left
 * so wisps catch the light at the top and fall away to black toward the lower
 * right. Built from a domain-warped 3D value-noise fBm: one fBm pair warps the
 * sample position, a second reads the density.
 *
 * Looping: the field drifts upward continuously, so it cannot simply oscillate.
 * Instead the whole field is evaluated twice - once at phase t, once at the
 * same field one full loop earlier - and cross-dissolved by t. At t = 0 the mix
 * is F(0); at t = 1 it is also F(0), so the loop closes exactly. The two
 * branches stay well correlated because the per-loop travel is modest, and the
 * contrast curve after the mix compensates for the slight softening midway.
 */
export const SMOKE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 finalColor;

uniform float uT;
uniform vec2  uRes;
uniform float uSeed;
uniform float uDensity;
uniform float uBright;
uniform float uSpeed;

${GLSL_LIB}

// NOTE: uSpeed scales the drift *inside* the field, never the phase 't' passed
// in - the exact loop depends on the caller evaluating at t and t - 1.
float smokeField(vec2 uv, float t) {
  float sp = uSpeed;

  vec3 wq = vec3(uv * 4.10 + vec2(0.0, -t * 0.30 * sp), t * 0.55 * sp + uSeed);
  float w1 = fbm3(wq, 3);
  float w2 = fbm3(wq + vec3(5.2, 1.3, 2.7), 3);

  vec3 p = vec3(
    uv * 3.10 + (vec2(w1, w2) - 0.5) * 1.45 + vec2(0.0, -t * 0.42 * sp),
    t * 0.30 * sp + uSeed * 2.0
  );
  return fbm3(p, 4);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vec2(vUV.x * aspect, vUV.y);

  // Cross-dissolve one loop of travel against itself => exact loop.
  float f = mix(smokeField(uv, uT), smokeField(uv, uT - 1.0), uT);

  // Measured range of the field above is ~0.29 .. 0.72 with a mean near 0.48,
  // so the density threshold is placed just above that mean: most of the frame
  // stays clear and only the upper part of the distribution becomes visible
  // fog. Anything narrower than this crushes the whole plate to black.
  float dens = smoothstep(0.47, 0.77, f) * uDensity;

  // Key light from the upper left. Kept ADDITIVE rather than a chain of
  // sub-unity multipliers, which is what previously ate the exposure.
  float key = smoothstep(2.10, -0.30, uv.x * 0.62 + uv.y * 0.95);
  float glow = exp(-length((uv - vec2(0.32, 0.00)) * vec2(0.70, 1.0)) * 1.55);
  float light = 0.30 + 0.70 * key + 0.50 * glow;

  // Fog sits in the upper two thirds and thins toward the floor.
  // The reference fog hugs the top of the frame and thins sharply downward.
  float vfall = 0.25 + 0.75 * smoothstep(1.15, -0.05, vUV.y);

  vec3 tint = vec3(0.86, 0.885, 0.925);
  vec3 col = tint * dens * light * vfall * 0.60 * uBright;

  col += grain(gl_FragCoord.xy, uT) * 0.0050;

  finalColor = vec4(max(col, 0.0), 1.0);
}
`;
