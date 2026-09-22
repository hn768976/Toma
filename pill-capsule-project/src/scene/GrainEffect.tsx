import { forwardRef, useMemo } from "react";
import { BlendFunction, Effect } from "postprocessing";
import * as THREE from "three";

/**
 * Film grain + 1-LSB dither, applied last in the chain.
 *
 * Both are a pure hash of (pixel, frameIndex) — never Math.random(), never an
 * accumulator — so a frame rendered alone matches the same frame from a
 * sequential render. Feed it `frame % durationInFrames` so the grain is
 * periodic over the loop and the loop still closes pixel-for-pixel.
 *
 * Grain and dither are applied in display space and scaled by a luminance
 * gate, so an exactly-black background stays exactly 0,0,0 through the encode.
 * That matters for look 2, which ships as an overlay.
 */
const fragment = /* glsl */ `
uniform float grainAmount;
uniform float ditherAmount;
uniform float frameIndex;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 toDisplay(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 toLinear(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 lin = inputColor.rgb;
  float luma = dot(lin, vec3(0.2126, 0.7152, 0.0722));

  // Nothing is added to true black: the overlay composition needs 0,0,0 to
  // survive H.264.
  float gate = smoothstep(0.0, 0.02, luma);
  if (gate <= 0.0) {
    outputColor = vec4(lin, inputColor.a);
    return;
  }

  vec2 px = uv * resolution;
  // Two hashes summed give a triangular distribution, which dithers far more
  // cleanly than a single uniform sample.
  float n = hash13(vec3(px, frameIndex)) + hash13(vec3(px.yx + 19.7, frameIndex + 71.3)) - 1.0;
  float d = hash13(vec3(px + 3.7, frameIndex * 1.7 + 11.0)) +
            hash13(vec3(px.yx + 57.1, frameIndex * 0.9 + 133.0)) - 1.0;

  vec3 disp = toDisplay(lin);
  disp *= 1.0 + n * grainAmount * gate;
  disp += d * ditherAmount * gate;
  outputColor = vec4(toLinear(disp), inputColor.a);
}
`;

class GrainEffectImpl extends Effect {
  constructor(grainAmount: number, ditherAmount: number, frameIndex: number) {
    super("GrainEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform<number>>([
        ["grainAmount", new THREE.Uniform(grainAmount)],
        ["ditherAmount", new THREE.Uniform(ditherAmount)],
        ["frameIndex", new THREE.Uniform(frameIndex)],
      ]),
    });
  }
}

export type GrainProps = {
  /** 0.015-0.025 is the useful band. 0 disables. */
  amount: number;
  /** In display units; 1/255 is one output code value. */
  dither?: number;
  /** Must already be reduced modulo the loop length. */
  frameIndex: number;
};

export const Grain = forwardRef<GrainEffectImpl, GrainProps>(
  ({ amount, dither = 1 / 255, frameIndex }, ref) => {
    const effect = useMemo(
      () => new GrainEffectImpl(amount, dither, frameIndex),
      [amount, dither, frameIndex],
    );
    return <primitive ref={ref} object={effect} dispose={null} />;
  },
);
Grain.displayName = "Grain";
