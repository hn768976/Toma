import { getRemotionEnvironment } from "remotion";

/**
 * Canvas pixel ratio. Compositions are 3840x2160 in CSS pixels; when Remotion
 * renders with --scale the page's devicePixelRatio is that scale, so the
 * drawing buffer is exactly the output size. In the Studio we cap it so the
 * raymarched scenes stay interactive.
 */
export const renderDpr = (studioCap = 0.5) => {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  if (getRemotionEnvironment().isStudio) return Math.min(dpr, studioCap);
  return dpr;
};
