import type * as THREE from "three";
import type { PostOptions } from "./pipeline";

/**
 * A look is a plain three.js world built once (layouts from seeded RNG) whose
 * update(t) sets every animated value from the loop frame t = frame % 600.
 * Nothing is carried between frames, so frames can render in any order.
 */
export interface World {
  scene: THREE.Scene;
  /** Optional additive layer drawn after depth of field (stays sharp). */
  overlay: THREE.Scene | null;
  camera: THREE.PerspectiveCamera;
  post: PostOptions;
  /** t: integer loop frame in [0, 600). pxScale: buffer height / 720. */
  update(t: number, pxScale: number): void;
}

export type WorldFactory = (gl: THREE.WebGLRenderer) => World;
