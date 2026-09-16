// three.js WebGPU engine driving the blockchain scene.
//
// Rendering is fully frame-driven: nothing reads a clock, so any frame
// can be rendered in isolation and in any order. That is a hard
// requirement for Remotion, which renders frames out of order across
// several browser tabs at once.

import * as THREE from "three/webgpu";
import {
  pass,
  screenUV,
  vec4,
  vec2,
  vec3,
  float,
  fract,
  Fn,
  smoothstep,
  uv,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  BACKGROUND_COLOR,
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  CHAIN_SPEED,
  DURATION_IN_FRAMES,
  type Layout,
} from "./constants";
import { layoutConfig } from "./layouts";
import { createCubeChain } from "./scene/cubeChain";
import { createDataField } from "./scene/dataField";

// Multisampling on the offscreen target. Cube edges are thin and
// high-contrast, so they alias badly without it.
const MSAA_SAMPLES = 4;

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  layout: Layout;
  seed: number;
  resolutionScale: number;
  depthOfField: boolean;
};

export type Engine = {
  renderFrame: (frame: number) => Promise<void>;
  dispose: () => void;
  backend: string;
};

export const createEngine = async ({
  canvas,
  width,
  height,
  layout,
  seed,
  resolutionScale,
  depthOfField,
}: EngineOptions): Promise<Engine> => {
  const config = layoutConfig(layout);

  // The renderer owns its own detached canvas and never presents to
  // one. See `outputTarget` below for why.
  const gpuCanvas = document.createElement("canvas");
  gpuCanvas.width = width;
  gpuCanvas.height = height;

  const renderer = new THREE.WebGPURenderer({
    canvas: gpuCanvas,
    antialias: true,
    alpha: false,
    // Fall back to the WebGL2 backend if no WebGPU adapter is
    // available, so the project still renders on machines (and CI
    // images) without one.
    forceWebGL: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(new THREE.Color(BACKGROUND_COLOR), 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  await renderer.init();

  // --- Why we never render to a canvas swap chain --------------------
  // Presenting WebGPU to a canvas needs a shared-image backing that
  // headless Chromium on a software (SwiftShader) adapter cannot
  // allocate: configuring the context tears down the whole Dawn
  // instance, taking the device with it. Rendering into an ordinary
  // offscreen RenderTarget and blitting the read-back pixels into a 2D
  // canvas sidesteps presentation completely. It costs one readback
  // per frame, which is irrelevant for offline rendering, and it
  // behaves identically on the WebGPU and WebGL2 backends and on
  // machines that do have a real GPU -- so it is the only path, rather
  // than a fallback that would other­wise go untested.
  const outputTarget = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
    samples: MSAA_SAMPLES,
  });
  renderer.setOutputRenderTarget(outputTarget);

  const blit = canvas.getContext("2d", { alpha: false });
  if (!blit) throw new Error("2D canvas context unavailable for blit");
  const imageData = blit.createImageData(width, height);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  const camera = new THREE.PerspectiveCamera(
    config.camera(0).fov,
    width / height,
    0.1,
    240,
  );

  const chain = createCubeChain(config, seed, resolutionScale);
  const field = createDataField(config, seed + 9001, resolutionScale);
  scene.add(chain.group);
  scene.add(field.group);

  // --- Post-processing ---------------------------------------------
  const postProcessing = new THREE.PostProcessing(renderer);
  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode("output");

  // three's TSL addon nodes (bloom) are declared as plain classes
  // rather than as vec4 node objects, so TypeScript can't see the
  // .add/.rgb/.mul operator surface they actually carry at runtime.
  // Re-assert it here rather than sprinkling casts through the graph.
  type Vec4Node = ReturnType<typeof vec4>;
  const asVec4 = (node: unknown) => node as Vec4Node;

  // --- Depth of field ------------------------------------------------
  // Hand-rolled rather than three's DepthOfFieldNode: that one runs an
  // 80-tap two-pass bokeh through half-float MRT render targets, which
  // is both far more than this look needs and unreliable on the
  // SwiftShader backend. A single-pass golden-angle gather, with the
  // radius driven by circle-of-confusion, gives the reference's soft
  // fall-off at a fraction of the cost and with no extra targets.
  //
  // The tap pattern is rotated by a per-pixel hash. Without it the
  // scene's many small bright points each smear into 24 discrete
  // copies and the defocused areas fill with star shapes; rotating
  // turns that structure into fine noise, which reads as grain.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const DOF_TAPS = 24;

  const focusDistance = float(config.focusDistance);
  const focalLength = float(config.focalLength);
  // Bokeh is measured in pixels, so it has to scale with the output
  // resolution or 4K would come out twice as sharp as 1080p.
  const bokehPixels = float(config.bokeh * resolutionScale);
  const texel = vec2(1 / width, 1 / height);

  type Vec3Node = ReturnType<typeof vec3>;
  const asVec3 = (node: unknown) => node as Vec3Node;

  const defocused = Fn(() => {
    // viewZ is negative in front of the camera.
    const distance = scenePass.getViewZNode().negate();
    const coc = smoothstep(
      float(0),
      focalLength,
      distance.sub(focusDistance).abs(),
    );
    const radius = coc.mul(bokehPixels);

    const hash = fract(
      uv().dot(vec2(12.9898, 78.233)).sin().mul(43758.5453),
    ).mul(Math.PI * 2);
    const rotCos = hash.cos();
    const rotSin = hash.sin();

    // Unrolled in JS: the tap count is a compile-time constant, so this
    // builds a straight-line node graph with no loop node.
    let accumulated = asVec3(vec3(0, 0, 0));
    for (let i = 0; i < DOF_TAPS; i++) {
      const theta = i * GOLDEN_ANGLE;
      const r = Math.sqrt((i + 0.5) / DOF_TAPS);
      const ox = Math.cos(theta) * r;
      const oy = Math.sin(theta) * r;
      const offset = vec2(
        rotCos.mul(ox).sub(rotSin.mul(oy)),
        rotSin.mul(ox).add(rotCos.mul(oy)),
      );
      accumulated = asVec3(
        accumulated.add(
          sceneColor.sample(uv().add(offset.mul(texel).mul(radius))).rgb,
        ),
      );
    }
    return accumulated.div(DOF_TAPS);
  });

  const composite = depthOfField
    ? asVec4(vec4(defocused(), 1))
    : asVec4(sceneColor);

  const bloomPass = asVec4(
    bloom(composite, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD),
  );

  // Gentle vignette, matching the reference's falloff into the corners.
  const centred = screenUV.sub(0.5);
  const vignette = float(1).sub(centred.dot(centred).mul(1.85)).clamp(0, 1);

  postProcessing.outputNode = vec4(
    composite.add(bloomPass).rgb.mul(vignette),
    1,
  );

  const renderFrame = async (frame: number) => {
    const progress = frame / DURATION_IN_FRAMES;
    const flow = frame * CHAIN_SPEED;

    const state = config.camera(progress);
    camera.position.copy(state.position);
    camera.lookAt(state.target);
    if (camera.fov !== state.fov) {
      camera.fov = state.fov;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    chain.update(flow, camera.position);
    field.update(frame, flow, camera.quaternion, camera.position);

    await postProcessing.renderAsync();

    const pixels = (await renderer.readRenderTargetPixelsAsync(
      outputTarget,
      0,
      0,
      width,
      height,
    )) as unknown as ArrayBufferView;
    const src = new Uint8Array(
      pixels.buffer,
      pixels.byteOffset,
      width * height * 4,
    );

    // three's WebGPU backend hands back rows top-down already, which
    // is the same order ImageData expects -- no flip needed here
    // (the WebGL backend's bottom-up convention does not apply).
    imageData.data.set(src);
    blit.putImageData(imageData, 0, 0);
  };

  const dispose = () => {
    chain.dispose();
    field.dispose();
    postProcessing.dispose();
    outputTarget.dispose();
    renderer.dispose();
  };

  return {
    renderFrame,
    dispose,
    backend: (renderer.backend as { isWebGPUBackend?: boolean })?.isWebGPUBackend
      ? "webgpu"
      : "webgl2",
  };
};
