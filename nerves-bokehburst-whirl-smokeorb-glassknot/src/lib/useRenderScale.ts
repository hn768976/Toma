import { getRemotionEnvironment } from "remotion";

/**
 * Device-pixel ratio for the GL canvases. When rendering, Remotion's --scale sets
 * window.devicePixelRatio (0.333 -> 1280x720, 1 -> 4K, 1.5625 -> 6000x3375).
 * In the Studio we cap it at 0.5 (1920x1080) so the preview stays interactive.
 */
export const getRenderScale = () => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return getRemotionEnvironment().isRendering ? dpr : Math.min(dpr, 0.5);
};
