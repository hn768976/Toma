import { useMemo } from "react";
import { Effect } from "postprocessing";
import { Uniform } from "three";
import { LOOP_FRAMES } from "../lib/loop";

/**
 * Last effect in the chain (after bloom + tone mapping).
 * Works in output (sRGB) units so the amounts are what you see in the file:
 *  - ±1/255 dither to break up 8-bit banding in the dark gradients
 *  - film grain (amount = peak amplitude, e.g. 0.02 = 2 %)
 * Both come from an integer hash of (pixel x, pixel y, frame % 600) — a fixed
 * formula, so it loops and is identical on every render thread.
 * blackSafe: no noise at all on pure black, only where there's glow.
 */
const FRAG = /* glsl */ `
uniform float uFrame;
uniform float uGrain;
uniform float uDither;
uniform float uBlackSafe;

uvec3 pcg3d(uvec3 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 toSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c){
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 s = toSRGB(clamp(inputColor.rgb, 0.0, 1.0));
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uint(uFrame)));
  vec3 r = vec3(h & uvec3(0xffffffu)) / 16777216.0;
  float grain = (r.x + r.y - 1.0) * uGrain;     // triangular, monochrome
  float dither = (r.z - 0.5) * 2.0 * uDither;    // ±1/255
  float mask = 1.0;
  if (uBlackSafe > 0.5) {
    float m = max(s.r, max(s.g, s.b));
    mask = smoothstep(0.75 / 255.0, 4.0 / 255.0, m);
  }
  s = max(s + (grain + dither) * mask, 0.0);
  outputColor = vec4(toLinear(s), inputColor.a);
}
`;

class GrainEffectImpl extends Effect {
  constructor() {
    super("GrainEffect", FRAG, {
      uniforms: new Map<string, Uniform>([
        ["uFrame", new Uniform(0)],
        ["uGrain", new Uniform(0.02)],
        ["uDither", new Uniform(1 / 255)],
        ["uBlackSafe", new Uniform(0)],
      ]),
    });
  }
}

export const Grain: React.FC<{ frame: number; amount: number; blackSafe: boolean }> = ({ frame, amount, blackSafe }) => {
  const effect = useMemo(() => new GrainEffectImpl(), []);
  effect.uniforms.get("uFrame")!.value = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  effect.uniforms.get("uGrain")!.value = amount;
  effect.uniforms.get("uBlackSafe")!.value = blackSafe ? 1 : 0;
  return <primitive object={effect} dispose={null} />;
};
