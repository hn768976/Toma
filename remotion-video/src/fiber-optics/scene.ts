import * as THREE from "three/webgpu";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { clamp, mix, pass, screenUV, vec2 } from "three/tsl";
import { buildBackdrop } from "./background";
import { buildCableShell } from "./cable";
import { buildFiberBundle } from "./fibers";
import type { Palette } from "./palette";
import { createBinaryTexture, createSparkleTexture } from "./textures";

const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * Where each cable's connector sits in world space, how big it is, how far its
 * axis is nudged off the shared bundle direction, and how much its brightness
 * is pulled down. Index 0 is the hero cable that fills the middle of the frame.
 *
 * `dim` is doing the job a shallow depth of field would do in a render like the
 * reference's: it pushes the cables behind the hero back so the eye lands on
 * the middle of the frame. A real bokeh pass was tried and dropped — on the
 * software GL path it intermittently renders black, which across 300 frames
 * means a ruined take, and there is no way to notice mid-render.
 */
const CABLE_LAYOUT = [
  { position: [-2.9, -0.6, 2.6], scale: 1.2, tilt: [0, 0], dim: 1.0 },
  { position: [-5.6, 2.9, -1.4], scale: 0.86, tilt: [0.05, -0.04], dim: 0.68 },
  { position: [1.6, -4.3, 1.0], scale: 0.94, tilt: [-0.04, 0.05], dim: 0.82 },
  { position: [2.6, 3.3, -6.2], scale: 0.72, tilt: [0.03, 0.03], dim: 0.5 },
  { position: [-7.4, -2.6, -9.5], scale: 0.62, tilt: [-0.05, -0.02], dim: 0.36 },
] as const;

/** Shared direction the cables point in: to the right, up, and towards camera. */
const BUNDLE_DIRECTION = new THREE.Vector3(0.912, 0.296, 0.282).normalize();

export type FiberOpticsScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Positions everything for a given point in the timeline. */
  update: (progress: number, seconds: number) => void;
  buildPostProcessing: (renderer: THREE.Renderer) => THREE.PostProcessing;
  dispose: () => void;
};

export const buildFiberOpticsScene = ({
  palette,
  aspect,
  seed = 20260916,
}: {
  palette: Palette;
  aspect: number;
  seed?: number;
}): FiberOpticsScene => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 600);

  const binaryTexture = createBinaryTexture({ columns: 10, seed: seed + 1 });
  const sleeveTexture = createBinaryTexture({ columns: 15, size: 512, seed: seed + 2 });
  const sparkleTexture = createSparkleTexture({ seed: seed + 3 });

  scene.add(buildBackdrop(palette));

  const shells: ReturnType<typeof buildCableShell>[] = [];
  const bundles: ReturnType<typeof buildFiberBundle>[] = [];

  CABLE_LAYOUT.forEach((layout, index) => {
    const group = new THREE.Group();
    const direction = BUNDLE_DIRECTION.clone()
      .add(new THREE.Vector3(0, layout.tilt[0], layout.tilt[1]))
      .normalize();
    group.quaternion.setFromUnitVectors(X_AXIS, direction);
    group.position.set(
      layout.position[0],
      layout.position[1],
      layout.position[2],
    );
    group.scale.setScalar(layout.scale);

    const shell = buildCableShell({
      palette,
      binaryTexture,
      sleeveTexture,
      sparkleTexture,
      scrollOffset: index * 0.37,
      dim: layout.dim,
    });
    const bundle = buildFiberBundle({
      palette,
      seed: seed + index * 101,
      dim: layout.dim,
    });

    group.add(shell.group, bundle.strands, bundle.tips);
    scene.add(group);
    shells.push(shell);
    bundles.push(bundle);
  });

  // Camera path: a slow push-in that drifts left, which slides the hero
  // connector right and down across the frame like the reference does.
  const cameraFrom = new THREE.Vector3(1.4, 0.8, 18.0);
  const cameraTo = new THREE.Vector3(-1.4, -0.25, 14.6);
  const targetFrom = new THREE.Vector3(0.3, 0.2, 0);
  const targetTo = new THREE.Vector3(-0.2, -0.08, 0);
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  const update = (progress: number, seconds: number) => {
    // Ease the very start and end so the move never visibly snaps.
    const eased = THREE.MathUtils.smoothstep(progress, 0, 1) * 0.35 + progress * 0.65;

    cameraPosition.lerpVectors(cameraFrom, cameraTo, eased);
    cameraTarget.lerpVectors(targetFrom, targetTo, eased);
    camera.position.copy(cameraPosition);
    camera.up.set(Math.sin(eased * 0.18) * 0.06, 1, 0).normalize();
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();

    for (const shell of shells) {
      shell.setScroll(-seconds * 0.24);
    }
    for (const bundle of bundles) {
      bundle.setPulse(seconds * 0.26);
    }
  };

  const buildPostProcessing = (renderer: THREE.Renderer) => {
    const post = new THREE.PostProcessing(renderer as never);
    const scenePass = pass(scene, camera);

    const colour = scenePass.getTextureNode();
    const glow = bloom(colour, 0.5, 0.78, 0.5);

    const vignette = clamp(
      screenUV.sub(0.5).mul(vec2(1.0, 0.94)).length().mul(1.5).oneMinus(),
      0,
      1,
    ).pow(0.55);

    post.outputNode = colour.add(glow).mul(mix(0.38, 1.0, vignette));

    // Nodes that render something of their own — the scene pass, and bloom's
    // blur chain — default to updating once per *frame*, where "frame" is
    // counted by the renderer's animation loop. Remotion drives frames itself
    // and never starts that loop, so those nodes would run exactly once and
    // every rendered frame after the first would reuse the first frame's scene
    // texture. Switching them to per-render updates ties them to the draw call
    // instead, which is the thing we actually control here.
    //
    // Any further effect added to this graph that renders internally needs the
    // same treatment.
    for (const node of [scenePass, glow]) {
      node.updateBeforeType = THREE.NodeUpdateType.RENDER;
    }

    return post;
  };

  const dispose = () => {
    binaryTexture.dispose();
    sleeveTexture.dispose();
    sparkleTexture.dispose();
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      }
    });
  };

  return { scene, camera, update, buildPostProcessing, dispose };
};
