import type React from "react";

/**
 * Every visual layer is its own full-resolution canvas, stacked in the
 * composition's own isolated stacking context. Additive layers use CSS
 * `screen` so they build light on the background without clipping the
 * way a straight `lighter` composite would; the silhouettes use
 * `normal`, because a black shape has to be able to occlude the light
 * behind it — that occlusion is what puts the figure IN FRONT of the
 * glow rather than surrounded by it.
 */
export const layerStyle = (
  blend: "normal" | "screen",
): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  mixBlendMode: blend,
});
