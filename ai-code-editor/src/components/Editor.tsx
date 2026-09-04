import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

import type { Content } from "../content/types";
import { FONT_MONO, FONT_UI, MONO_ADVANCE } from "../fonts";
import type { HLine } from "../highlight";
import { lineText } from "../highlight";
import {
  CODE_AREA_H,
  CODE_LINE_H,
  CODE_PAD_TOP,
  CODE_SIZE,
  GUTTER_W,
  T,
  TAB_STRIP_H,
  VISIBLE_LINES,
} from "../layout";
import type { Theme } from "../theme";
import { DotsGlyph, PlusGlyph, SplitGlyph, WarnGlyph } from "./Icons";

const CODE_LEFT_PAD = 14;

const TabStrip: React.FC<{ theme: Theme; content: Content }> = ({ theme, content }) => (
  <div
    style={{
      height: TAB_STRIP_H,
      display: "flex",
      alignItems: "stretch",
      justifyContent: "space-between",
      background: theme.panelAlt,
      borderBottom: `1px solid ${theme.border}`,
      fontFamily: FONT_UI,
    }}
  >
    <div style={{ display: "flex", alignItems: "stretch" }}>
      {content.tabs.map((tab) => (
        <div
          key={tab.label}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 15px",
            fontSize: 12,
            color: tab.active ? theme.code : theme.chrome,
            background: tab.active ? theme.bg : "transparent",
            borderRight: `1px solid ${theme.border}`,
          }}
        >
          {tab.active ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 2,
                background: theme.accent,
              }}
            />
          ) : null}
          <span>{tab.label}</span>
          {tab.dot ? (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: theme.chrome,
                opacity: 0.7,
              }}
            />
          ) : null}
        </div>
      ))}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 14px" }}>
      <SplitGlyph size={13} color={theme.chromeDim} />
      <PlusGlyph size={13} color={theme.chromeDim} />
      <DotsGlyph size={13} color={theme.chromeDim} />
    </div>
  </div>
);

export const CodeArea: React.FC<{
  theme: Theme;
  lines: HLine[];
}> = ({ theme, lines }) => {
  const frame = useCurrentFrame();

  const revealed = Math.min(
    lines.length,
    Math.max(
      0,
      Math.floor(
        interpolate(frame, [T.typeStart, T.typeEnd], [0, lines.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    ),
  );

  // The file is a dozen lines taller than the viewport; the editor eases down
  // once the tail has been written, the way someone would nudge it into view.
  const overflow = Math.max(0, lines.length - VISIBLE_LINES);
  const scroll = interpolate(
    frame,
    [T.scrollStart, T.scrollEnd],
    [0, overflow * CODE_LINE_H],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  );

  const caretLine = Math.max(1, revealed);
  const caretCols = revealed > 0 ? lineText(lines[revealed - 1]).length : 0;
  const caretOn = Math.floor(frame / 15) % 2 === 0;
  const caretX = GUTTER_W + CODE_LEFT_PAD + caretCols * CODE_SIZE * MONO_ADVANCE;
  const caretY = CODE_PAD_TOP + (caretLine - 1) * CODE_LINE_H;

  return (
    <div
      style={{
        height: CODE_AREA_H,
        position: "relative",
        overflow: "hidden",
        background: theme.bg,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${-scroll}px)`,
          willChange: "transform",
        }}
      >
        <div style={{ paddingTop: CODE_PAD_TOP }}>
          {lines.slice(0, revealed).map((line, index) => {
            const isCaretLine = index === revealed - 1;
            return (
              <div
                key={index}
                style={{
                  height: CODE_LINE_H,
                  display: "flex",
                  alignItems: "center",
                  background: isCaretLine ? theme.activeLine : "transparent",
                }}
              >
                <span
                  style={{
                    width: GUTTER_W,
                    flexShrink: 0,
                    textAlign: "right",
                    paddingRight: 12,
                    fontFamily: FONT_MONO,
                    fontSize: CODE_SIZE - 0.5,
                    color: isCaretLine ? theme.gutterActive : theme.gutter,
                  }}
                >
                  {index + 1}
                </span>
                <span
                  style={{
                    paddingLeft: CODE_LEFT_PAD,
                    fontFamily: FONT_MONO,
                    fontSize: CODE_SIZE,
                    lineHeight: `${CODE_LINE_H}px`,
                    whiteSpace: "pre",
                    color: theme.syn.plain,
                  }}
                >
                  {line.map((span, spanIndex) => (
                    <span key={spanIndex} style={{ color: theme.syn[span.key] }}>
                      {span.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: caretX,
            top: caretY + 2,
            width: 2,
            height: CODE_SIZE * 1.28,
            background: theme.accent,
            opacity: caretOn ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
};

export const EditorPane: React.FC<{
  theme: Theme;
  content: Content;
  lines: HLine[];
}> = ({ theme, content, lines }) => (
  <>
    <TabStrip theme={theme} content={content} />
    <CodeArea theme={theme} lines={lines} />
  </>
);

export const WarnPill: React.FC<{ theme: Theme; count: number }> = ({ theme, count }) =>
  count === 0 ? null : (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <WarnGlyph size={10} color={theme.badge} />
      <span style={{ color: theme.badge }}>{count}</span>
    </span>
  );
