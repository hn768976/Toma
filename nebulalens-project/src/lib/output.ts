import { getRemotionEnvironment, useVideoConfig } from "remotion";

/** Output pixel size: composition size × Remotion's --scale (devicePixelRatio). */
export const useOutputPixels = () => {
  const { width, height } = useVideoConfig();
  const env = getRemotionEnvironment();
  // In the Studio, never go above 1:1 (keeps retina screens from rendering 8K).
  const dpr = env.isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1);
  // Round, never floor: 3840 × 0.333… must be 1280, not 1279.
  return { pw: Math.round(width * dpr), ph: Math.round(height * dpr), width, height };
};
