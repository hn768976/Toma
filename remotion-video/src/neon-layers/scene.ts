import * as THREE from "three/webgpu";
import { createPlateGeometry } from "./geometry";
import { createPlateMaterial } from "./material";
import { defaultLayout, type Layout } from "./layout";
import { LOOP_FRAMES } from "./constants";
import type { Theme } from "./themes";

export type NeonLayersScene = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Poses the stack for `frame`; the motion repeats every LOOP_FRAMES. */
  setFrame: (frame: number) => void;
  dispose: () => void;
};

const QUARTER_TURN = Math.PI / 2;

/**
 * A stack of identical square slabs receding along -Z, each twisted a little
 * further than the one in front of it.
 *
 * The loop is exact rather than approximate. Over one period the stack slides
 * forward by exactly one slab and turns by a whole number of quarter turns
 * minus one slab's twist, which lands every slab precisely where its neighbour
 * started. Because the slab is square, a quarter turn maps it onto itself, so
 * the final frame is pixel-identical to the first. Extra slabs are built behind
 * the camera and past the fog so that nothing enters or leaves the frame at the
 * seam.
 */
export const createNeonLayersScene = (
  theme: Theme,
  aspect: number,
  layout: Layout = defaultLayout,
): NeonLayersScene => {
  const scene = new THREE.Scene();
  const backdrop = new THREE.Color(theme.backdrop);
  scene.background = backdrop;

  const camera = new THREE.PerspectiveCamera(
    layout.cameraFov,
    aspect,
    0.1,
    400,
  );
  camera.position.set(...layout.cameraPosition);
  camera.lookAt(new THREE.Vector3(...layout.cameraTarget));
  camera.updateMatrixWorld();

  const geometry = createPlateGeometry({
    half: layout.plateHalf,
    cornerRadius: layout.cornerRadius,
    depth: layout.plateDepth,
    bevel: layout.bevel,
  });

  const { material, lightAzimuth, keyDirection } = createPlateMaterial(
    theme,
    layout.plateHalf,
    layout.plateDepth / 2 + layout.bevel,
  );
  const azimuth = THREE.MathUtils.degToRad(layout.lightAzimuthDeg);
  lightAzimuth.set(Math.cos(azimuth), Math.sin(azimuth));
  keyDirection.set(...layout.keyDirection).normalize();

  const count = layout.platesBehindCamera + layout.platesInFront;
  const stack = new THREE.InstancedMesh(geometry, material, count);
  stack.frustumCulled = false;

  const twist = THREE.MathUtils.degToRad(layout.twistDeg);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const axis = new THREE.Vector3(0, 0, 1);

  for (let slot = 0; slot < count; slot++) {
    const index = slot - layout.platesBehindCamera;
    position.set(0, 0, -index * layout.stepZ);
    quaternion.setFromAxisAngle(axis, index * twist);
    stack.setMatrixAt(slot, matrix.compose(position, quaternion, scale));
  }
  stack.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(stack);
  scene.add(group);

  const turnPerLoop = layout.quarterTurnsPerLoop * QUARTER_TURN - twist;

  const setFrame = (frame: number) => {
    const u = (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) /
      LOOP_FRAMES;
    group.position.z = u * layout.stepZ;
    group.rotation.z = u * turnPerLoop;
    group.updateMatrixWorld(true);
  };

  setFrame(0);

  return {
    scene,
    camera,
    setFrame,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      stack.dispose();
    },
  };
};
