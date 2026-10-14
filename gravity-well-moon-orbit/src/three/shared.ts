import * as THREE from "three";

/**
 * Uniforms shared by every material in one canvas. PostFX fills them from
 * the real drawing-buffer size right before each render, so line widths and
 * point sizes stay the same relative to the frame at 720p, 4K or 6K.
 */
export type SharedUniforms = {
  uResolution: { value: THREE.Vector2 };
  /** Drawing-buffer height / 720. */
  uPxScale: { value: number };
};

export const createShared = (): SharedUniforms => ({
  uResolution: { value: new THREE.Vector2(1280, 720) },
  uPxScale: { value: 1 },
});
