import React from "react";
import type { Palette } from "./config";
import { polar } from "./wheel-geometry";

/**
 * The centre star: twelve long points alternating with twelve short ones,
 * filled, over a white-hot core. Authored in the same normalised disc space
 * as the wheel so the single vertical squash tilts it identically.
 */

const starPath = (
  radius: number,
  longRatio: number,
  shortRatio: number,
  innerRatio: number,
  phase = 0,
): string => {
  const pts: string[] = [];
  const n = 24; // 12 long + 12 short
  for (let i = 0; i < n; i++) {
    const tipAngle = phase + (i * 360) / n;
    const tipR = radius * (i % 2 === 0 ? longRatio : shortRatio);
    const [tx, ty] = polar(tipAngle, tipR);
    const [vx, vy] = polar(tipAngle + 360 / n / 2, radius * innerRatio);
    pts.push(`${i === 0 ? "M" : "L"} ${tx.toFixed(2)} ${ty.toFixed(2)}`);
    pts.push(`L ${vx.toFixed(2)} ${vy.toFixed(2)}`);
  }
  return `${pts.join(" ")} Z`;
};

type Props = {
  palette: Palette;
  /** Outer radius in normalised disc units. */
  radius: number;
  idPrefix: string;
  /** 0..1 breathing value driving the core's intensity. */
  breath: number;
};

export const Sunburst: React.FC<Props> = ({ palette, radius, idPrefix, breath }) => {
  const coreR = radius * 0.2;
  return (
    <g>
      <defs>
        <radialGradient id={`${idPrefix}-core`}>
          <stop offset="0%" stopColor={palette.burstCore} stopOpacity={1} />
          <stop offset="46%" stopColor={palette.burstCore} stopOpacity={0.95} />
          <stop offset="72%" stopColor={palette.burstHot} stopOpacity={0.7} />
          <stop offset="100%" stopColor={palette.burstHot} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${idPrefix}-body`}>
          <stop offset="0%" stopColor={palette.burstCore} />
          <stop offset="26%" stopColor={palette.burstHot} />
          <stop offset="72%" stopColor={palette.burstBody} />
          <stop offset="100%" stopColor={palette.burstDeep} />
        </radialGradient>
      </defs>

      {/* Deep underlayer, offset half a point for thickness. */}
      <path
        d={starPath(radius * 1.09, 1, 0.44, 0.26, 7.5)}
        fill={palette.burstDeep}
        opacity={0.9}
      />
      <path d={starPath(radius, 1, 0.47, 0.28)} fill={`url(#${idPrefix}-body)`} />
      {/* A second, tighter star lifts the centre. */}
      <path
        d={starPath(radius * 0.5, 1, 0.6, 0.36, 7.5)}
        fill={palette.burstHot}
        opacity={0.95}
      />
      <ellipse cx={0} cy={0} rx={coreR * 2.4} ry={coreR * 2.4} fill={`url(#${idPrefix}-core)`} opacity={0.55 + 0.3 * breath} />
      <ellipse cx={0} cy={0} rx={coreR} ry={coreR * 0.82} fill={palette.burstCore} opacity={0.9} />
    </g>
  );
};
