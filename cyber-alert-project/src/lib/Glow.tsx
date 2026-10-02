import React from "react";

/**
 * Stacked glow: three Gaussian blurs (1 : 4 : 12), each fainter than the
 * last, merged under the sharp source. `base` is the small blur's std-dev in
 * the user units of the SVG the filter is used in. `gain` scales all three
 * halos (used for pulsing).
 */
export const GlowFilter: React.FC<{
  id: string;
  base: number;
  gain?: number;
  weights?: [number, number, number];
}> = ({ id, base, gain = 1, weights = [0.95, 0.6, 0.38] }) => {
  const sizes = [base, base * 4, base * 12];
  return (
    <filter id={id} x="-200%" y="-200%" width="500%" height="500%" colorInterpolationFilters="sRGB">
      {sizes.map((s, i) => (
        <React.Fragment key={i}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={s} result={`b${i}`} />
          <feColorMatrix
            in={`b${i}`}
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${Math.min(4, weights[i] * gain * 1.6)} 0`}
            result={`g${i}`}
          />
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
};
