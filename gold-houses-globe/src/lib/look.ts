import type * as THREE from "three";
import type { PostOptions } from "./post";
import type { AssetKey, Assets } from "./assets";

export type LookContext<P> = {
  gl: THREE.WebGLRenderer;
  /** drawing-buffer size in pixels (1280x720 for previews, 3840x2160 for 4K) */
  width: number;
  height: number;
  assets: Assets;
  params: P;
  /** loop period in frames (600). Fixed per look, independent of the
   *  composition length, so a 601-frame loop check sees the same motion. */
  period: number;
};

export type LookInstance = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  post: PostOptions;
  /** Set every animated value for this frame. Must be a pure function of `frame`. */
  update: (frame: number) => void;
  /** Extra render passes (e.g. floor reflection) after update, before the main render. */
  beforeRender?: (gl: THREE.WebGLRenderer) => void;
  dispose?: () => void;
};

export type Look<P> = {
  assets: AssetKey[];
  create: (ctx: LookContext<P>) => LookInstance;
};
