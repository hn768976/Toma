import { Container, RenderTexture, Texture, BufferImageSource } from "pixi.js";
import { blueNoiseRGBA, BLUE_NOISE_SIZE } from "../bluenoise";
import { fullscreenMesh, GLSL_HEADER, GLSL_NOISE } from "./helpers";
import type { PixiCtx } from "./PixiCanvas";

export type PostOptions = {
  /** Grain amplitude (fraction of full scale), ~0.015. */
  grain: number;
  /** Fade grain to zero below ~3% luminance (dark looks). */
  darkFade: boolean;
  /** Fixed blue-noise dither amplitude in 1/255 steps (0 = off). */
  blueNoise: number;
  /** Optional vignette strength. */
  vignette?: number;
  /** Scene is linear light: encode to sRGB before dithering. */
  linear?: boolean;
};

const FRAG = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uScene;
uniform sampler2D uBlue;
uniform float uFrame;
uniform float uGrain;
uniform float uDarkFade;
uniform float uBlueAmt;
uniform float uVignette;
uniform vec2 uBlueScale;
uniform float uLinear;
${GLSL_NOISE}
void main() {
  vec3 c = texture(uScene, vUV).rgb;
  c = max(c, 0.0);
  if (uVignette > 0.0) {
    vec2 d = vUV - 0.5; d.x *= 1.7778;
    c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(d));
  }
  if (uLinear > 0.5) c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  ivec2 px = ivec2(gl_FragCoord.xy);
  int f = int(mod(uFrame, 600.0));
  // Film grain: fixed formula of pixel position and (frame % 600).
  float g = (hash3i(ivec3(px, f)) + hash3i(ivec3(px + 4099, f + 811)) - 1.0);
  float fade = mix(1.0, smoothstep(0.012, 0.03, lum), uDarkFade);
  c += g * uGrain * fade;
  // Fixed blue-noise dither (does not move with the frame).
  float bn = texture(uBlue, gl_FragCoord.xy * uBlueScale).r - 0.5;
  c += bn * uBlueAmt / 255.0;
  // Final +-1/255 triangular dither.
  float d = hash3i(ivec3(px, f + 1201)) - hash3i(ivec3(px + 7919, f + 3301));
  c += d / 255.0;
  finalColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export const createPostPass = (ctx: PixiCtx, scene: RenderTexture, opts: PostOptions) => {
  const blue = new Texture({
    source: new BufferImageSource({
      resource: blueNoiseRGBA(),
      width: BLUE_NOISE_SIZE,
      height: BLUE_NOISE_SIZE,
      format: "rgba8unorm",
    }),
  });
  blue.source.style.addressMode = "repeat";
  blue.source.style.scaleMode = "nearest";
  const m = fullscreenMesh(
    ctx.W,
    ctx.H,
    FRAG,
    {
      uFrame: { value: 0, type: "f32" },
      uGrain: { value: opts.grain, type: "f32" },
      uDarkFade: { value: opts.darkFade ? 1 : 0, type: "f32" },
      uBlueAmt: { value: opts.blueNoise, type: "f32" },
      uVignette: { value: opts.vignette ?? 0, type: "f32" },
      uLinear: { value: opts.linear ? 1 : 0, type: "f32" },
      uBlueScale: { value: [1 / BLUE_NOISE_SIZE, 1 / BLUE_NOISE_SIZE], type: "vec2<f32>" },
    },
    { uScene: scene.source, uBlue: blue.source },
    "post",
  );
  const container = new Container();
  container.addChild(m.mesh);
  return {
    container,
    update: (frame: number) => {
      m.u.uFrame = frame;
    },
  };
};
