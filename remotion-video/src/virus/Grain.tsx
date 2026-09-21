// Film grain as a post effect.
//
// Two constraints shape this. It has to be a pure function of (pixel, frame),
// because Remotion renders frames out of order and Math.random() would give a
// different result depending on which thread got there first. And it has to be
// periodic over the loop: the shader is fed `frame % durationInFrames`, so the
// grain at frame 600 is the grain at frame 0 and the loop still closes.

import { forwardRef, useMemo } from "react";
import { Effect } from "postprocessing";
import { Uniform } from "three";

const FRAG = /* glsl */ `
uniform float uIntensity;
uniform float uFrame;

// Integer-free hash; stable across drivers in a way sin(dot(...)) is not.
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;
  float n = hash13(vec3(floor(px), uFrame));
  // Centred, so grain neither lifts nor crushes the average level.
  float g = (n - 0.5) * 2.0 * uIntensity;
  outputColor = vec4(inputColor.rgb + g, inputColor.a);
}
`;

class GrainEffectImpl extends Effect {
  constructor(intensity: number, frame: number) {
    super("GrainEffect", FRAG, {
      uniforms: new Map<string, Uniform<number>>([
        ["uIntensity", new Uniform(intensity)],
        ["uFrame", new Uniform(frame)],
      ]),
    });
  }
}

export const Grain = forwardRef<
  GrainEffectImpl,
  { intensity: number; frame: number }
>(({ intensity, frame }, ref) => {
  // Rebuilt when either input changes; nothing accumulates between frames.
  const effect = useMemo(
    () => new GrainEffectImpl(intensity, frame),
    [intensity, frame],
  );
  return <primitive ref={ref} object={effect} dispose={null} />;
});
Grain.displayName = "Grain";
