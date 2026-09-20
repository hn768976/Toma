/**
 * Film grain and pre-encode dither, in one pass, as the last thing before the
 * frame is written.
 *
 * Two jobs:
 *
 * 1. Dither. These frames are mostly large, smooth gradients - the lilac field
 *    in look 4 especially - and an 8-bit H.264 encode will band them into
 *    visible rings. Adding a triangular-PDF noise of about one 8-bit step
 *    before quantisation turns the hard step edges into noise, which the eye
 *    reads as a continuous ramp. This also runs for the PNG stills: they are
 *    lossless, so any banding there came from the render and dithering is the
 *    fix.
 *
 * 2. Grain. A little luminance-weighted grain on top, which sells the
 *    photographic looks and gives the encoder something to hold onto.
 *
 * Determinism: the noise is hashed from pixel coordinate and frame *number*,
 * passed in explicitly. postprocessing provides a built-in `time` uniform, but
 * it accumulates from a clock - using it would make the grain depend on when a
 * frame was rendered rather than which frame it is, and Remotion renders
 * frames out of order across threads.
 */

import React, { forwardRef, useLayoutEffect, useMemo } from "react";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
uniform float uFrame;
uniform float uGrain;
uniform float uDither;

// Integer-lattice hash. Stable for a given (pixel, frame) on any GPU that
// respects highp float, which every desktop WebGL2 target does.
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 color = inputColor.rgb;
  vec2 pixel = uv * resolution;

  // Triangular PDF from two independent uniform samples. TPDF at 1 LSB fully
  // decorrelates the quantisation error, which a single uniform sample does
  // not - that is what actually removes the rings rather than just softening
  // them.
  float d1 = hash13(vec3(pixel, uFrame));
  float d2 = hash13(vec3(pixel.yx + 17.0, uFrame + 101.0));
  float tpdf = d1 - d2;
  color += tpdf * (uDither / 255.0);

  // Grain, weighted toward the midtones: heavy grain in the blacks reads as
  // encoder noise, and in the highlights it reads as dirt.
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float weight = 1.0 - abs(luma * 2.0 - 1.0) * 0.65;
  float g1 = hash13(vec3(pixel + 53.7, uFrame * 1.7 + 7.0));
  float g2 = hash13(vec3(pixel.yx + 91.3, uFrame * 1.7 + 211.0));
  color += (g1 - g2) * uGrain * weight;

  outputColor = vec4(color, inputColor.a);
}
`;

class GrainDitherEffect extends Effect {
  constructor({ frame = 0, grain = 0.015, dither = 0.6 }) {
    super("GrainDitherEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number>>([
        ["uFrame", new Uniform(frame)],
        ["uGrain", new Uniform(grain)],
        ["uDither", new Uniform(dither)],
      ]),
    });
  }

  setParameters(frame: number, grain: number, dither: number) {
    (this.uniforms.get("uFrame") as Uniform<number>).value = frame;
    (this.uniforms.get("uGrain") as Uniform<number>).value = grain;
    (this.uniforms.get("uDither") as Uniform<number>).value = dither;
  }
}

export const GrainDither = forwardRef<
  GrainDitherEffect,
  { frame: number; grain: number; dither: number }
>(({ frame, grain, dither }, ref) => {
  const effect = useMemo(
    () => new GrainDitherEffect({ frame, grain, dither }),
    // Constructed once; values are pushed through setParameters below so the
    // effect is not rebuilt (and its shader recompiled) on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useLayoutEffect(() => {
    effect.setParameters(frame, grain, dither);
  }, [effect, frame, grain, dither]);

  useLayoutEffect(() => () => effect.dispose(), [effect]);

  return <primitive ref={ref} object={effect} dispose={null} />;
});

GrainDither.displayName = "GrainDither";
