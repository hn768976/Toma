import type * as THREE from "three";
import type { Assets } from "../engine/assets";
import type { PostParams } from "../engine/Pipeline";

export type LookContext = {
  W: number; // output buffer width in px
  H: number;
  q: number; // render scale relative to 4K (W / 3840)
  maxAniso: number;
  maxTex: number;
  assets: Assets;
};

export interface LookInstance {
  scene: THREE.Scene;
  camera: THREE.Camera;
  post: PostParams;
  // Redraws every canvas from scratch and places the camera for `frame`.
  update(frame: number): void;
}

export type LookFactory<P> = (ctx: LookContext, palette: P) => LookInstance;
