import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

// Film grain + ±1/255 dither, applied after bloom and tone mapping.
//
// Noise is an integer hash of (pixel x, pixel y, frame) — never Math.random()
// — so any frame renders identically on its own. Callers pass `frame % 600`
// for the looping look so the grain loops too.
//
// The effect runs before postprocessing's final linear→sRGB encode, so the
// noise is added in sRGB (display) space and converted back; that keeps the
// ±1/255 dither exactly one code value in the final 8-bit output, including
// in the dark gradients where banding shows.
const fragmentShader = /* glsl */ `
uniform float uFrame;
uniform float uGrain;
uniform float uDither;

uint gcHash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float gcRand(uvec2 p, uint s) {
  return float(gcHash(p.x ^ gcHash(p.y ^ gcHash(s)))) * (1.0 / 4294967295.0);
}
vec3 gcToSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 gcToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrame + 0.5);
  vec3 c = clamp(gcToSRGB(inputColor.rgb), 0.0, 1.0);
  // monochrome grain, triangular distribution in [-1, 1]
  float g = gcRand(px, f * 4u + 1u) + gcRand(px, f * 4u + 2u) - 1.0;
  // a touch less grain in the deepest blacks so they stay clean
  c += g * uGrain * smoothstep(0.0, 0.12, max(c.r, max(c.g, c.b)) + 0.04);
  // per-channel ±1/255 dither (rectangular)
  vec3 d = vec3(gcRand(px, f * 4u + 3u), gcRand(px + uvec2(7u, 13u), f * 4u + 3u), gcRand(px + uvec2(29u, 3u), f * 4u + 3u)) - 0.5;
  c += d * (2.0 * uDither);
  outputColor = vec4(gcToLinear(clamp(c, 0.0, 1.0)), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor({ grain = 0.0175, dither = 1 / 255 } = {}) {
    super("GrainEffect", fragmentShader, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map<string, Uniform>([
        ["uFrame", new Uniform(0)],
        ["uGrain", new Uniform(grain)],
        ["uDither", new Uniform(dither)],
      ]),
    });
  }

  setFrame(frame: number) {
    (this.uniforms.get("uFrame") as Uniform<number>).value = frame;
  }
}
