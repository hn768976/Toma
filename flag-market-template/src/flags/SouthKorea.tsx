import React from "react";
import { FlagDef } from "./shared";

// Taegukgi, 2:3 (grid 72 x 48, centred at 36,24). Taegeuk diameter = H/2.
// Trigrams sit on the flag diagonals: bars H/4 long, H/24 thick, H/48
// apart, H/8 from the circle. Clockwise from the upper hoist:
// geon ☰ (upper-left), gam ☵ (upper-right), gon ☷ (lower-right),
// ri ☲ (lower-left). Red (upper) and blue (lower) halves, red's head on
// the hoist side along the upper-left → lower-right diagonal.
const RED = "#CD2E3A";
const BLUE = "#0047A0";
const BLACK = "#000000";
const DIAG = (Math.atan2(2, 3) * 180) / Math.PI; // 33.69°

// One trigram drawn "up" from the centre (local -y), bars at y = -25,-22,-19
// (outer → inner). `broken[i]` breaks the bar with a gap H/48 = 1 wide.
const Trigram: React.FC<{ broken: [boolean, boolean, boolean] }> = ({ broken }) => (
  <>
    {[-25, -22, -19].map((y, i) =>
      broken[i] ? (
        <React.Fragment key={y}>
          <rect x={-6} y={y - 1} width={5.5} height={2} fill={BLACK} />
          <rect x={0.5} y={y - 1} width={5.5} height={2} fill={BLACK} />
        </React.Fragment>
      ) : (
        <rect key={y} x={-6} y={y - 1} width={12} height={2} fill={BLACK} />
      ),
    )}
  </>
);

export const SouthKoreaFlag: FlagDef = {
  width: 72,
  height: 48,
  draw: () => (
    <>
      <rect width={72} height={48} fill="#FFFFFF" />
      <g transform="translate(36 24)">
        {/* local "up" → upper-left corner: rotate(-(90 - 33.69)) */}
        <g transform={`rotate(${-(90 - DIAG)})`}>
          <Trigram broken={[false, false, false]} /> {/* geon, upper-left */}
          <g transform="rotate(180)">
            <Trigram broken={[true, true, true]} /> {/* gon, lower-right */}
          </g>
          <circle r={12} fill={RED} />
          {/* blue half: lower side; small arcs give red its head at the
              upper-left end and blue its head at the lower-right end */}
          <path d="M0,-12 A6,6 0 0 0 0,0 A6,6 0 0 1 0,12 A12,12 0 0 1 0,-12 Z" fill={BLUE} />
        </g>
        {/* local "up" → upper-right corner */}
        <g transform={`rotate(${90 - DIAG})`}>
          <Trigram broken={[true, false, true]} /> {/* gam, upper-right */}
          <g transform="rotate(180)">
            <Trigram broken={[false, true, false]} /> {/* ri, lower-left */}
          </g>
        </g>
      </g>
    </>
  ),
};
