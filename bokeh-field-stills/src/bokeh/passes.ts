import type { RefObject } from "react";
import type { Scene } from "./elements";

/**
 * Every pass draws into the same visible canvas rather than owning its own
 * layer: five stacked 4K canvases would cost ~165MB and force the compositor
 * to blend them for no benefit.
 *
 * The passes are still separate components so the order of the piece is
 * declared in JSX. React runs child layout effects in mount order, so
 * <BackgroundWash /> ... <GrainPass /> execute in exactly the order they are
 * written, and the parent's own effect runs last.
 */
export type PassProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  scene: Scene;
};
