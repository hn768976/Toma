import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Row } from "../content";
import { useU } from "../layout";
import { MONO } from "../load-fonts";
import { makeRng } from "../rng";
import type { Theme } from "../theme";

/**
 * A file listing. Deliberately low contrast: this is texture, not
 * something the viewer is meant to read. Rows land one at a time over
 * the populate window, then hold.
 */

const selectionRng = makeRng(0x6611);
// A slowly moving selection band, like a cursor someone left behind.
const SELECTION: { at: number; row: number }[] = Array.from(
  { length: 14 },
  (_, i) => ({
    at: 150 + i * 34,
    row: Math.floor(selectionRng() * 52),
  }),
);

export const FileTable: React.FC<{
  theme: Theme;
  rows: Row[];
  /** Frame the first row lands on. */
  from: number;
  /** Frame the last row lands on. */
  to: number;
  /** Font size as a fraction of frame height. */
  scale: number;
  showStamp?: boolean;
  showState?: boolean;
  columns?: 1 | 2;
}> = ({
  theme,
  rows,
  from,
  to,
  scale,
  showStamp = true,
  showState = true,
  columns = 1,
}) => {
  const frame = useCurrentFrame();
  const u = useU();

  const fs = u(scale);
  const step = (to - from) / Math.max(1, rows.length - 1);

  const selected = SELECTION.filter((s) => s.at <= frame).slice(-1)[0]?.row;

  const renderRow = (row: Row, i: number) => {
    const at = from + i * step;
    const on = interpolate(frame, [at, at + 5], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const isSel = selected === i;
    return (
      <div
        key={i}
        style={{
          display: "flex",
          gap: fs * 0.9,
          alignItems: "baseline",
          whiteSpace: "nowrap",
          padding: `${fs * 0.16}px ${fs * 0.5}px`,
          opacity: on,
          background: isSel ? theme.frameBright : "transparent",
          color: isSel ? theme.bright : theme.body,
        }}
      >
        <span style={{ color: isSel ? theme.bright : theme.bodyDim }}>
          {row.tag}
        </span>
        <span style={{ flex: 1, overflow: "hidden" }}>{row.name}</span>
        <span style={{ color: isSel ? theme.bright : theme.bodyDim }}>
          {row.size}
        </span>
        {showStamp ? <span>{row.stamp}</span> : null}
        {showState ? (
          <span
            style={{
              color: isSel
                ? theme.bright
                : row.state === "OK"
                  ? theme.bodyDim
                  : theme.body,
            }}
          >
            {row.state}
          </span>
        ) : null}
      </div>
    );
  };

  const half = Math.ceil(rows.length / 2);

  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: fs,
        lineHeight: 1.34,
        letterSpacing: fs * 0.01,
        color: theme.body,
        padding: `${fs * 0.5}px ${fs * 0.4}px`,
        display: columns === 2 ? "grid" : "block",
        gridTemplateColumns: columns === 2 ? "1fr 1fr" : undefined,
        columnGap: columns === 2 ? fs * 1.4 : undefined,
      }}
    >
      {columns === 2 ? (
        <>
          <div>{rows.slice(0, half).map(renderRow)}</div>
          <div>{rows.slice(half).map((r, i) => renderRow(r, i + half))}</div>
        </>
      ) : (
        rows.map(renderRow)
      )}
    </div>
  );
};
