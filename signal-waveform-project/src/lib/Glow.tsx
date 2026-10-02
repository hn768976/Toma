import React from "react";
import { qaOff } from "./qa";

/**
 * Stacked glow: three blurs (1 : 4 : 12), each fainter than the last, merged
 * under the untouched SourceGraphic so the core line stays crisp.
 * stdDeviation is in viewBox units, so the glow scales with the frame.
 */
export const GlowFilter: React.FC<{
  id: string;
  base: number; // smallest blur radius in design px
  strength?: [number, number, number]; // opacity of small/medium/large blur
  region?: { x: number; y: number; width: number; height: number };
}> = ({ id, base, strength = [0.9, 0.55, 0.3], region }) =>
  qaOff("glow") ? (
    <filter id={id}>
      <feMerge>
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  ) : (
  <filter
    id={id}
    filterUnits={region ? "userSpaceOnUse" : "objectBoundingBox"}
    x={region ? region.x : "-20%"}
    y={region ? region.y : "-50%"}
    width={region ? region.width : "140%"}
    height={region ? region.height : "200%"}
    colorInterpolationFilters="sRGB"
  >
    <feGaussianBlur in="SourceGraphic" stdDeviation={base} result="b1" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={base * 4} result="b2" />
    <feGaussianBlur in="SourceGraphic" stdDeviation={base * 12} result="b3" />
    <feComponentTransfer in="b1" result="g1">
      <feFuncA type="linear" slope={strength[0]} />
    </feComponentTransfer>
    <feComponentTransfer in="b2" result="g2">
      <feFuncA type="linear" slope={strength[1]} />
    </feComponentTransfer>
    <feComponentTransfer in="b3" result="g3">
      <feFuncA type="linear" slope={strength[2]} />
    </feComponentTransfer>
    <feMerge>
      <feMergeNode in="g3" />
      <feMergeNode in="g2" />
      <feMergeNode in="g1" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
