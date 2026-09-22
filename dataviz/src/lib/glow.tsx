import React from "react";

/**
 * Neon glow as a stacked SVG filter.
 *
 * Three Gaussian blurs at roughly 1 : 4 : 12 with decreasing opacity, merged
 * under an untouched SourceGraphic. A single blur gives a flat halo that turns
 * the stroke into a fuzzy tube; the stack keeps a thin bright core with a wide
 * soft falloff that reads as light.
 *
 * colorInterpolationFilters is forced to sRGB — the linearRGB default makes the
 * halo wash out and behave differently from what the preview suggests.
 */
export const NeonFilter: React.FC<{
  id: string;
  /** base blur radius in user-space units; the stack is r, 4r, 12r */
  r: number;
  /** opacity of the three halo stops, hot -> wide */
  stops?: [number, number, number];
  /**
   * Explicit filter region in user space. Needed for elements whose bounding
   * box is degenerate in one axis (a perfectly horizontal rule), where a
   * percentage region collapses and the halo is clipped away.
   */
  region?: { x: number; y: number; w: number; h: number };
}> = ({ id, r, stops = [0.85, 0.5, 0.32], region }) => (
  <filter
    id={id}
    {...(region
      ? {
          filterUnits: "userSpaceOnUse" as const,
          x: region.x,
          y: region.y,
          width: region.w,
          height: region.h,
        }
      : {
          filterUnits: "objectBoundingBox" as const,
          x: "-180%",
          y: "-180%",
          width: "460%",
          height: "460%",
        })}
    colorInterpolationFilters="sRGB"
    primitiveUnits="userSpaceOnUse"
  >
    <feGaussianBlur in="SourceGraphic" stdDeviation={r} result="b1" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={r * 4} result="b2" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={r * 12} result="b3" />
    <feComponentTransfer in="b1" result="g1">
      <feFuncA type="linear" slope={stops[0]} />
    </feComponentTransfer>
    <feComponentTransfer in="b2" result="g2">
      <feFuncA type="linear" slope={stops[1]} />
    </feComponentTransfer>
    <feComponentTransfer in="b3" result="g3">
      <feFuncA type="linear" slope={stops[2]} />
    </feComponentTransfer>
    <feMerge>
      <feMergeNode in="g3" />
      <feMergeNode in="g2" />
      <feMergeNode in="g1" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

/** A cheaper single-stop bloom for small UI accents. */
export const SoftFilter: React.FC<{ id: string; r: number; slope?: number }> = ({
  id,
  r,
  slope = 0.7,
}) => (
  <filter
    id={id}
    x="-120%"
    y="-120%"
    width="340%"
    height="340%"
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur in="SourceGraphic" stdDeviation={r} result="b" />
    <feComponentTransfer in="b" result="g">
      <feFuncA type="linear" slope={slope} />
    </feComponentTransfer>
    <feMerge>
      <feMergeNode in="g" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
