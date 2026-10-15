import type { WebGLRenderer } from "pixi.js";
import type { Post } from "./post";

export interface LookContext {
  renderer: WebGLRenderer;
  /** composition size in CSS px (3840 x 2160) */
  W: number;
  H: number;
  /** device pixel ratio: 1/3 for the 720p previews, 1 for 4K, 1.5625 for 6K */
  res: number;
  /** backing-store pixel size */
  pw: number;
  ph: number;
  /** output pixels per 720p pixel (1 at 720p, 3 at 4K) */
  px: number;
  post: Post;
}

export interface Scene {
  /** Draw frame `f` (already reduced to 0..599). Must not depend on any earlier call. */
  render(f: number): void;
  destroy?(): void;
}

export type LookFactory<P> = (ctx: LookContext, params: P) => Promise<Scene> | Scene;
