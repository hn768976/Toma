// A single globule of fat, outside the vault.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

export const Blob: React.FC<{ radius: number; wobble: number }> = ({
  radius,
  wobble,
}) => (
  <>
    <Glow color={PALETTE.yellow} size={radius * 6} opacity={0.34} />
    <Svg half={radius * 1.6}>
      <ellipse
        cx={0}
        cy={0}
        rx={radius * (1.06 + Math.sin(wobble) * 0.05)}
        ry={radius * (1.0 - Math.sin(wobble) * 0.05)}
        fill={PALETTE.yellow}
      />
    </Svg>
  </>
);
