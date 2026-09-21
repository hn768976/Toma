import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector2 } from "three";

/**
 * Final grade: dither and film grain in display space, after bloom.
 *
 * ACES tonemapping happens in the blade shader, upstream of the composer's
 * 8-bit buffer - see the note there.
 *
 * This batch is almost entirely smooth colour gradient, which is the worst case
 * for 8-bit H.264, so the dither is a primary requirement rather than a polish
 * step. Both the dither and the grain are pure hashes of (pixel, frame) - never
 * `Math.random()` - and the frame index handed in is already `frame % 600`, so
 * frame 600 gets frame 0's grain and the loop closes.
 *
 * The grain is weighted down in the darks, so a black field stays black - but
 * not too far down. x264 spends no bits on a large near-static dark area and
 * will flatten the faint blade comb in it to nothing; grain is what forces it
 * to keep coding there. uGrainFloor is per-composition for that reason: the
 * neon looks, which are mostly black field, need a higher floor than the ones
 * that are lit edge to edge.
 */
const fragmentShader = /* glsl */ `
uniform float uFrame;
uniform float uGrain;
uniform float uGrainFloor;
uniform vec2 uResolution;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Dither and grain go in a gamma-2.0 space - close enough to sRGB that the
  // amplitude is right across the range, and far cheaper than two transfer
  // round trips per pixel.
  vec3 s = sqrt(max(inputColor.rgb, 0.0));

  vec2 P = uv * uResolution;
  float n1 = hash13(vec3(P, uFrame));
  float n2 = hash13(vec3(P + 17.31, uFrame + 101.0));
  // Triangular-PDF dither, +/- 1/255.
  s += (n1 + n2 - 1.0) / 255.0;

  float g = hash13(vec3(P * 1.7 + 3.1, uFrame + 57.0)) * 2.0 - 1.0;
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s += g * uGrain * mix(uGrainFloor, 1.0, sqrt(clamp(l, 0.0, 1.0)));

  s = clamp(s, 0.0, 1.0);
  outputColor = vec4(s * s, inputColor.a);
}
`;

export class GradeEffect extends Effect {
  constructor(grain: number, grainFloor: number) {
    super("GradeEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<unknown>>([
        ["uFrame", new Uniform(0)],
        ["uGrain", new Uniform(grain)],
        ["uGrainFloor", new Uniform(grainFloor)],
        ["uResolution", new Uniform(new Vector2(1, 1))],
      ]),
    });
  }

  setSize(width: number, height: number) {
    (this.uniforms.get("uResolution") as Uniform<Vector2>).value.set(width, height);
  }

  setFrame(frame: number) {
    (this.uniforms.get("uFrame") as Uniform<number>).value = frame;
  }
}
