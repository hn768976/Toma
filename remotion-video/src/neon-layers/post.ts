import * as THREE from "three/webgpu";
import { texture } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type { Theme } from "./themes";

export type RenderPipeline = {
  /** Renders the scene and its bloom composite into `output`. */
  render: (output: THREE.RenderTarget) => void;
  dispose: () => void;
};

/**
 * Scene render plus bloom composite.
 *
 * The scene goes into a half-float target of our own rather than a `pass()`
 * node. Both `PassNode` and `BloomNode` refresh themselves from `updateBefore`,
 * and when the bloom is driven straight off a pass the bloom updates first and
 * high-passes a texture the scene has not been drawn into yet — the composite
 * still shows the scene, so the only symptom is that the glow silently
 * disappears. Rendering the scene explicitly first makes the order explicit.
 *
 * Half-float matters too: the seams are emissive well past 1.0, and that
 * headroom is what lets the bloom threshold pick out the hot line and leave the
 * matte faces alone.
 *
 * `outputColorTransform` stays off because the output target is an sRGB format
 * and the GPU applies the transfer function on write; encoding in the shader as
 * well would apply it twice.
 */
export const createRenderPipeline = (
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  theme: Theme,
  width: number,
  height: number,
  samples: number,
): RenderPipeline => {
  const sceneTarget = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
    samples,
  });

  const sceneColor = texture(sceneTarget.texture);
  const pipeline = new THREE.PostProcessing(renderer);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = sceneColor.add(
    bloom(
      sceneColor,
      theme.bloomStrength,
      theme.bloomRadius,
      theme.bloomThreshold,
    ),
  );

  return {
    render: (output) => {
      renderer.setRenderTarget(sceneTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(output);
      pipeline.render();
    },
    dispose: () => {
      sceneTarget.dispose();
      pipeline.dispose();
    },
  };
};
