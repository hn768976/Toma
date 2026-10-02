import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";
import { LOOP_FRAMES } from "./constants";

/**
 * Film grain + output dither, applied after bloom and tonemapping.
 *
 * Both come from an integer hash of (grain cell, frame % 600), so they are a
 * fixed function of pixel position and frame: identical on every render
 * thread and looping on the 600-frame cycle. The grain cell is 1/1080 of the
 * frame height, so grain is the same size relative to the frame at 1080p
 * and at 4K.
 *
 * The final EffectPass converts linear -> sRGB after this effect, so the
 * shader goes to sRGB, adds grain and +-1/255 dither there, then goes back.
 */
const fragmentShader = /* glsl */ `
uvec3 grainPcg(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 grainHash(uvec3 v) { return vec3(grainPcg(v)) * (1.0 / 4294967295.0); }
uniform float uFrame;
uniform float uGrain;

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 s = toSRGB(clamp(inputColor.rgb, 0.0, 1.0));
  uint f = uint(mod(uFrame, ${LOOP_FRAMES}.0));
  // grain on a 1/1080-of-height grid
  vec2 cell = floor(uv * vec2(1080.0 * resolution.x / resolution.y, 1080.0));
  vec3 h = grainHash(uvec3(uvec2(cell), f));
  float grain = (h.x + h.y - 1.0);              // triangular, -1..1
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s += grain * uGrain * (0.6 + 0.4 * (1.0 - lum)); // a touch less in highlights
  // per-pixel +-1/255 dither in output space
  vec3 d = grainHash(uvec3(uvec2(gl_FragCoord.xy), f + 977u));
  s += (d.x + d.y - 1.0) / 255.0;
  outputColor = vec4(toLinear(clamp(s, 0.0, 1.0)), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor(grain = 0.02) {
    super("GrainEffect", fragmentShader, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ["uFrame", new Uniform(0)],
        ["uGrain", new Uniform(grain)],
      ]),
    });
  }
  setFrame(frame: number) {
    // grain is a fixed function of (pixel, frame % 600): loops with the clip
    this.uniforms.get("uFrame")!.value = frame % LOOP_FRAMES;
  }
}
