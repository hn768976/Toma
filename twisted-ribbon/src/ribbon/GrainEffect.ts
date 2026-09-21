import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Final-pass dither + film grain.
 *
 * Both are a pure function of (pixel, frame). No Math.random, no accumulation —
 * Remotion renders frames out of order on separate threads, so anything that
 * carries state between frames produces a different image per thread.
 *
 * `uFrame` is fed `frame % durationInFrames`, which makes the grain periodic
 * over the loop: frame 300 gets frame 0's grain exactly.
 */
const fragment = /* glsl */ `
uniform float uFrame;
uniform float uGrain;
uniform float uDither;

// Integer-ish hash. Stable for a given driver, which is all determinism needs
// here since every frame of a render runs on the same machine.
float hash13(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 4x4 ordered Bayer, returns -0.5..0.5
float bayer4(vec2 p) {
  vec2 c = mod(floor(p), 4.0);
  int i = int(c.x) + int(c.y) * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  float v = 0.0;
  for (int k = 0; k < 16; k++) { if (k == i) v = m[k]; }
  return v / 16.0 - 0.46875;
}

// The effect chain runs in LINEAR space and postprocessing converts to sRGB in
// the final write. Grain and dither are display-referred quantities — "2% grain"
// and "one 8-bit step" only mean anything after the transfer curve. Adding them
// linearly makes them vanish in the highlights and explode in the shadows: on
// the dark version's near-black backdrop a linear 1/255 is a ~30% swing, which
// reads as heavy colour noise rather than grain. So convert, perturb, convert
// back, and let the final pass encode as usual.
vec3 linToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 srgbToLin(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;

  // Triangular-PDF noise: two uniform draws summed. Zero mean, no DC shift, and
  // a much less "crunchy" texture than a single uniform draw.
  float n1 = hash13(vec3(px, uFrame * 1.7 + 0.5));
  float n2 = hash13(vec3(px + vec2(37.0, 17.0), uFrame * 1.7 + 91.3));
  float tri = n1 + n2 - 1.0;

  // Ordered dither breaks the 8-bit quantisation steps that a 4K near-white
  // gradient would otherwise show as contours.
  float d = bayer4(px) * uDither / 255.0;

  vec3 c = linToSrgb(inputColor.rgb) + tri * uGrain + d;
  outputColor = vec4(srgbToLin(c), inputColor.a);
}
`;

export class GrainEffect extends Effect {
  constructor({ grain = 0.018, dither = 0.5 } = {}) {
    super('GrainEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uFrame', new Uniform(0)],
        ['uGrain', new Uniform(grain)],
        ['uDither', new Uniform(dither)],
      ]),
    });
  }

  setFrame(frame: number) {
    (this.uniforms.get('uFrame') as Uniform).value = frame;
  }
}
