// Scene assembly and the WebGPU render loop.
//
// The whole scene is a pure function of one uniform - `loopT`, normalised
// loop time in [0, 1). Nothing integrates state between frames, which is what
// lets Remotion render frames out of order across parallel workers and still
// get a coherent result.
//
// Presentation goes through a render target rather than the canvas swap
// chain. WebGPU's swap chain needs a compositor-backed surface, which a
// headless browser does not have - presenting there tears the GPU device
// down mid-frame. Rendering into an offscreen target, reading it back and
// blitting it into a 2D canvas sidesteps that entirely, and has a second
// benefit that matters more for a frame-accurate renderer: the pixels are
// provably on the canvas before Remotion screenshots the page, with no
// reliance on compositor timing.

import {
  Color,
  LinearFilter,
  NoToneMapping,
  PerspectiveCamera,
  RGBAFormat,
  RenderPipeline,
  RenderTarget,
  SRGBColorSpace,
  Scene,
  UnsignedByteType,
  WebGPURenderer,
} from "three/webgpu";
import {
  clamp,
  float,
  length,
  mix,
  pass,
  screenUV,
  smoothstep,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  BASE_WIDTH,
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_ROLL,
  CAMERA_TARGET,
  VIGNETTE_STRENGTH,
} from "./constants";
import type { Variant } from "./constants";
import { getPalette } from "./palettes";
import { createBandSheet } from "./band-sheet";
import { createHazeSheet } from "./haze-sheet";
import { createParticleCloud } from "./particle-cloud";
import { createRibbonStrands } from "./ribbon-strands";

export type FlowRibbonSceneOptions = {
  /** Visible 2D canvas the finished frame is blitted into. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  variant: Variant;
  /** true renders the composition flipped left-to-right. */
  mirrored: boolean;
};

export type FlowRibbonScene = {
  /** Renders a single frame at normalised loop time `t` in [0, 1). */
  render: (loopT: number) => Promise<void>;
  /** Which backend three resolved to, for logging. */
  getBackend: () => "webgpu" | "webgl";
  dispose: () => void;
};

const detectWebGPU = async (): Promise<boolean> => {
  if (typeof navigator === "undefined" || typeof navigator.gpu === "undefined") {
    return false;
  }
  try {
    return (await navigator.gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
};

export const createFlowRibbonScene = async (
  options: FlowRibbonSceneOptions,
): Promise<FlowRibbonScene> => {
  const { canvas, width, height, variant, mirrored } = options;
  const palette = getPalette(variant);

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Could not acquire a 2D context for the output canvas");
  }

  const background = new Color(palette.background).convertSRGBToLinear();
  const glow = new Color(palette.backgroundGlow).convertSRGBToLinear();

  const hasWebGPU = await detectWebGPU();

  // The renderer draws into its own detached canvas; nothing is ever
  // presented through it, so its swap chain is never exercised.
  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: true,
    forceWebGL: !hasWebGPU,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  // The band is composited over the background wash in post, so the scene
  // itself is drawn on transparent black and its alpha carries the coverage.
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  await renderer.init();

  // 8-bit sRGB, matching the ImageData the frame is blitted through, so the
  // readback is a straight memcpy with no conversion.
  const target = new RenderTarget(width, height, {
    format: RGBAFormat,
    type: UnsignedByteType,
    colorSpace: SRGBColorSpace,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
  });

  const scene = new Scene();

  const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 100);
  camera.position.set(CAMERA_POSITION[0], CAMERA_POSITION[1], CAMERA_POSITION[2]);
  camera.lookAt(CAMERA_TARGET[0], CAMERA_TARGET[1], CAMERA_TARGET[2]);
  // Rolling the camera rather than the band keeps band-local space equal to
  // world space for every layer's lighting maths. The mirrored variant flips
  // the roll too, so the pair reads as a true reflection.
  camera.rotateZ(mirrored ? -CAMERA_ROLL : CAMERA_ROLL);

  const mirrorSign = mirrored ? -1 : 1;
  const loopT = uniform(0);
  const mirror = uniform(mirrorSign);

  const haze = createHazeSheet(palette, loopT, mirror);
  const sheet = createBandSheet(palette, loopT, mirror);
  const strands = createRibbonStrands(palette, loopT, mirror);
  const particles = createParticleCloud(palette, loopT, mirror);
  scene.add(haze.mesh, sheet.mesh, strands.mesh, particles.mesh);

  const scenePass = pass(scene, camera);
  const colour = scenePass.getTextureNode();
  const bloomPass = bloom(colour, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD);

  // Three rebuilds the bloom pyramid from the drawing buffer every frame, and
  // its five mip levels always span the same number of texels - so at 4K the
  // glow would cover half the screen fraction it covers at 1080p, and the two
  // compositions would not match. Pinning the pyramid to the 1080p-equivalent
  // size makes the spread resolution-independent. Nothing is lost by blurring
  // at that size: bloom is low-frequency by construction, and the sharp image
  // it is added to is still rendered at full resolution.
  const resolutionScale = width / BASE_WIDTH;
  if (resolutionScale !== 1) {
    const setSize = bloomPass.setSize.bind(bloomPass);
    bloomPass.setSize = (w: number, h: number) =>
      setSize(w / resolutionScale, h / resolutionScale);
  }

  // Background wash, in screen space. The glow sits off-centre toward the
  // side the band enters from, and mirrors along with it.
  const offset = screenUV.sub(vec3(0.5 - 0.16 * mirrorSign, 0.56, 0).xy);
  const falloff = smoothstep(
    0.62,
    0.02,
    length(vec3(offset.x, offset.y.mul(1.6), 0).xy),
  ).pow(2.6);
  const backdrop = mix(
    vec3(background.r, background.g, background.b),
    vec3(glow.r, glow.g, glow.b),
    falloff,
  );

  // The opaque strands write alpha 1 and so hide the wash behind them; the
  // additive layers deliberately leave alpha alone (see applyAdditiveBlending),
  // so the wash still reads through the haze and the particle cloud.
  const coverage = clamp(colour.a, 0, 1);
  const composited = backdrop
    .mul(float(1).sub(coverage))
    .add(colour.rgb)
    .add(bloomPass.rgb);

  const vignette = float(1).sub(
    smoothstep(0.34, 0.95, length(screenUV.sub(0.5))).mul(VIGNETTE_STRENGTH),
  );

  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = vec4(composited.mul(vignette), 1);

  // Reused across frames so a 14-second render does not churn 430 buffers.
  const pixels = new Uint8ClampedArray(width * height * 4);

  // Renders are serialised. During a batch render Remotion advances one frame
  // at a time so calls never overlap, but scrubbing in Studio can start a
  // second frame before the first has read back - and two passes interleaving
  // on one renderer would blit a frame composed of both.
  let queue: Promise<void> = Promise.resolve();

  const renderFrame = async (t: number) => {
    loopT.value = t;

    renderer.setRenderTarget(target);
      pipeline.render();
    renderer.setRenderTarget(null);

    const read = await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      width,
      height,
    );
    pixels.set(read as unknown as ArrayLike<number>);
    context.putImageData(new ImageData(pixels, width, height), 0, 0);
  };

  return {
    render: (t: number) => {
      queue = queue.then(() => renderFrame(t));
      return queue;
    },
    getBackend: () => (hasWebGPU ? "webgpu" : "webgl"),
    dispose: () => {
      haze.dispose();
      sheet.dispose();
      strands.dispose();
      particles.dispose();
      pipeline.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
};
