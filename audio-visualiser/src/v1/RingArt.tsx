import React from 'react';

export type Bar = {
  /** Ring-segment chord, forming the solid ring the bars grow out of. */
  seg: [number, number, number, number];
  /** The bar itself, drawn outward along the radius. */
  bar: [number, number, number, number];
  width: number;
  color: string;
};

export type Dot = {cx: number; cy: number; r: number; color: string};

/**
 * The line art for V1, with no glow of its own.
 *
 * It is rendered several times over — sharp on top of progressively blurred
 * copies — which is how the neon bloom is built. Keeping it a plain, cheap
 * component is what makes drawing it four times affordable.
 */
export const RingArt: React.FC<{
  width: number;
  height: number;
  bars: Bar[];
  dots: Dot[];
  ringWidth: number;
  /** Multiplies every stroke, so blurred copies can be fattened. */
  weight?: number;
  opacity?: number;
}> = ({width, height, bars, dots, ringWidth, weight = 1, opacity = 1}) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    style={{position: 'absolute', inset: 0, opacity}}
  >
    <g strokeLinecap="round" fill="none">
      {dots.map((d, i) => (
        <circle key={`d${i}`} cx={d.cx} cy={d.cy} r={d.r * weight} fill={d.color} />
      ))}
      {bars.map((b, i) => (
        <line
          key={`s${i}`}
          x1={b.seg[0]}
          y1={b.seg[1]}
          x2={b.seg[2]}
          y2={b.seg[3]}
          stroke={b.color}
          strokeWidth={ringWidth * weight}
        />
      ))}
      {bars.map((b, i) => (
        <line
          key={`b${i}`}
          x1={b.bar[0]}
          y1={b.bar[1]}
          x2={b.bar[2]}
          y2={b.bar[3]}
          stroke={b.color}
          strokeWidth={b.width * weight}
        />
      ))}
    </g>
  </svg>
);
