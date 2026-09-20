import * as THREE from "three";
import { autoDetectRenderer, type Renderer as PixiRenderer } from "pixi.js";
import { resolveTier, type RendererTier, type TierPreference } from "./caps";

/**
 * A backend-agnostic render surface.
 *
 * three.js exposes two different renderer classes with two different call
 * shapes (WebGPU's is async), so the scene talks to this wrapper instead and
 * never learns which backend it got.
 */
export type Backend = {
  tier: RendererTier;
  canvas: HTMLCanvasElement;
  /** Pixi renderer, shared between texture baking and the post pass. */
  pixi: PixiRenderer;
  render: (scene: THREE.Scene, camera: THREE.Camera) => Promise<void>;
  setSize: (w: number, h: number) => void;
  three: THREE.WebGLRenderer | THREE.Object3D | unknown;
  dispose: () => void;
};

type WebGPUModule = typeof import("three/webgpu");

const configure = (
  r: { toneMapping: THREE.ToneMapping; toneMappingExposure: number; outputColorSpace: string },
  toneMapping: THREE.ToneMapping,
  exposure: number,
) => {
  r.toneMapping = toneMapping;
  r.toneMappingExposure = exposure;
  r.outputColorSpace = THREE.SRGBColorSpace;
};

export const createBackend = async (opts: {
  canvas: HTMLCanvasElement;
  pixiCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  preference: TierPreference;
  toneMapping: THREE.ToneMapping;
  exposure: number;
}): Promise<Backend> => {
  const tier = await resolveTier(opts.preference);

  const pixi = (await autoDetectRenderer({
    canvas: opts.pixiCanvas,
    width: opts.width,
    height: opts.height,
    preference: tier === "webgpu" ? "webgpu" : "webgl",
    antialias: false,
    backgroundAlpha: 0,
    // Frames are grabbed by the screenshotter right after we draw, so the
    // drawing buffer has to survive past the end of the frame.
    preserveDrawingBuffer: true,
    clearBeforeRender: true,
  })) as PixiRenderer;

  if (tier === "webgpu") {
    try {
      const mod: WebGPUModule = await import("three/webgpu");
      const renderer = new mod.WebGPURenderer({
        canvas: opts.canvas,
        antialias: true,
        alpha: true,
        forceWebGL: false,
      });
      await renderer.init();
      renderer.setSize(opts.width, opts.height, false);
      configure(
        renderer as unknown as Parameters<typeof configure>[0],
        opts.toneMapping,
        opts.exposure,
      );
      return {
        tier,
        canvas: opts.canvas,
        pixi,
        three: renderer,
        render: async (scene, camera) => {
          await renderer.renderAsync(scene, camera);
        },
        setSize: (w, h) => renderer.setSize(w, h, false),
        dispose: () => {
          renderer.dispose();
          pixi.destroy();
        },
      };
    } catch (err) {
      // A WebGPU context that advertises itself and then fails to build is a
      // real situation on software GPU stacks; drop to WebGL rather than
      // failing the render.
      console.warn("[chip] WebGPU renderer unavailable, using WebGL:", err);
    }
  }

  const renderer = new THREE.WebGLRenderer({
    canvas: opts.canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(opts.width, opts.height, false);
  configure(renderer, opts.toneMapping, opts.exposure);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return {
    tier: tier === "webgpu" ? "webgl2" : tier,
    canvas: opts.canvas,
    pixi,
    three: renderer,
    render: async (scene, camera) => {
      renderer.render(scene, camera);
    },
    setSize: (w, h) => renderer.setSize(w, h, false),
    dispose: () => {
      renderer.dispose();
      pixi.destroy();
    },
  };
};
