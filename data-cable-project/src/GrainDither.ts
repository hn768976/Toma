import { wrapEffect } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

/**
 * Final-stage dither and film grain.
 *
 * Blue glow falling into black is where banding shows, and a perfectly clean
 * dark field also makes H.264 spend its bits elsewhere and smear the digits.
 * Both problems want the same fix.
 *
 * The noise is a hash of (pixel, frame) -- never Math.random() -- so it is
 * identical on every render thread, and it is fed frame % duration so it is
 * periodic over the loop.
 */
const fragmentShader = /* glsl */ `
  uniform float uFrame;
  uniform float uGrain;
  uniform float uDither;

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 seed = vec3(gl_FragCoord.xy, uFrame);
    float grain  = hash13(seed) - 0.5;
    float dither = hash13(seed + vec3(37.0, 17.0, 3.0)) - 0.5;

    // Work in display space so the dither really is +/- 1/255 of what the
    // encoder sees, then hand back a linear value for the composer to encode.
    vec3 display = pow(clamp(inputColor.rgb, 0.0, 1.0), vec3(1.0 / 2.2));
    display += grain * uGrain + dither * uDither;
    display = clamp(display, 0.0, 1.0);

    outputColor = vec4(pow(display, vec3(2.2)), inputColor.a);
  }
`;

export class GrainDitherEffect extends Effect {
  constructor({ frame = 0, grain = 0.02, dither = 2.0 / 255.0 } = {}) {
    super("GrainDitherEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number>>([
        ["uFrame", new Uniform(frame)],
        ["uGrain", new Uniform(grain)],
        ["uDither", new Uniform(dither)],
      ]),
    });
  }
}

export const GrainDither = wrapEffect(GrainDitherEffect);
