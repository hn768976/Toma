/**
 * Builds the whole shot: substrate, routed nets, the package, and the post
 * chain. Everything is parameterised by a single normalised `progress` that
 * runs 0 at the first frame to 1 at the last. The camera makes one continuous
 * pass over that range — it trucks left and cranes up, ending on the package
 * with its lettering readable — so the clip plays once and does not loop.
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

/**
 * A one-way move, not an orbit: the camera trucks left and cranes up over the
 * whole 20 seconds and ends on the package seen from above, with the lettering
 * fully readable. Increasing azimuth walks the camera along its own left.
 */
const CAMERA = {
  fov: 34,
  startAzimuth: 0.3,
  azimuthSweep: 0.36,
  startRadius: 11.0,
  endRadius: 8.6,
  startHeight: 2.6,
  endHeight: 6.0,
  targetHeight: 0.18,
};

export type SceneHandle = {
  /** Renders one frame at a normalised position in the shot. */
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
const _position = new Vector3();

const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * Eased, but never fully stopped: half linear, half smoothstep. A pure
 * smoothstep would park the move at both ends, which on a 20 second shot reads
 * as the camera stalling rather than drifting.
 */
const ease = (progress: number) => {
  const smooth = progress * progress * (3 - 2 * progress);
  return 0.5 * progress + 0.5 * smooth;
};

/**
 * A single continuous move: the camera trucks left and cranes up.
 *
 * It starts low and wide, where the lid is edge-on and the lettering is barely
 * a sliver, then rises until the package is seen from high enough to read the
 * word in full. Increasing the azimuth walks the camera along its own left,
 * so the board sweeps right underneath it as it climbs.
 */
const cameraAt = (progress: number, position: Vector3, target: Vector3) => {
  const t = ease(progress);

  const azimuth = CAMERA.startAzimuth + CAMERA.azimuthSweep * t;
  const radius = mix(CAMERA.startRadius, CAMERA.endRadius, t);
  const height = mix(CAMERA.startHeight, CAMERA.endHeight, t);

  position.set(Math.cos(azimuth) * radius, height, Math.sin(azimuth) * radius);
  target.set(0, CAMERA.targetHeight, 0);
};

const positionCamera = (camera: PerspectiveCamera, progress: number) => {
  cameraAt(progress, _position, _target);
  camera.position.copy(_position);
  camera.up.set(0, 1, 0);
  camera.lookAt(_target);
};

/**
 * The yaw to lock the package at.
 *
 * The lettering lies flat on the board, so it only reads upright while its top
 * edge points away from the viewer. The package does not turn during the shot,
 * so it is aligned to where the camera ends up — the frame the move exists to
 * arrive at. Earlier on, the lid is steeply foreshortened and the small
 * residual rotation is not readable.
 */
const restingChipYaw = () => {
  const position = new Vector3();
  const target = new Vector3();
  cameraAt(1, position, target);

  return Math.atan2(position.x - target.x, position.z - target.z);
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

  // The package is fixed for the whole shot; only the camera moves.
  chip.rotation.y = restingChipYaw();
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
    positionCamera(camera, progress);
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
