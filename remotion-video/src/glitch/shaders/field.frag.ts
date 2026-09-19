import { GLSL_HASH, GLSL_NOISE } from "./lib";

/**
 * Low-resolution control field (runs at 1/8 scale).
 *
 * The fBm here is by far the most expensive maths in the pipeline, and every
 * quantity it produces is low-frequency, so it is generated small and sampled
 * bilinearly by the full-resolution cell pass.
 *
 *   R  density   how much of this region lights up
 *   G  hue       position along the variant's palette ramp
 *   B  energy    brightness multiplier
 *   A  warp      horizontal displacement feeding the chevron edges
 */
export const FIELD_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 finalColor;

uniform vec2  uFieldFreq;    // lattice units across the screen (integral)
uniform vec3  uPeriod;       // lattice wrap period (integral)
uniform vec3  uDriftPeriods; // whole periods travelled over one loop (integral)
uniform float uPhase;        // 0..1 through the loop
uniform float uSeed;
uniform float uDensityBias;
uniform float uDensityGain;
uniform float uBandAmount;   // horizontal banding (sparse variants)
uniform float uColumnAmount; // vertical intensity columns (scanline variant)

${GLSL_HASH}
${GLSL_NOISE}

void main() {
  vec3 p = vec3(vUv.x * uFieldFreq.x, vUv.y * uFieldFreq.y, 0.0)
         + uPeriod * uDriftPeriods * uPhase;

  float dens = tileFbm(p, uPeriod, uSeed, 4);
  float hue  = tileFbm(p + vec3(11.3, 5.1, 2.7), uPeriod, uSeed + 77.0, 3);
  // Integral frequency multiplier with a matching period keeps the wrap intact.
  float ener = tileFbm(p * 2.0 + vec3(3.0, 19.0, 7.0), uPeriod * 2.0, uSeed + 133.0, 3);
  float warp = tileFbm(p + vec3(41.0, 2.0, 13.0), uPeriod, uSeed + 201.0, 2);

  // x is frozen, so this term varies only down the frame: the drifting
  // horizontal bands the sparse reference is built from.
  float band = tileFbm(
    vec3(7.3, p.y * 2.0, p.z),
    vec3(uPeriod.x, uPeriod.y * 2.0, uPeriod.z),
    uSeed + 301.0,
    3
  );
  band = smoothstep(0.34, 0.72, band);
  dens = mix(dens, dens * band, uBandAmount);

  // y frozen: broad vertical columns of intensity across the frame.
  float column = tileFbm(
    vec3(p.x * 2.0, 3.7, p.z),
    vec3(uPeriod.x * 2.0, uPeriod.y, uPeriod.z),
    uSeed + 419.0,
    3
  );
  ener = mix(ener, ener * mix(0.25, 1.35, column), uColumnAmount);

  dens = clamp((dens - uDensityBias) * uDensityGain + uDensityBias, 0.0, 1.0);

  finalColor = vec4(dens, hue, clamp(ener, 0.0, 1.0), warp);
}
`;
