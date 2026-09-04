import React from "react";
import type { RecordGroup as RecordGroupData } from "../scene";
import type { Palette } from "../theme";
import { HexRows } from "./HexBlock";
import { Padlock } from "./Padlock";
import { SANS } from "../load-fonts";

/**
 * A padlock, its category label and the block of data underneath it.
 *
 * Laid out in flow rather than at computed offsets so the label always sits
 * flush with the left edge of its data, whatever the row widths come out as
 * once the embedded fonts have loaded.
 */
export const RecordGroup: React.FC<{
  record: RecordGroupData;
  frame: number;
  width: number;
  palette: Palette;
  opacity: number;
}> = ({ record, frame, width, palette, opacity }) => {
  const color = record.breached ? palette.breached : palette.secured;
  const lockPx = record.lockSize * width;
  const labelPx = record.labelSize * width;
  return (
    <div
      style={{
        position: "absolute",
        left: record.x * width,
        top: record.y * width,
        display: "flex",
        alignItems: "center",
        gap: lockPx * 0.42,
        // Nudged left of the anchor so the group straddles it rather than
        // hanging off to one side.
        transform: "translate(-22%, -50%)",
      }}
    >
      <Padlock
        size={lockPx}
        color={color}
        open={record.breached}
        glow={lockPx * 0.06}
        opacity={opacity * (record.breached ? 0.95 : 0.85)}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: labelPx * 0.42,
        }}
      >
        {record.label ? (
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: labelPx,
              letterSpacing: "0.1em",
              whiteSpace: "pre",
              color: palette.label,
              opacity: opacity * 0.96,
              textShadow: `0 0 ${labelPx * 0.14}px rgba(${palette.labelGlow}, 0.45), 0 0 ${labelPx * 0.55}px rgba(${palette.labelGlow}, 0.22)`,
            }}
          >
            {record.label}
          </div>
        ) : null}
        <HexRows
          block={record.block}
          frame={frame}
          width={width}
          color={record.breached ? palette.dataBright : palette.label}
          opacity={opacity}
        />
      </div>
    </div>
  );
};
