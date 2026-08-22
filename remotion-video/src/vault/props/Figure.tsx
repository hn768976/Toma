// The stock rounded cream character: body, head, two dot eyes, nothing else.
// Used for the four builders in cue 2 and for the infant in cue 16. Limbs get
// the same navy under-shape as the guard's so they read against the body.

import React from "react";
import { PALETTE } from "../constants";
import { Svg } from "../Svg";

export const Figure: React.FC<{
  /** Overall height in scene px. */
  height: number;
  /** Baby proportions: bigger head, shorter body. */
  infant?: boolean;
  /** Arm swing in degrees, away from hanging straight down. */
  armAngle?: number;
}> = ({ height, infant = false, armAngle = 18 }) => {
  const native = 150;
  const scale = height / native;
  const headR = infant ? 40 : 27;
  const headY = infant ? -34 : -42;
  const bodyW = infant ? 66 : 48;
  const bodyTop = infant ? 4 : -12;
  const bodyH = infant ? 56 : 62;
  const eye = infant ? 7 : 5;
  const footY = bodyTop + bodyH - 4;
  const legH = infant ? 20 : 26;

  // Arms hang outward and away from the body: the right arm's rect runs in
  // -x from its shoulder, the left arm's in +x, each rotated the other way.
  const arm = (side: 1 | -1) => (
    <g
      transform={`translate(${(side * bodyW) / 2} ${bodyTop + 14}) rotate(${-side * (90 + armAngle)})`}
    >
      <rect x={side === 1 ? -45 : -3} y={-11} width={48} height={22} rx={11} fill={PALETTE.navy} />
      <rect x={side === 1 ? -42 : 0} y={-8} width={42} height={16} rx={8} fill={PALETTE.cream} />
    </g>
  );

  return (
    <Svg half={90} scale={scale}>
      {/* Legs, with a navy gap between them */}
      <rect x={-24} y={footY} width={21} height={legH + 3} rx={10} fill={PALETTE.navy} />
      <rect x={3} y={footY} width={21} height={legH + 3} rx={10} fill={PALETTE.navy} />
      <rect x={-22} y={footY} width={17} height={legH} rx={9} fill={PALETTE.cream} />
      <rect x={5} y={footY} width={17} height={legH} rx={9} fill={PALETTE.cream} />

      {arm(-1)}
      {arm(1)}

      {/* Body */}
      <rect x={-bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} rx={bodyW / 2} fill={PALETTE.cream} />

      {/* Head */}
      <circle cx={0} cy={headY} r={headR} fill={PALETTE.cream} />
      <circle cx={-headR * 0.34} cy={headY - 2} r={eye} fill={PALETTE.navy} />
      <circle cx={headR * 0.34} cy={headY - 2} r={eye} fill={PALETTE.navy} />
    </Svg>
  );
};
