import React from "react";
import { Lobe } from "./anatomy";
import { Palette } from "./variants";

/**
 * One lobe: a solid organic shape with no outline stroke — the fill defines
 * the form — plus a flat darker band along its inner edge for depth.
 */
export const LungBody: React.FC<{ lobe: Lobe; palette: Palette; clipId: string }> = ({
  lobe,
  palette,
  clipId,
}) => (
  <g>
    <path d={lobe.path} fill={palette.lungFill} />
    <g clipPath={`url(#${clipId})`}>
      <path d={lobe.shadowPath} fill={palette.lungShadow} />
    </g>
  </g>
);
