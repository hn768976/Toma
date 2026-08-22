// The guard: a small cream figure in a coral cap who crosses his arms as he
// arrives and then never leaves. Coral appears on him and nowhere else,
// because coral means "the guard intervened".
//
// Cream limbs on a cream body would disappear, so each limb is drawn twice:
// a slightly fatter navy shape first, then the cream one on top. Against the
// navy background the outer edge is invisible; against the body it reads as a
// clean flat-vector cut.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

export const GUARD_HEIGHT = 250;

const Limb: React.FC<{
  x: number;
  width: number;
  height: number;
  rotate: number;
}> = ({ x, width, height, rotate }) => (
  <g transform={`rotate(${rotate})`}>
    <rect
      x={x - 6}
      y={-height / 2 - 6}
      width={width + 12}
      height={height + 12}
      rx={height / 2 + 6}
      fill={PALETTE.navy}
    />
    <rect x={x} y={-height / 2} width={width} height={height} rx={height / 2} fill={PALETTE.cream} />
  </g>
);

export const Guard: React.FC<{
  /** 0 = arms hanging, 1 = arms fully crossed. */
  cross: number;
  /** Small breathing/idle sway in radians. */
  idle: number;
}> = ({ cross, idle }) => {
  const armAngle = 95 - 77 * cross; // 95deg hanging → 18deg across the chest
  const lean = Math.sin(idle) * 1.6;

  return (
    <>
      <Glow color={PALETTE.coral} size={380} opacity={0.13} y={-70} />
      <Svg half={140} scale={GUARD_HEIGHT / 260}>
        <g transform={`rotate(${lean})`}>
          {/* Legs */}
          <rect x={-30} y={78} width={24} height={40} rx={12} fill={PALETTE.cream} />
          <rect x={6} y={78} width={24} height={40} rx={12} fill={PALETTE.cream} />

          {/* Body */}
          <rect x={-46} y={-18} width={92} height={104} rx={44} fill={PALETTE.cream} />

          {/* Crossed arms */}
          <g transform="translate(-42 6)">
            <Limb x={0} width={86} height={24} rotate={armAngle} />
          </g>
          <g transform="translate(42 6)">
            <Limb x={-86} width={86} height={24} rotate={-armAngle} />
          </g>

          {/* Head */}
          <circle cx={0} cy={-62} r={50} fill={PALETTE.cream} />
          <circle cx={-17} cy={-64} r={7} fill={PALETTE.navy} />
          <circle cx={17} cy={-64} r={7} fill={PALETTE.navy} />

          {/* Coral cap: dome plus brim */}
          <path d="M -50 -92 A 50 50 0 0 1 50 -92 Z" fill={PALETTE.coral} />
          <rect x={-62} y={-98} width={124} height={16} rx={8} fill={PALETTE.coral} />
          <rect x={20} y={-100} width={44} height={13} rx={6} fill={PALETTE.coral} />
        </g>
      </Svg>
    </>
  );
};
