import React from "react";
import {
  CHAR_PERIOD,
  CONTENT_PERIOD,
  FLICKER_PERIOD,
  FRAMES_PER_ROW,
  LAYOUT_PERIOD,
  ROWS_RENDERED,
  loopInvariant,
} from "./constants";
import { SKELETONS, tokenKind } from "./field";
import { MONO_FAMILY } from "./font";
import type { Layout } from "./useLayout";
import { hash, pickHex } from "./random";
import type { Theme } from "./themes";

/**
 * Per-token phase offsets, keyed on the *content* row rather than the data row
 * so that two rows one scroll-period apart stay in step across the loop.
 */
const layoutPhase = (contentRow: number) =>
  hash(contentRow, 0x11) % LAYOUT_PERIOD;
const charPhase = (contentRow: number, token: number) =>
  hash(contentRow, token, 0x13) % CHAR_PERIOD;
const flickerPhase = (contentRow: number, token: number) =>
  hash(contentRow, token, 0x17) % FLICKER_PERIOD;

const SPACES = " ".repeat(64);
const spaces = (n: number) =>
  n <= 64 ? SPACES.slice(0, n) : " ".repeat(n);

type RowProps = {
  dataRow: number;
  frame: number;
  layout: Layout;
  theme: Theme;
};

const Row: React.FC<RowProps> = ({ dataRow, frame, layout, theme }) => {
  const contentRow = ((dataRow % CONTENT_PERIOD) + CONTENT_PERIOD) % CONTENT_PERIOD;
  const u = loopInvariant(dataRow, frame);

  // A row keeps one skeleton for LAYOUT_PERIOD frames, then rewrites itself.
  const layoutGen = Math.floor((u + layoutPhase(contentRow)) / LAYOUT_PERIOD);
  const skelIdx = hash(contentRow, layoutGen, 0x03) % SKELETONS.length;
  const { tokens } = SKELETONS[skelIdx];

  const nodes: React.ReactNode[] = [];
  let buffer = "";
  let col = 0;

  const glowSize = Math.round(layout.fontSize * 0.55);
  const padV = Math.round(layout.rowH * 0.075);

  for (let t = 0; t < tokens.length; t++) {
    const { x, len } = tokens[t];
    const charGen = Math.floor((u + charPhase(contentRow, t)) / CHAR_PERIOD);
    const text = pickHex(len, hash(skelIdx, t, charGen));

    let kind = tokenKind(skelIdx, t);
    if (kind === "primary" || kind === "secondary") {
      // Highlight blocks blink out on their own slow cycle.
      const flickerGen = Math.floor(
        (u + flickerPhase(contentRow, t)) / FLICKER_PERIOD,
      );
      if (hash(skelIdx, t, flickerGen, 0x05) % 100 >= 82) {
        kind = "plain";
      }
    }

    const gap = x - col;
    if (kind === "plain") {
      buffer += spaces(gap) + text;
    } else {
      buffer += spaces(gap);
      if (buffer.length > 0) {
        nodes.push(buffer);
        buffer = "";
      }
      if (kind === "bright") {
        nodes.push(
          <span
            key={t}
            style={{
              color: theme.bright,
              textShadow: `0 0 ${Math.round(glowSize * 0.5)}px ${theme.bright}`,
            }}
          >
            {text}
          </span>,
        );
      } else {
        const fill = kind === "primary" ? theme.primary : theme.secondary;
        nodes.push(
          <span
            key={t}
            style={{
              backgroundColor: fill.bg,
              color: fill.fg,
              padding: `${padV}px 0`,
              boxShadow: `0 0 ${glowSize}px ${fill.bg}59`,
            }}
          >
            {text}
          </span>,
        );
      }
    }
    col = x + len;
  }
  if (buffer.length > 0) {
    nodes.push(buffer);
  }

  return (
    <div
      style={{
        height: layout.rowH,
        lineHeight: `${layout.rowH}px`,
        whiteSpace: "pre",
      }}
    >
      {nodes}
    </div>
  );
};

export const HexField: React.FC<{
  frame: number;
  layout: Layout;
  theme: Theme;
}> = ({ frame, layout, theme }) => {
  // The field advances exactly one row every FRAMES_PER_ROW frames; the
  // remainder is carried as a sub-row offset so the motion stays smooth.
  const firstRow = Math.floor(frame / FRAMES_PER_ROW);
  const offset = (frame % FRAMES_PER_ROW) * (layout.rowH / FRAMES_PER_ROW);

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < ROWS_RENDERED; i++) {
    rows.push(
      <Row
        key={i}
        dataRow={firstRow + i}
        frame={frame}
        layout={layout}
        theme={theme}
      />,
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: -offset,
        fontFamily: `"${MONO_FAMILY}", monospace`,
        fontSize: layout.fontSize,
        color: theme.base,
        letterSpacing: 0,
      }}
    >
      {rows}
    </div>
  );
};
