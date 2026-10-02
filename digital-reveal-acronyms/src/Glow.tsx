import React from "react";

// Stacked glow: three blurs (1 : 4 : 12), each fainter, tinted, with the crisp
// SourceGraphic merged on top so the glow spreads out from the edges and never
// softens them. `strength` is computed from the frame by the caller.
export const GlowFilter: React.FC<{
  id: string;
  unit: number; // px per 1.0 of blur radius (fraction of frame height)
  base: number; // smallest blur, fraction of frame height
  color: string;
  strength: number;
  region: { x: number; y: number; w: number; h: number };
}> = ({ id, unit, base, color, strength, region }) => {
  const s1 = base * unit;
  const weights = [0.9, 0.6, 0.35];
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={region.x}
      y={region.y}
      width={region.w}
      height={region.h}
      colorInterpolationFilters="sRGB"
    >
      {[1, 4, 12].map((m, i) => (
        <React.Fragment key={m}>
          <feGaussianBlur in="SourceAlpha" stdDeviation={s1 * m} result={`b${i}`} />
          <feComponentTransfer in={`b${i}`} result={`w${i}`}>
            <feFuncA type="linear" slope={weights[i] * strength} />
          </feComponentTransfer>
        </React.Fragment>
      ))}
      <feMerge result="blurs">
        <feMergeNode in="w2" />
        <feMergeNode in="w1" />
        <feMergeNode in="w0" />
      </feMerge>
      <feFlood floodColor={color} result="tint" />
      <feComposite in="tint" in2="blurs" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
};
