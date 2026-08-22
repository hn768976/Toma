// The guard's intervention: a coral barrier snapping across the vault's
// mouth. This is the only thing coral is ever used for besides his cap.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";
import { VAULT_RADIUS, VAULT_SCALE } from "./Vault";

export const Barrier: React.FC<{
  /** 0 → 1 → 0 over the flash. */
  flash: number;
}> = ({ flash }) => {
  if (flash <= 0) return null;
  const r = VAULT_RADIUS + 6;

  return (
    <>
      <Glow color={PALETTE.coral} size={620} opacity={0.24 * flash} />
      <Svg half={r + 40} scale={VAULT_SCALE}>
        <circle cx={0} cy={0} r={r} fill="none" stroke={PALETTE.coral} strokeWidth={18} opacity={flash} />
        {[-150, -75, 0, 75, 150].map((y) => {
          const halfChord = Math.sqrt(Math.max(r * r - y * y, 0)) - 6;
          return (
            <rect
              key={y}
              x={-halfChord}
              y={y - 8}
              width={halfChord * 2}
              height={16}
              rx={8}
              fill={PALETTE.coral}
              opacity={flash}
            />
          );
        })}
      </Svg>
    </>
  );
};
