import React from "react";
import { formatChange, formatPercent, TABULAR } from "./format";
import type { Layout, PlayheadState } from "./geometry";
import type { Palette } from "./themes";

/**
 * The change and percentage floating above the playhead. Both come from the
 * same interpolated series value the playhead dot sits on, so the number
 * always matches the line underneath it.
 */
export const Readout: React.FC<{
  layout: Layout;
  palette: Palette;
  fontFamily: string;
  head: PlayheadState;
  change: number;
  changePercent: number;
  opacity: number;
}> = ({ layout, palette, fontFamily, head, change, changePercent, opacity }) => {
  const { height, width, plotLeft, plotRight } = layout;
  // Half the widest the group gets, so it can be kept inside the plot.
  const halfWidth = width * 0.105;
  const centre = Math.min(
    Math.max(head.x, plotLeft + halfWidth),
    plotRight - halfWidth,
  );

  return (
    <div
      style={{
        position: "absolute",
        left: centre,
        top: height * 0.352,
        opacity,
        transform: "translate(-50%, -100%)",
        display: "flex",
        gap: width * 0.045,
        fontFamily,
        fontSize: height * 0.034,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: palette.accent,
        ...TABULAR,
      }}
    >
      <span>{formatChange(change)}</span>
      <span>{formatPercent(changePercent)}</span>
    </div>
  );
};
