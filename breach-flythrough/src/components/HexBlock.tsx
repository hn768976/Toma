import React from "react";
import type { Block } from "../scene";
import { tokenLit } from "../scene";
import { MONO } from "../load-fonts";

/**
 * The rows of one block of hex tokens, laid out in normal flow.
 *
 * Rows with no flickering token collapse to a single text node. Only the ~4%
 * of rows that do carry one get split into per-token spans, which keeps the
 * element count in the low hundreds across the whole eight-layer stack.
 */
export const HexRows: React.FC<{
  block: Block;
  frame: number;
  width: number;
  color: string;
  opacity: number;
}> = ({ block, frame, width, color, opacity }) => (
  <div
    style={{
      fontFamily: MONO,
      fontWeight: 400,
      fontSize: block.fontSize * width,
      lineHeight: 1.5,
      letterSpacing: "0.16em",
      whiteSpace: "pre",
      color,
      opacity: block.alpha * opacity,
    }}
  >
    {block.rows.map((row, y) => {
      if (!row.some((token) => token.flicker >= 0)) {
        return <div key={y}>{row.map((t) => t.text).join(" ")}</div>;
      }
      return (
        <div key={y}>
          {row.map((token, x) => (
            <span
              key={x}
              style={{ opacity: tokenLit(token.flicker, frame) ? 1 : 0.28 }}
            >
              {x === 0 ? token.text : ` ${token.text}`}
            </span>
          ))}
        </div>
      );
    })}
  </div>
);

/** A loose block, parked at its own spot on the plane. */
export const HexBlock: React.FC<{
  block: Block;
  frame: number;
  width: number;
  color: string;
  opacity: number;
}> = (props) => (
  <div
    style={{
      position: "absolute",
      left: props.block.x * props.width,
      top: props.block.y * props.width,
      transform: "translate(-50%, -50%)",
    }}
  >
    <HexRows {...props} />
  </div>
);
