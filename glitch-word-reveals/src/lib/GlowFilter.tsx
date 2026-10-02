import React from "react";

// Stacked glow: three blurs at 1 : 4 : 12, each fainter than the last.
// The SourceGraphic is NOT merged back in: the glow is drawn on its own
// copy behind the crisp letters, so it spreads out from the word but never
// softens the letters themselves.
export const GlowFilter: React.FC<{
  id: string;
  sigma: number; // smallest blur, in user units
  strengths?: [number, number, number];
  region: { x: number; y: number; width: number; height: number };
}> = ({ id, sigma, strengths = [0.95, 0.6, 0.35], region }) => (
  <filter
    id={id}
    filterUnits="userSpaceOnUse"
    x={region.x}
    y={region.y}
    width={region.width}
    height={region.height}
    colorInterpolationFilters="sRGB"
  >
    {[1, 4, 12].map((m, i) => (
      <React.Fragment key={m}>
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation={sigma * m}
          result={`b${i}`}
        />
        <feComponentTransfer in={`b${i}`} result={`g${i}`}>
          <feFuncA type="linear" slope={strengths[i]} />
        </feComponentTransfer>
      </React.Fragment>
    ))}
    <feMerge>
      <feMergeNode in="g2" />
      <feMergeNode in="g1" />
      <feMergeNode in="g0" />
    </feMerge>
  </filter>
);
