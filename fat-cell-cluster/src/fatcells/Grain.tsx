/**
 * Film grain, as a deterministic function of (pixel, frame).
 *
 * This is the second half of the banding defence: the shader dither handles a
 * single frame, the grain keeps a slow gradient from settling into visible
 * plateaus once it is encoded. It is hashed from screen coordinates and the
 * frame index — never Math.random() — and on the looping compositions it is
 * fed `frame % durationInFrames` so it repeats with the loop.
 */

import { BlendFunction, Effect } from "postprocessing";
import React, { useMemo } from "react";
import * as THREE from "three";

const fragmentShader = /* glsl */ `
uniform float uAmount;
// The effect stage runs on the composer's linear half-float buffer rather than
// on 8-bit display values, so a given amplitude here lands on screen about a
// quarter of its nominal size. Measured against the encoded file: without this
// factor, 2% grain moved the output by barely one code value and left the
// background plateaus intact.
const float TO_DISPLAY = 4.0;
uniform float uFrame;
uniform vec2 uResolution;

float hash13(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 px = floor(uv * uResolution);
  float n = hash13(vec3(px, uFrame)) - 0.5;
  // Scale the grain with luminance so the darkest fields stay clean.
  float lum = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float w = mix(0.55, 1.0, smoothstep(0.0, 0.35, lum));
  outputColor = vec4(inputColor.rgb + n * uAmount * TO_DISPLAY * w, inputColor.a);
}
`;

class GrainImpl extends Effect {
  constructor(amount: number, width: number, height: number) {
    super("Grain", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uAmount", new THREE.Uniform(amount)],
        ["uFrame", new THREE.Uniform(0)],
        ["uResolution", new THREE.Uniform(new THREE.Vector2(width, height))],
      ]),
    });
  }
}

export const Grain: React.FC<{
  amount: number;
  /** Already reduced modulo the loop length by the caller. */
  frame: number;
  width: number;
  height: number;
}> = ({ amount, frame, width, height }) => {
  const effect = useMemo(
    () => new GrainImpl(amount, width, height),
    [amount, width, height],
  );
  (effect.uniforms.get("uFrame") as THREE.Uniform).value = frame;
  return <primitive object={effect} dispose={null} />;
};
