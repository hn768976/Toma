import React from "react";
import { VIEWBOX_HEIGHT, VIEWBOX_WIDTH, type Palette } from "./constants";

// The night sky: a flat base with a warm bloom bleeding in from the
// upper right and a cool one from the lower left. Both sit behind the
// camera transform so the backdrop stays put while the scene pulls back.
export const Backdrop: React.FC<{ palette: Palette }> = ({ palette }) => (
  <g>
    <rect
      x="0"
      y="0"
      width={VIEWBOX_WIDTH}
      height={VIEWBOX_HEIGHT}
      fill={palette.backdrop}
    />
    <ellipse
      cx={VIEWBOX_WIDTH * 0.84}
      cy={VIEWBOX_HEIGHT * 0.22}
      rx={VIEWBOX_WIDTH * 0.52}
      ry={VIEWBOX_HEIGHT * 0.62}
      fill="url(#bloomWarm)"
    />
    <ellipse
      cx={VIEWBOX_WIDTH * 0.18}
      cy={VIEWBOX_HEIGHT * 0.86}
      rx={VIEWBOX_WIDTH * 0.46}
      ry={VIEWBOX_HEIGHT * 0.6}
      fill="url(#bloomCool)"
    />
  </g>
);

export const Vignette: React.FC = () => (
  <rect
    x="0"
    y="0"
    width={VIEWBOX_WIDTH}
    height={VIEWBOX_HEIGHT}
    fill="url(#vignette)"
  />
);
