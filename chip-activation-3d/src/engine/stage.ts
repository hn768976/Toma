import * as THREE from 'three/webgpu';
import type { Theme } from '../themes';
import { buildScene, type SceneBundle } from '../scene/buildScene';

export interface StageOptions {
  /** The 2D canvas that is actually on the page — the render is blitted here. */
  canvas: HTMLCanvasElement;
  theme: Theme;
  width: number;
  height: number;
  /** Resolution of the procedural textures. Scaled with output size. */
  textureSize: number;
  /** Diagnostics: force three.js onto its WebGL2 backend. */
  forceWebGL?: boolean;
  enablePost: boolean;
  /** Diagnostics: truncate the post chain after this stage index. */
  postStopAfter?: number;
}

export interface Stage {
  renderFrame: (seconds: number) => Promise<void>;
  dispose: () => void;
  backend: string;
}

/**
 * three.js silently downgrades to its WebGL backend when WebGPU cannot start,
 * and the resulting error ("cannot read getSupportedExtensions of null") says
 * nothing useful. Check the preconditions ourselves so a misconfigured browser
 * reports *why* it has no GPU adapter.
 */
const assertWebGPU = async () => {
  const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
  if (!gpu) {
    throw new Error(
      'navigator.gpu is undefined. Chrome needs --enable-unsafe-webgpu (Remotion passes it) ' +
        'and a build new enough to expose WebGPU.',
    );
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    throw new Error(
      'navigator.gpu.requestAdapter() returned null, so there is no WebGPU adapter. ' +
        'On Linux this is usually one of: Chrome launched with --single-process or --no-zygote ' +
        '(both remove the GPU process), chrome-headless-shell (Remotion runs it with ' +
        '--headless=old, which has no GPU process either), or an OpenGL renderer whose backing ' +
        'driver is missing.',
    );
  }
  const info = (adapter as unknown as { info?: { vendor?: string; architecture?: string } }).info;
  return `${info?.vendor ?? 'unknown'}/${info?.architecture ?? 'unknown'}`;
};

/**
 * Creates the three.js WebGPU renderer, builds the scene, and returns a
 * `renderFrame(seconds)` that is a pure function of time — no wall clock, no
 * accumulated state. That is what lets Remotion render frames out of order
 * across several browser tabs and still get a coherent video.
 *
 * The frame is drawn into an offscreen WebGPU render target and then read
 * back and blitted into a 2D canvas, rather than being presented through a
 * WebGPU canvas context. That indirection is deliberate: presenting needs a
 * SharedImage backing that supports WebGPU, which headless Chrome on a
 * software rasteriser does not have ("Could not find SharedImageBackingFactory
 * ... WebgpuSwapChainTexture", followed by the GPU process dropping the
 * WebGPU instance mid-frame). Rendering to a texture sidesteps the swapchain
 * entirely, costs one readback per frame, and has the side benefit that the
 * pixels Remotion screenshots are exactly the pixels the GPU produced.
 */
export const createStage = async (opts: StageOptions): Promise<Stage> => {
  const { canvas, theme, width, height, textureSize, forceWebGL, enablePost, postStopAfter } = opts;

  let adapterInfo = 'forced-webgl';
  if (!forceWebGL) {
    adapterInfo = await assertWebGPU();
  }

  // The renderer gets its own detached canvas. Nothing is ever presented to
  // it; it exists only because WebGPURenderer wants one.
  const glCanvas = document.createElement('canvas');
  glCanvas.width = width;
  glCanvas.height = height;

  const renderer = new THREE.WebGPURenderer({
    canvas: glCanvas,
    antialias: true,
    alpha: false,
    forceWebGL: forceWebGL ?? false,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.post.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Deterministic frames only — never let three drive its own loop.
  renderer.setAnimationLoop(null);

  await renderer.init();

  const isWebGPU = Boolean(
    (renderer.backend as { isWebGPUBackend?: boolean } | undefined)?.isWebGPUBackend,
  );
  if (!forceWebGL && !isWebGPU) {
    throw new Error(
      `three.js fell back to its WebGL backend despite an available WebGPU adapter (${adapterInfo}).`,
    );
  }
  const backend = isWebGPU ? 'webgpu' : 'webgl2';

  /**
   * With post-processing the output node already applies tone mapping and the
   * sRGB transfer function in-shader, so the target must NOT be an sRGB
   * format or the encode happens twice. Without post there is no such pass,
   * so the hardware has to do it.
   */
  const target = new THREE.RenderTarget(width, height, {
    colorSpace: enablePost ? THREE.NoColorSpace : THREE.SRGBColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
    // The post chain supersedes this; only the raw path needs MSAA here.
    samples: enablePost ? 0 : 4,
  });

  let bundle: SceneBundle;
  try {
    bundle = buildScene({ theme, renderer, width, height, textureSize, enablePost, postStopAfter });
  } catch (err) {
    target.dispose();
    renderer.dispose();
    throw err;
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not get a 2D context for the output canvas');

  const image = new ImageData(width, height);
  const rowBytes = width * 4;
  const flipReadback = !isWebGPU;
  const alignedStride = Math.ceil(rowBytes / 256) * 256;

  // eslint-disable-next-line no-console
  console.log(
    `[chip-activation] backend=${backend} adapter=${adapterInfo} ` +
      `${theme.id} ${width}x${height} tex=${textureSize} post=${enablePost}`,
  );

  return {
    backend,

    renderFrame: async (seconds: number) => {
      bundle.update(seconds);

      renderer.setRenderTarget(target);
      // render() is synchronous now that the renderer has been awaited into
      // existence; renderAsync() is deprecated and its error-scope handling
      // throws "Instance dropped in popErrorScope" during teardown.
      if (bundle.post) {
        bundle.post.render();
      } else {
        renderer.render(bundle.scene, bundle.camera);
      }
      renderer.setRenderTarget(null);

      const pixels = (await renderer.readRenderTargetPixelsAsync(
        target,
        0,
        0,
        width,
        height,
      )) as Uint8Array;

      // Two backend differences to absorb here:
      //  - WebGPU's copyTextureToBuffer pads each row up to a 256-byte
      //    stride, so the buffer is wider than width*4 at some resolutions.
      //  - WebGPU hands rows back top-down; the WebGL path reads the
      //    framebuffer bottom-up.
      // WebGPU requires copyTextureToBuffer rows to start on a 256-byte
      // boundary, so at widths that are not a multiple of 64 pixels the rows
      // are padded and the buffer is *not* width*height*4. (Both delivery
      // sizes, 1920 and 3840, happen to be aligned; preview widths often are
      // not, and a wrong stride shears the image.)
      const stride = pixels.length === rowBytes * height ? rowBytes : alignedStride;
      for (let y = 0; y < height; y++) {
        const srcRow = flipReadback ? height - 1 - y : y;
        const src = srcRow * stride;
        image.data.set(pixels.subarray(src, src + rowBytes), y * rowBytes);
      }
      ctx.putImageData(image, 0, 0);
    },

    dispose: () => {
      bundle.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
};
