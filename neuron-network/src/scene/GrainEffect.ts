/**
 * Film grain and dither, as the last pass.
 *
 * Banding is a primary requirement on this subject: dark blue gradients with
 * bloom over them are the worst case for 8-bit H.264, and most of these
 * compositions are exactly that. This sits AFTER bloom -- bloom is where the
 * smooth ramps are created -- and after tone mapping, which is where the
 * values are actually quantised to 8 bits.
 *
 * The noise is a hash of pixel coordinate and frame index, never
 * `Math.random()`, and the frame index is fed in as `frame % duration` so the
 * grain pattern is identical at frame 0 and frame 600.
 *
 * Both terms are gated on luminance, so a look whose background is meant to
 * be pure black encodes as pure black instead of being lifted off zero. The
 * gate is deliberately tight: a wider one also throttles dither across the
 * dark end of a navy gradient, which is precisely where 8-bit H.264 bands.
 */

import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

const FRAGMENT = /* glsl */ `
uniform float uFrame;
uniform float uAmount;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 col = inputColor.rgb;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float gate = smoothstep(0.0, 0.012, lum);

  float g = hash13(vec3(gl_FragCoord.xy, uFrame)) - 0.5;
  col += g * uAmount * gate;

  // A second, sub-code-value term breaks up the quantisation step itself.
  float d = hash13(vec3(gl_FragCoord.yx * 1.37, uFrame * 0.5 + 11.0)) - 0.5;
  col += d * (1.0 / 255.0) * gate;

  outputColor = vec4(max(col, 0.0), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor(amount = 0.02, frame = 0) {
    super("GrainEffect", FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uAmount", new Uniform(amount)],
        ["uFrame", new Uniform(frame)],
      ]),
    });
  }

  set amount(value: number) {
    (this.uniforms.get("uAmount") as Uniform).value = value;
  }

  set frame(value: number) {
    (this.uniforms.get("uFrame") as Uniform).value = value;
  }
}
