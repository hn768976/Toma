import React, { useCallback } from "react";
import * as THREE from "three";
import { GLSL_HEADER } from "../lib/glsl";
import { ShaderPipeline, useStableUniforms } from "../lib/ShaderPipeline";
import { hexToLinear } from "../lib/color";
import type { RippleRingsRow } from "../data";

const FRAG = `${GLSL_HEADER}
uniform vec2 uResolution;
uniform float uFrame;
uniform float uLoop;
uniform vec2 uSource;         // in uv, origin bottom-left
uniform float uWavelength;    // fraction of frame width
uniform float uWavesPerLoop;
uniform vec2 uDimple;         // dimple cell size, fraction of frame width
uniform vec3 uBase;
uniform vec3 uHigh;
uniform vec3 uTrough;
out vec4 fragColor;

const float TAU = 6.283185307;

// Height field and its analytic gradient, in frame-width units.
float gWave;    // 0..1 wave height (for the cavity term)
float gBump;    // 0..1 dimple height
vec3 heightGrad(vec2 q, float t) {
  vec2 d = q - uSource * vec2(1.0, uResolution.y / uResolution.x);
  float r = length(d) + 1e-5;
  vec2 dir = d / r;
  float k = TAU / uWavelength;
  float ph = k * r - TAU * uWavesPerLoop * t;
  // Broad raised bands that fade out about half way across the frame.
  float env = (0.12 + 0.88 * exp(-r / 0.6)) * smoothstep(0.035, 0.06, r);
  float A = 0.0085 * env;
  float c = 0.5 + 0.5 * cos(ph);
  float h = A * c;
  vec2 g = A * (-0.5 * sin(ph)) * k * dir;
  gWave = c * smoothstep(0.12, 0.55, env);
  // Solid bullseye at the source.
  float core = exp(-pow(r / 0.03, 4.0));
  h += 0.006 * core;
  g += 0.006 * core * (-4.0 * pow(r, 3.0) / pow(0.03, 4.0)) * dir;
  gWave = max(gWave, core);

  // Dimple lattice: a soft grid of shallow round bumps.
  vec2 kd = TAU / uDimple;
  float bx = 0.5 + 0.5 * cos(q.x * kd.x);
  float by = 0.5 + 0.5 * cos(q.y * kd.y);
  // Wide oval bumps: sharpened so there are dark gaps between rows/columns.
  float B = 0.0026;
  float bump = pow(bx, 1.6) * pow(by, 2.4);
  h += B * bump;
  gBump = bump;
  vec2 gb = vec2(
    1.6 * pow(bx, 0.6) * (-0.5 * sin(q.x * kd.x) * kd.x) * pow(by, 2.4),
    2.4 * pow(by, 1.4) * (-0.5 * sin(q.y * kd.y) * kd.y) * pow(bx, 1.6));
  g += B * gb;
  return vec3(h, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 q = gl_FragCoord.xy / uResolution.x;
  float t = uFrame / uLoop;
  vec3 hg = heightGrad(q, t);
  vec3 n = normalize(vec3(-hg.yz, 1.0));
  // Cavity term: troughs and the gaps between dimples fall to near black.
  float cavity = mix(0.55, 1.0, smoothstep(0.0, 0.6, gWave))
               * mix(0.0, 1.0, smoothstep(0.06, 0.55, gBump + 0.4 * gWave));
  cavity *= mix(0.55, 1.0, smoothstep(0.1, 0.6, gWave + 0.3));

  vec3 L = normalize(vec3(-0.55, 0.6, 0.3));    // key from upper left
  vec3 R = normalize(vec3(0.6, -0.5, 0.3));     // cool rim from lower right
  vec3 V = vec3(0.0, 0.0, 1.0);
  float ndl = max(dot(n, L), 0.0);
  float flat0 = L.z;                             // response of a flat surface
  float diff = pow(ndl / flat0, 2.0) * 1.1;
  float rim = pow(max(dot(n, R), 0.0) / R.z, 3.0) * 0.05;
  vec3 H = normalize(L + V);
  float nh = max(dot(n, H), 0.0);
  float spec = pow(nh, 40.0);
  float sheen = pow(nh, 10.0);

  vec3 col = uTrough;
  col += uBase * diff * cavity;
  col += uHigh * vec3(0.35, 0.75, 1.0) * (spec * 0.8 + sheen * 0.25) * (0.3 + 0.7 * cavity);
  col += vec3(0.02, 0.1, 0.6) * rim * cavity;

  // Black frame falloff, as the reference sits on black.
  float vig = smoothstep(0.0, 0.035, uv.y) * smoothstep(1.0, 0.965, uv.y)
            * smoothstep(0.0, 0.015, uv.x) * smoothstep(1.0, 0.985, uv.x);
  col *= mix(0.1, 1.0, vig);
  fragColor = vec4(col, 1.0);
}
`;

export const RippleRings: React.FC<{ row: RippleRingsRow }> = ({ row }) => {
  const uniforms = useStableUniforms(() => ({
    uLoop: { value: row.durationInFrames },
    uSource: { value: new THREE.Vector2(row.source[0], 1 - row.source[1]) },
    uWavelength: { value: row.wavelength },
    uWavesPerLoop: { value: row.wavesPerLoop },
    uDimple: { value: new THREE.Vector2(row.dimple[0], row.dimple[1]) },
    uBase: { value: new THREE.Vector3(...hexToLinear(row.base)) },
    uHigh: { value: new THREE.Vector3(...hexToLinear(row.highlight)) },
    uTrough: { value: new THREE.Vector3(...hexToLinear(row.trough)) },
  }));
  const update = useCallback(() => {}, []);
  return (
    <ShaderPipeline
      fragment={FRAG}
      uniforms={uniforms}
      update={update}
      loopFrames={row.durationInFrames}
    />
  );
};
