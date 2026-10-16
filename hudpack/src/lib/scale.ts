import { getRemotionEnvironment } from "remotion";

/**
 * Output pixels per composition pixel. When rendering with --scale (Chrome's
 * deviceScaleFactor) this is the scale itself, so a 3840x2160 composition
 * rendered at --scale=1/3 draws into 1280x720 buffers and costs a 720p frame.
 * In the Studio it is capped so 4K previews stay interactive.
 */
export const getRenderScale = () => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (getRemotionEnvironment().isRendering) return dpr;
  return Math.min(dpr, 0.5);
};

/** Backing-store size for a full-frame canvas. */
export const backingSize = (width: number, height: number) => {
  const s = getRenderScale();
  return { w: Math.max(1, Math.round(width * s)), h: Math.max(1, Math.round(height * s)), s };
};
