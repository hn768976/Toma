import { useVideoConfig } from "remotion";

/**
 * Backing-store size for a full-frame canvas. Remotion's `--scale` is applied
 * as the page's devicePixelRatio, so a 3840x2160 composition rendered with
 * --scale=0.3333 gets a 1280x720 backing store (and 720p previews really cost
 * 720p, not 4K).
 */
export const useCanvasSize = (): { width: number; height: number; dpr: number; scale: number } => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return {
    width: Math.round(width * dpr),
    height: Math.round(height * dpr),
    dpr,
    scale: (width * dpr) / 3840,
  };
};
