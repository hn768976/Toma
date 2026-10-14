import {
  autoDetectRenderer,
  BufferImageSource,
  Container,
  RenderTexture,
  Texture,
  type Renderer,
} from "pixi.js";
import { fullscreenMesh, GLSL_COMMON } from "./gl";
import { BLUE_NOISE_B64, BLUE_NOISE_SIZE } from "./bluenoise";

export interface LookCtx {
  renderer: Renderer;
  /** Composition size (layout units; 3840x2160). */
  width: number;
  height: number;
  /** Device pixels per layout unit (1/3 for 720p previews, 1 for 4K). */
  resolution: number;
  fps: number;
}

export interface Look {
  scene: Container;
  /** Pose the scene for `frame`. Must depend on `frame` only. */
  update(frame: number): void;
}

export type LookBuilder<P> = (ctx: LookCtx, params: P) => Look | Promise<Look>;

export interface StageOptions {
  /** Overlay looks: no grain/dither where the frame is black. */
  overlay: boolean;
  /** For seamless loops: grain and dither repeat with this period. */
  loopFrames?: number;
  /** Film grain amplitude (fraction of full scale). */
  grain?: number;
}

// Final pass: half-float scene -> 8-bit canvas, with TPDF blue-noise dither and
// film grain. Both are pure functions of (pixel, frame). In overlays both are
// gated off below ~3% light so black stays exactly (0,0,0).
const POST_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uScene;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uFrame;
uniform float uOverlay;
uniform float uGrain;
uniform vec2 uOff;
${GLSL_COMMON}
float bn(ivec2 p) { return texelFetch(uNoise, p & ${BLUE_NOISE_SIZE - 1}, 0).r; }
void main() {
  ivec2 px = ivec2(floor(vUV * uRes));
  vec3 c = max(texture(uScene, vUV).rgb, 0.0);
  float mx = max(c.r, max(c.g, c.b));
  // "Light level": luminance, but saturated blues/violets count by their peak channel.
  float level = max(luma(c), 0.35 * mx);
  float gate = 1.0;
  if (uOverlay > 0.5) {
    gate = smoothstep(0.012, 0.03, level);
    // Kill sub-LSB glow tails so black really is black.
    c *= smoothstep(0.0015, 0.006, mx);
  }
  // Film grain: monochrome, triangular PDF, from pixel position and frame.
  uint h = hashu(uvec3(uvec2(px), uint(uFrame) + 7u));
  float g = (float(h & 0xffffu) + float(h >> 16u)) / 65535.0 - 1.0;
  // Blue-noise TPDF dither, a different tile offset per channel.
  ivec2 o = ivec2(uOff);
  vec3 d = vec3(
    bn(px + o) + bn(px + o + ivec2(19, 41)) ,
    bn(px + o + ivec2(37, 11)) + bn(px + o + ivec2(5, 29)),
    bn(px + o + ivec2(13, 53)) + bn(px + o + ivec2(47, 23))) - 1.0;
  c += (g * uGrain + d / 255.0) * gate;
  finalColor = vec4(sat3(c), 1.0);
}`;

const decodeNoise = () => {
  const bin = atob(BLUE_NOISE_B64);
  const n = BLUE_NOISE_SIZE * BLUE_NOISE_SIZE;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = bin.charCodeAt(i);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return data;
};

export interface Stage {
  render(frame: number): void;
  destroy(): void;
  info: string;
}

export const createStage = async <P>(
  canvas: HTMLCanvasElement,
  size: { width: number; height: number; resolution: number; fps: number },
  build: LookBuilder<P>,
  params: P,
  opts: StageOptions,
): Promise<Stage> => {
  const { width, height, resolution, fps } = size;
  const renderer = await autoDetectRenderer({
    preference: "webgl",
    canvas,
    width,
    height,
    resolution,
    autoDensity: false,
    antialias: false,
    preserveDrawingBuffer: true,
    background: 0x000000,
    backgroundAlpha: 1,
    powerPreference: "high-performance",
    hello: false,
  });
  const gl = (renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
  if (!gl || typeof WebGL2RenderingContext === "undefined" || !(gl instanceof WebGL2RenderingContext)) {
    throw new Error("WebGL2 is required (render with --gl=angle).");
  }
  const halfFloat = !!gl.getExtension("EXT_color_buffer_float") || !!gl.getExtension("EXT_color_buffer_half_float");
  if (!halfFloat) throw new Error("Half-float render targets unavailable (EXT_color_buffer_float).");
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const look = await build({ renderer, width, height, resolution, fps }, params);

  const sceneRT = RenderTexture.create({
    width,
    height,
    resolution,
    format: "rgba16float",
    antialias: false,
    scaleMode: "nearest",
  });
  const noiseTex = new Texture({
    source: new BufferImageSource({
      resource: decodeNoise(),
      width: BLUE_NOISE_SIZE,
      height: BLUE_NOISE_SIZE,
      format: "rgba8unorm",
      scaleMode: "nearest",
      addressMode: "repeat",
    }),
  });
  const pxW = Math.round(width * resolution);
  const pxH = Math.round(height * resolution);
  const post = fullscreenMesh(
    width,
    height,
    POST_FRAG,
    {
      uRes: { value: new Float32Array([pxW, pxH]), type: "vec2<f32>" },
      uFrame: { value: 0, type: "f32" },
      uOverlay: { value: opts.overlay ? 1 : 0, type: "f32" },
      uGrain: { value: opts.grain ?? 0.015, type: "f32" },
      uOff: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
    },
    { uScene: sceneRT.source, uNoise: noiseTex.source },
  );
  const postStage = new Container();
  postStage.addChild(post.mesh);

  return {
    info: `${pxW}x${pxH} ${gl.getParameter(gl.VERSION)}`,
    render(frame: number) {
      look.update(frame);
      renderer.render({ container: look.scene, target: sceneRT, clear: true, clearColor: [0, 0, 0, 1] });
      // Grain/dither index: wraps with the loop so frame N == frame 0.
      const f = opts.loopFrames ? ((frame % opts.loopFrames) + opts.loopFrames) % opts.loopFrames : frame;
      post.u.uFrame = f;
      // R2 low-discrepancy offsets of the blue-noise tile per frame.
      (post.u.uOff as Float32Array)[0] = Math.floor(((0.5 + f * 0.7548776662) % 1) * BLUE_NOISE_SIZE);
      (post.u.uOff as Float32Array)[1] = Math.floor(((0.5 + f * 0.5698402909) % 1) * BLUE_NOISE_SIZE);
      renderer.render({ container: postStage, clear: true, clearColor: [0, 0, 0, 1] });
      gl.finish();
    },
    destroy() {
      renderer.destroy({ removeView: false });
    },
  };
};
