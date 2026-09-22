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

  // The real sRGB transfer function, not a gamma-2.2 approximation of it.
  // Approximating costs a visible tone shift in the shadows -- exactly where
  // this effect is supposed to be working -- and crushes the dither there.
  vec3 toSrgb(vec3 c) {
    return mix(c * 12.92,
               1.055 * pow(max(c, vec3(1e-8)), vec3(1.0 / 2.4)) - 0.055,
               step(vec3(0.0031308), c));
  }

  vec3 toLinear(vec3 c) {
    return mix(c / 12.92,
               pow((c + 0.055) / 1.055, vec3(2.4)),
               step(vec3(0.04045), c));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 seed = vec3(gl_FragCoord.xy, uFrame);
    float grain  = hash13(seed) - 0.5;
    float dither = hash13(seed + vec3(37.0, 17.0, 3.0)) - 0.5;

    // Work in display space so the dither really is +/- 1/255 of what the
    // encoder sees, then hand back a linear value for the composer to encode.
    vec3 display = toSrgb(clamp(inputColor.rgb, 0.0, 1.0));

    // Gate the noise off at true black. Four of these compositions are sold as
    // screen-blend overlays and have to encode as #000000 away from the
    // strands; ungated grain would lift every empty pixel off zero. The gate
    // opens by ~4/255, so the halo where banding actually shows is unaffected.
    //
    // This keys on the strongest channel, not on luma. Luma weights green
    // roughly ten times blue, so a luma gate opened on a green strand's faint
    // halo while staying shut on an identical blue one -- the green colourway
    // came back with 8% of the frame sitting at value 1 instead of 0, and the
    // blue one was under-dithered for the same reason.
    float level = max(display.r, max(display.g, display.b));
    float gate = smoothstep(0.0, 0.016, level);

    display += (grain * uGrain + dither * uDither) * gate;
    display = clamp(display, 0.0, 1.0);

    outputColor = vec4(toLinear(display), inputColor.a);
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
