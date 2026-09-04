/**
 * The device pixel ratio the frame is being rasterised at.
 *
 * Remotion's --scale sets the browser's deviceScaleFactor, so this is 0.5 for
 * the 1080p preview of a 3840x2160 composition and 1 for the 4K render. Canvas
 * backing stores are sized by it while everything is drawn in CSS pixels, which
 * is what keeps block sizes and channel offsets identical at both scales.
 */
export const usePixelRatio = (): number => {
  if (typeof window === "undefined") return 1;
  const ratio = window.devicePixelRatio || 1;
  // Studio on a retina display would otherwise allocate a 4x buffer for nothing.
  return Math.min(2, Math.max(0.25, ratio));
};
