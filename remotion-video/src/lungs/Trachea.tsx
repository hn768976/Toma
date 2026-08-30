import React from "react";
import { TRACHEA, bronchusPath, tracheaPath } from "./anatomy";
import { Palette } from "./variants";

/**
 * The trachea and the two primary bronchi. Deliberately drawn outside the
 * breath transform: it stays put while the lobes move around it, which is the
 * detail that makes the breath read as anatomical rather than as a pulsing
 * logo.
 */
export const Trachea: React.FC<{ palette: Palette }> = ({ palette }) => (
  <g>
    <path
      d={bronchusPath(TRACHEA.leftEnd)}
      stroke={palette.trachea}
      strokeWidth={TRACHEA.bronchusWidth}
      strokeLinecap="round"
      fill="none"
    />
    <path
      d={bronchusPath(TRACHEA.rightEnd)}
      stroke={palette.trachea}
      strokeWidth={TRACHEA.bronchusWidth}
      strokeLinecap="round"
      fill="none"
    />
    <path d={tracheaPath()} fill={palette.trachea} />
  </g>
);
