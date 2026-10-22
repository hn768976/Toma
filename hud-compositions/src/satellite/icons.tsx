import React from "react";
import { FONT_LABEL } from "../common/constants";

/** Dotted ring with a letter, used for the "C" scan and "A" link badges. */
export const LetterBadge: React.FC<{
  x: number;
  y: number;
  letter: string;
  color: string;
  opacity: number;
  spin: number;
  r?: number;
}> = ({ x, y, letter, color, opacity, spin, r = 22 }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeDasharray="1.5 5"
      strokeLinecap="round"
      transform={`rotate(${spin})`}
    />
    <text
      y={8}
      textAnchor="middle"
      fontFamily={FONT_LABEL}
      fontWeight={500}
      fontSize={24}
      fill={color}
    >
      {letter}
    </text>
  </g>
);

/** Crossed circle marker printed on field centres. */
export const CrossMarker: React.FC<{
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
}> = ({ x, y, r, color, opacity }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle r={r} fill="none" stroke={color} strokeWidth={1.3} />
    <path
      d={`M${-r * 0.6} ${-r * 0.6}L${r * 0.6} ${r * 0.6}M${r * 0.6} ${-r * 0.6}L${-r * 0.6} ${r * 0.6}`}
      stroke={color}
      strokeWidth={1.3}
    />
  </g>
);

/** Small ringed dot target marker (white rim, coloured core). */
export const DotMarker: React.FC<{
  x: number;
  y: number;
  r: number;
  core: string;
  rim?: string;
  opacity: number;
}> = ({ x, y, r, core, rim = "#F4F8FA", opacity }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle r={r * 1.7} fill="rgba(10,14,18,0.35)" />
    <circle r={r * 1.5} fill="none" stroke={rim} strokeWidth={r * 0.45} />
    <circle r={r * 0.85} fill={core} />
  </g>
);

/** Ø-style crosshair node: ring with a slashed inner circle. */
export const CrossNode: React.FC<{
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
  double?: boolean;
}> = ({ x, y, r, color, opacity, double }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle r={r} fill="rgba(10,14,18,0.25)" stroke={color} strokeWidth={r * 0.22} />
    {double ? <circle r={r * 1.45} fill="none" stroke={color} strokeWidth={r * 0.1} /> : null}
    <circle r={r * 0.45} fill="none" stroke="#F4F8FA" strokeWidth={r * 0.13} />
    <path
      d={`M${-r * 0.55} ${r * 0.55}L${r * 0.55} ${-r * 0.55}`}
      stroke="#F4F8FA"
      strokeWidth={r * 0.13}
    />
  </g>
);
