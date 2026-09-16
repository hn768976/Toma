/**
 * Builds the whole shot: substrate, routed nets, the package, and the
 * post chain. Everything is parameterised by a single normalised `progress`
 * (0 at the first frame, 1 one frame past the last) and every animated term is
 * periodic in it, so the clip loops seamlessly.
 */

import {
  ACESFilmicToneMapping,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  PostProcessing,
  Scene,
  CylinderGeometry,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  float,
  length,
  oneMinus,
  pass,
  screenUV,
  smoothstep,
  vec2,
  vec3,
} from "three/tsl";
import {
  BOARD_EXTENT,
  CHIP_CORNER_RADIUS,
  CHIP_HEIGHT,
  CHIP_SIZE,
  TRACE_Y,
} from "./constants";
import { createRng } from "./rng";
import { buildTraceNetwork } from "./traceNetwork";
import { buildTraceGeometry } from "./traceGeometry";
import { createChipLidTexture, createSubstrateTexture } from "./textures";
import {
  createBoardMaterial,
  createChipBodyMaterial,
  createChipShadowMaterial,
  createChipLidMaterial,
  createHazeMaterial,
  createTraceMaterial,
} from "./materials";
import type { Presentation } from "./gpu/presentation";

const TAU = Math.PI * 2;

/**
 * A closed Lissajous orbit. Yaw, distance, height and the look-at point each
 * peak at a different phase, so the camera never appears to stop and reverse
 * even though every channel is a sine that returns to where it started.
 */
const CAMERA = {
  fov: 34,
  yaw: 0.62,
  yawSwing: 0.4,
  yawWobble: 0.13,
  radius: 9.6,
  radiusSwing: 1.5,
  height: 3.6,
  heightSwing: 0.62,
  roll: 0.035,
};

export type SceneHandle = {
  /** Renders one frame at a normalised position in the loop. */
  renderFrame: (progress: number) => Promise<void>;
  dispose: () => void;
};

export type SceneOptions = {
  width: number;
  height: number;
  device: GPUDevice;
  presentation: Presentation;
  seed: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  /** Texture detail scales with output resolution. */
  textureSize: number;
  samples: number;
};

const _target = new Vector3();

/**
 * Places the camera and returns the yaw the package should take.
 *
 * The lid lettering lies flat on the board, so it only reads upright while its
 * "up" edge points away from the viewer. Turning the package to follow the
 * camera keeps the label legible and the body square-on for the whole orbit,
 * which is how the reference plate holds its chip. The package is a rounded
 * square, so the turn itself is invisible.
 */
const positionCamera = (camera: PerspectiveCamera, progress: number) => {
  const angle = TAU * progress;

  const yaw =
    CAMERA.yaw +
    CAMERA.yawSwing * Math.sin(angle) +
    CAMERA.yawWobble * Math.sin(angle * 2 + 1.3);
  const radius = CAMERA.radius + CAMERA.radiusSwing * Math.cos(angle + 0.6);
  const height = CAMERA.height + CAMERA.heightSwing * Math.sin(angle + 2.1);

  camera.position.set(Math.cos(yaw) * radius, height, Math.sin(yaw) * radius);

  _target.set(
    0.22 * Math.sin(angle + 2.6),
    0.16 + 0.03 * Math.sin(angle + 1.0),
    0.2 * Math.cos(angle + 1.1),
  );

  const roll = CAMERA.roll * Math.sin(angle + 0.35);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(_target);

  return Math.atan2(
    camera.position.x - _target.x,
    camera.position.z - _target.z,
  );
};

export const createScene = async (
  options: SceneOptions,
): Promise<SceneHandle> => {
  const { presentation, device } = options;

  const renderer = new WebGPURenderer({
    canvas: presentation.canvas,
    context: presentation.context,
    device,
    antialias: options.samples > 0,
    alpha: false,
  });

  renderer.setPixelRatio(1);
  renderer.setSize(options.width, options.height, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  await renderer.init();

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    CAMERA.fov,
    options.width / options.height,
    0.1,
    260,
  );

  // --- substrate ------------------------------------------------------
  const substrate = createSubstrateTexture(options.textureSize, options.seed);
  const board = new Mesh(
    new PlaneGeometry(BOARD_EXTENT * 2, BOARD_EXTENT * 2, 1, 1),
    createBoardMaterial(substrate),
  );
  board.rotation.x = -Math.PI / 2;
  board.renderOrder = 0;
  scene.add(board);

  // --- routed nets ----------------------------------------------------
  const rng = createRng(options.seed);
  const routes = buildTraceNetwork(rng, {
    maxRadius: BOARD_EXTENT * 0.72,
    maxSteps: 110,
    branchChance: 0.58,
    maxDepth: 5,
  });

  const traceMaterial = createTraceMaterial();
  const traces = new Mesh(buildTraceGeometry(routes), traceMaterial.material);
  traces.frustumCulled = false;
  traces.renderOrder = 1;
  scene.add(traces);

  // --- package --------------------------------------------------------
  const chip = new Group();

  const body = new Mesh(
    new RoundedBoxGeometry(
      CHIP_SIZE,
      CHIP_HEIGHT,
      CHIP_SIZE,
      4,
      CHIP_CORNER_RADIUS,
    ),
    createChipBodyMaterial(),
  );
  body.position.y = CHIP_HEIGHT / 2;
  chip.add(body);

  const lidSize = CHIP_SIZE - CHIP_CORNER_RADIUS * 2 - 0.02;
  const lid = new Mesh(
    new PlaneGeometry(lidSize, lidSize),
    createChipLidMaterial(
      createChipLidTexture(Math.min(1024, options.textureSize)),
    ),
  );
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = CHIP_HEIGHT + 0.0015;
  lid.renderOrder = 3;
  chip.add(lid);

  scene.add(chip);

  const shadow = new Mesh(new PlaneGeometry(6, 6), createChipShadowMaterial());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = TRACE_Y + 0.004;
  shadow.renderOrder = 2;
  scene.add(shadow);

  // --- atmosphere -----------------------------------------------------
  const haze = new Mesh(
    new CylinderGeometry(30, 30, 5.5, 48, 1, true),
    createHazeMaterial(),
  );
  haze.position.y = 2.4;
  haze.renderOrder = 4;
  scene.add(haze);

  // --- post -----------------------------------------------------------
  const scenePass = pass(scene, camera, { samples: options.samples });
  const scenePassColour = scenePass.getTextureNode("output");
  const bloomPass = bloom(
    scenePassColour,
    options.bloomStrength,
    options.bloomRadius,
    options.bloomThreshold,
  );

  const offset = screenUV.sub(vec2(0.5, 0.5));
  const vignette = oneMinus(
    smoothstep(float(0.26), float(0.86), length(offset)).mul(0.85),
  );

  const postProcessing = new PostProcessing(renderer);
  postProcessing.outputNode = scenePassColour
    .add(bloomPass)
    .mul(vignette)
    // A touch of cool lift keeps the black substrate from clipping to pure 0.
    .add(vec3(0.004, 0.008, 0.018));

  const renderFrame = async (progress: number) => {
    traceMaterial.progress.value = progress;
    chip.rotation.y = positionCamera(camera, progress);
    camera.updateMatrixWorld();

    await postProcessing.renderAsync();
    await presentation.present();
  };

  const dispose = () => {
    renderer.dispose();
    presentation.dispose();
  };

  return { renderFrame, dispose };
};
