// Assembles the whole look: background, the gyri field, the bokeh volume,
// a slow camera truck, and a bloom/vignette/grain finish.
//
// Deliberately renderer-agnostic beyond needing a WebGPURenderer instance for
// the post-processing chain — nothing here touches React or Remotion, so the
// scene can be driven frame-by-frame by Remotion or interactively in a test
// harness with the same code.

import * as THREE from "three/webgpu";
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  pass,
  screenUV,
  mix,
  smoothstep,
  length,
  clamp,
  mx_cell_noise_float,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

import {
  BOKEH_COUNT,
  CAMERA_FOV,
  CAMERA_Z,
  FIELD_SEGMENTS_X,
  FIELD_SEGMENTS_Y,
  FIELD_Z,
  LOOP_PERIOD,
} from "./constants";
import { createRidgeField } from "./ridgeField";
import { createBokehField } from "./bokehField";
import type { Palette } from "./palettes";

const srgb = (hex: string) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

export type SceneOptions = {
  renderer: THREE.WebGPURenderer;
  width: number;
  height: number;
  palette: Palette;
  /** +1 = dense side on the left (reference), -1 = mirrored. */
  mirror: 1 | -1;
  /**
   * 1 at 1080p, 2 at 4K. Particle counts and mesh density scale with it so the
   * 4K composition is the same picture at more samples, not a sparser one.
   */
  resolutionScale: number;
  seed: number;
  bloomEnabled: boolean;
};

export type NeuralFieldScene = {
  /** Draws one frame into `target`. Never renders to screen — see presenter.ts. */
  render: (timeSeconds: number, target: THREE.RenderTarget) => void;
  dispose: () => void;
};

export const createNeuralFieldScene = ({
  renderer,
  width,
  height,
  palette,
  mirror,
  resolutionScale,
  seed,
  bloomEnabled,
}: SceneOptions): NeuralFieldScene => {
  const aspect = width / height;
  const tanHalfFov = Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));

  const scene = new THREE.Scene();
  scene.background = srgb(palette.background);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 120);
  camera.position.set(0, 0, CAMERA_Z);

  // Size the field plane so it covers the frustum at its depth with enough
  // margin for the camera truck and the vertex displacement.
  const fieldHeight = 2 * tanHalfFov * (CAMERA_Z - FIELD_Z) * 1.32;
  const fieldWidth = fieldHeight * aspect;

  const ridge = createRidgeField({
    palette,
    mirror,
    width: fieldWidth,
    height: fieldHeight,
    segmentsX: Math.round(FIELD_SEGMENTS_X * resolutionScale),
    segmentsY: Math.round(FIELD_SEGMENTS_Y * resolutionScale),
    loopPeriod: LOOP_PERIOD,
  });
  ridge.mesh.position.z = FIELD_Z;
  scene.add(ridge.mesh);

  const bokeh = createBokehField({
    palette,
    mirror,
    // Particle count tracks pixel count so density per screen area is constant.
    count: Math.round(BOKEH_COUNT * resolutionScale * resolutionScale),
    aspect,
    seed,
    loopPeriod: LOOP_PERIOD,
  });
  scene.add(bokeh.mesh);

  // --- post processing ----------------------------------------------------
  const uGrainSeed = uniform(0);
  const uAspect = uniform(aspect);

  const scenePass = pass(scene, camera);

  const composited = bloomEnabled
    ? scenePass.add(bloom(scenePass, 0.95, 0.85, 0.2))
    : scenePass;

  const graded = Fn(() => {
    const rgb = composited.rgb.toVar();

    // Vignette, weighted by aspect so it stays circular rather than oval.
    const centred = screenUV.sub(0.5).mul(vec2(uAspect.mul(0.86), 1.0));
    const vignette = smoothstep(1.02, 0.28, length(centred));
    rgb.mulAssign(mix(float(0.62), float(1.0), vignette));

    // Fine grain. Keeps large flat areas of the background from banding, which
    // is very visible on a dark gradient at 8-bit.
    const grain = mx_cell_noise_float(
      vec3(screenUV.mul(vec2(width, height)).mul(0.5), uGrainSeed),
    )
      .sub(0.5)
      .mul(0.012);
    rgb.addAssign(vec3(grain));

    return vec4(clamp(rgb, 0.0, 1.0), 1.0);
  });

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = graded();

  return {
    render: (timeSeconds: number, target: THREE.RenderTarget) => {
      const theta = (timeSeconds / LOOP_PERIOD) * Math.PI * 2;

      // Slow circular truck. Parallaxes the bokeh against the field and, being
      // a closed circle, returns to frame 0 exactly.
      camera.position.x = Math.cos(theta) * 0.38 * mirror;
      camera.position.y = Math.sin(theta) * 0.24;
      camera.position.z = CAMERA_Z + Math.sin(theta * 2) * 0.22;
      camera.updateMatrixWorld();

      ridge.update(timeSeconds);
      bokeh.update(timeSeconds);
      uGrainSeed.value = timeSeconds * 60.0;

      renderer.setRenderTarget(target);
      pipeline.render();
      renderer.setRenderTarget(null);
    },
    dispose: () => {
      ridge.dispose();
      bokeh.dispose();
      pipeline.dispose();
    },
  };
};
