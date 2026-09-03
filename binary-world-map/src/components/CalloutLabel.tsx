import React from "react";
import {CONFIG} from "../config";
import {MONO_FONT_FAMILY} from "../fonts";
import {withAlpha} from "../lib/color";
import type {Callout, Node} from "../scene/geometry";
import {calloutHeader, calloutLine} from "../scene/geometry";
import type {Theme} from "../theme";

/**
 * A small block of deliberately illegible technical text with a thin leader
 * line pointing at a nearby node. Some blocks are a single line, some run to
 * four to six; two of them carry a large two-digit number set much larger than
 * the surrounding type.
 *
 * The content is invented — made-up subsystem names and arbitrary four-field
 * group numbers, never real place names and never coordinates that resolve
 * anywhere. It rerolls on a slow per-callout epoch derived from the frame.
 */
export const CalloutLabel: React.FC<{
  callout: Callout;
  index: number;
  node: Node;
  theme: Theme;
  frame: number;
}> = ({callout, index, node, theme, frame}) => {
  const {fontSize, lineHeight, bigNumberSize, rerollPeriod} = CONFIG.callouts;
  const epoch = Math.floor((frame + index * 23) / rerollPeriod);

  const blockWidth = 300;
  // Leader: a short horizontal stub out of the text block, then a straight run
  // to the node. Reads as a technical callout rather than a curve.
  const anchorX = callout.side === 1 ? callout.x - 16 : callout.x + blockWidth + 16;
  const anchorY = callout.y - fontSize * 0.9;
  const elbowX = anchorX + (callout.side === 1 ? -54 : 54);

  const pale = withAlpha(theme.textPale, 0.82);
  const faint = withAlpha(theme.textPale, 0.5);

  const lines: string[] = [];
  for (let i = 0; i < callout.lineCount; i++) {
    lines.push(calloutLine(callout.bodySeed, i, epoch));
  }

  return (
    <g>
      <polyline
        points={`${anchorX},${anchorY} ${elbowX},${anchorY} ${node.x},${node.y}`}
        fill="none"
        stroke={withAlpha(theme.connectLine, 0.3)}
        strokeWidth={1.6}
      />
      <rect
        x={anchorX + (callout.side === 1 ? -22 : 14)}
        y={anchorY - 8}
        width={16}
        height={16}
        fill="none"
        stroke={withAlpha(theme.connectLine, 0.3)}
        strokeWidth={1.4}
      />

      <text
        x={callout.x}
        y={callout.y}
        fill={pale}
        fontFamily={MONO_FONT_FAMILY}
        fontSize={fontSize}
        letterSpacing={1.6}
      >
        {calloutHeader(callout.headerSeed, epoch)}
      </text>
      <line
        x1={callout.x}
        y1={callout.y + 7}
        x2={callout.x + blockWidth}
        y2={callout.y + 7}
        stroke={withAlpha(theme.textPale, 0.24)}
        strokeWidth={1.2}
      />

      {lines.map((text, i) => (
        <text
          key={i}
          x={callout.x}
          y={callout.y + lineHeight * (i + 1.55)}
          fill={faint}
          fontFamily={MONO_FONT_FAMILY}
          fontSize={fontSize}
        >
          {text}
        </text>
      ))}

      {callout.bigNumber ? (
        <text
          x={callout.x + blockWidth + 34}
          y={callout.y + bigNumberSize * 0.55}
          fill={withAlpha(theme.textPale, 0.9)}
          fontFamily={MONO_FONT_FAMILY}
          fontSize={bigNumberSize}
          letterSpacing={2}
        >
          {callout.bigNumber}
        </text>
      ) : null}
    </g>
  );
};
