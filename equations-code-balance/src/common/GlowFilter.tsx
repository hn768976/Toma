import React from "react";

/**
 * Stacked glow: three Gaussian blurs (roughly 1 : 4 : 12), each fainter than
 * the last, merged under the untouched SourceGraphic so the cores stay sharp.
 *
 *   feGaussianBlur (small)  ─┐
 *   feGaussianBlur (medium) ─┼─ feMerge ─ SourceGraphic on top
 *   feGaussianBlur (large)  ─┘
 */
export const GlowFilter: React.FC<{
  id: string;
  /** Smallest blur radius in output pixels; the others are x4 and x12. */
  base: number;
  /** Opacity of the three halos, small → large. */
  strength?: [number, number, number];
  /** Filter region in % of the element; full-frame layers use 0..100. */
  margin?: number;
}> = ({ id, base, strength = [0.8, 0.45, 0.25], margin = 50 }) => (
  <filter
    id={id}
    x={`-${margin}%`}
    y={`-${margin}%`}
    width={`${100 + 2 * margin}%`}
    height={`${100 + 2 * margin}%`}
    colorInterpolationFilters="sRGB"
  >
    {[1, 4, 12].map((k, i) => (
      <React.Fragment key={k}>
        <feGaussianBlur in="SourceGraphic" stdDeviation={base * k} result={`b${i}`} />
        <feComponentTransfer in={`b${i}`} result={`g${i}`}>
          <feFuncA type="linear" slope={strength[i]} />
        </feComponentTransfer>
      </React.Fragment>
    ))}
    <feMerge>
      <feMergeNode in="g2" />
      <feMergeNode in="g1" />
      <feMergeNode in="g0" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
