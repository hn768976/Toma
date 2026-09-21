/**
 * Deterministic film grain.
 *
 * Large smooth pastel gradients across a 4K frame are close to the worst case
 * for 8-bit H.264 -- the encoder quantises the ramp into visible plateaus.
 * A little grain breaks the plateaus up and costs nothing perceptually.
 *
 * The noise is a hash of (pixel, frame) rather than `Math.random()`, for two
 * reasons: Remotion renders frames out of order on separate threads, so random
 * grain would differ between a cold single-frame render and a sequential one;
 * and feeding the hash `frame % durationInFrames` makes the grain itself
 * periodic, so frame 300 gets frame 0's grain and the loop still closes.
 */
import { Effect } from 'postprocessing';
import React, { useMemo } from 'react';
import * as THREE from 'three';

const fragmentShader = /* glsl */ `
uniform float uFrame;
uniform float uAmount;
uniform vec2 uResolution;

// Hash without sine -- stable across GPU and SwiftShader, unlike sin-based
// hashes which drift with precision.
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 pixel = floor(uv * uResolution);
  // Two decorrelated taps give a flatter spectrum than one, which reads as
  // film grain rather than as a dither pattern.
  float n = hash13(vec3(pixel, uFrame));
  float m = hash13(vec3(pixel.yx + 17.0, uFrame + 101.0));
  float noise = (n + m) * 0.5 - 0.5;
  outputColor = vec4(inputColor.rgb + noise * uAmount, inputColor.a);
}
`;

class GrainEffectImpl extends Effect {
  constructor(frame: number, amount: number, width: number, height: number) {
    super('SerumGrainEffect', fragmentShader, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uFrame', new THREE.Uniform(frame)],
        ['uAmount', new THREE.Uniform(amount)],
        ['uResolution', new THREE.Uniform(new THREE.Vector2(width, height))],
      ]),
    });
  }

  setParams(frame: number, amount: number, width: number, height: number) {
    this.uniforms.get('uFrame')!.value = frame;
    this.uniforms.get('uAmount')!.value = amount;
    (this.uniforms.get('uResolution')!.value as THREE.Vector2).set(width, height);
  }
}

export const Grain: React.FC<{
  /** Already reduced modulo the loop length by the caller. */
  frame: number;
  /** Peak-to-peak amplitude in 0-1 units; 0.015-0.025 is the useful range. */
  amount: number;
  width: number;
  height: number;
}> = ({ frame, amount, width, height }) => {
  // One stable instance; only its uniforms change per frame. Rebuilding the
  // effect each frame would force the composer to rebuild its pass chain.
  const effect = useMemo(
    () => new GrainEffectImpl(frame, amount, width, height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  effect.setParams(frame, amount, width, height);
  return <primitive object={effect} dispose={null} />;
};
