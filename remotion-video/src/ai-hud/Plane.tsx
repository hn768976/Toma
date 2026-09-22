import React from "react";
import { useVideoConfig } from "remotion";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  OVERSCAN_X,
  OVERSCAN_Y,
  PLANE_ROT_X,
  PLANE_ROT_Y,
  PLANE_ROT_Z,
  VIEW_BOX,
} from "./constants";

/**
 * Ratio between the rendered frame and the 3840-wide authoring space.
 * Multiply any value that has to be a real CSS pixel (blur radii, the CSS 3D
 * offsets) by this. Values drawn inside an SVG do NOT need it — the viewBox
 * handles them, which is why a trace stroke stays visible at both 1080p and
 * 4K without a per-resolution branch.
 */
export const useHudScale = () => useVideoConfig().width / BASE_WIDTH;

/**
 * One depth layer of the scene.
 *
 * `depth` pushes the layer along the plane normal (negative = further away)
 * and `blur` is that slab's depth of field, in authoring units. Because the
 * content is a handful of flat layers, a per-layer CSS blur is
 * indistinguishable from a real DOF pass at a fraction of the cost.
 *
 * The 3D transform and the blur are on SEPARATE elements on purpose: a
 * `filter` forces its own element to flatten, so putting both on one div can
 * knock the layer out of the parent's 3D rendering context and lose the
 * perspective scaling.
 *
 * PERFORMANCE — measured, not guessed. Three things were tried here:
 *
 *  - Oversized glow filter regions. Real and worth fixing; the cost of a
 *    filter surface is the square of its extent, so Defs.tsx now sizes every
 *    region to just over 3x its largest stdDeviation.
 *  - Blurring the bokeh fields by blurring the whole layer. Replaced with a
 *    per-disc SVG blur (~0.3s/frame at 1080p), since thirty small filter
 *    surfaces are far cheaper than one frame-sized one.
 *  - Collapsing the six layers onto two rotated surfaces, with the far and
 *    near slabs blurred by an SVG filter inside the interface plane. This
 *    made things MUCH worse — 3.8s/frame against 1.6 — because an SVG filter
 *    over a near-frame-sized group inside an already 3D-transformed surface
 *    is evaluated at that surface's raised raster scale. Reverted.
 *
 * What remains is inherent: a CSS 3D rotation makes each layer its own
 * composited surface which Chrome re-rasterises at a raised scale so the
 * tilted result stays sharp. Removing the tilt alone takes the render from
 * 1.6s/frame to 0.9s/frame, and the two-axis tilt is a requirement of the
 * piece. See the render-time section of the README.
 */
export const Plane: React.FC<{
  depth: number;
  blur?: number;
  rotXExtra?: number;
  opacity?: number;
  /** false for free-floating particles that should not inherit the plane tilt. */
  tilt?: boolean;
  children: React.ReactNode;
}> = ({ depth, blur = 0, rotXExtra = 0, opacity = 1, tilt = true, children }) => {
  const s = useHudScale();
  const w = BASE_WIDTH + OVERSCAN_X * 2;
  const h = BASE_HEIGHT + OVERSCAN_Y * 2;

  const transform = tilt
    ? [
        `rotateZ(${PLANE_ROT_Z}deg)`,
        `rotateX(${PLANE_ROT_X + rotXExtra}deg)`,
        `rotateY(${PLANE_ROT_Y}deg)`,
        `translateZ(${depth * s}px)`,
      ].join(" ")
    : `translateZ(${depth * s}px)`;

  return (
    <div
      style={{
        position: "absolute",
        left: -OVERSCAN_X * s,
        top: -OVERSCAN_Y * s,
        width: w * s,
        height: h * s,
        transformOrigin: `${(OVERSCAN_X + BASE_WIDTH / 2) * s}px ${(OVERSCAN_Y + BASE_HEIGHT / 2) * s}px`,
        transform,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          // A zero-radius blur still forces a filter pass, so skip it entirely.
          filter: blur > 0 ? `blur(${(blur * s).toFixed(3)}px)` : undefined,
          opacity,
        }}
      >
        <svg width="100%" height="100%" viewBox={VIEW_BOX}>
          {children}
        </svg>
      </div>
    </div>
  );
};
