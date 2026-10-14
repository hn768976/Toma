import type * as THREE from "three";
import type { PostParams } from "./post";

export type BuildCtx = {
  gl: THREE.WebGLRenderer;
  /** Drawing-buffer size in pixels. */
  width: number;
  height: number;
  /** height / 720: multiply pixel sizes specified at 720p by this. */
  pxScale: number;
  resolution: THREE.Vector2;
};

export type LookHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  post: PostParams;
  /** Set every visible value from the loop frame (0..599). Nothing else. */
  update: (frame: number) => void;
  /** Optional extra passes before the main render (e.g. planar reflection). */
  preRender?: (gl: THREE.WebGLRenderer) => void;
  /** Resolves when textures etc. are fully uploaded. */
  ready?: Promise<void>;
  dispose?: () => void;
};
