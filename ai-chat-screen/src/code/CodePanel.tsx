import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { CODE_TYPE_START, PROMPT_TYPE_END, PROMPT_TYPE_START } from "../constants";
import { MONO_ADVANCE, MONO_FAMILY, SANS_FAMILY } from "../fonts";
import type { Layout } from "../layout";
import { GUTTER_BG, SYNTAX } from "../theme";
import { CODE_LINES } from "./highlight";
import { caretOpacity, lineOpacity, revealedLineCount, scrollInLines } from "./schedule";
import { PROMPT_LINE } from "./source";

type CodePanelProps = {
  layout: Layout;
  caretColor: string;
};

export const CodePanel: React.FC<CodePanelProps> = ({ layout, caretColor }) => {
  const frame = useCurrentFrame();
  const {
    codeLeft,
    codeTop,
    codeBottom,
    fontSize,
    lineHeight,
    gutterWidth,
    sidebarVisible,
    visibleLines,
    promptTop,
    promptFontSize,
    width,
  } = layout;

  const revealed = revealedLineCount(frame);
  // One line of breathing room below the caret, so the last line never
  // sits inside the bottom fade.
  const scrollPx = scrollInLines(frame, visibleLines - 1) * lineHeight;

  const promptChars = Math.floor(
    interpolate(frame, [PROMPT_TYPE_START, PROMPT_TYPE_END], [0, PROMPT_LINE.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const promptText = PROMPT_LINE.slice(0, promptChars);

  // The caret sits at the end of the newest line that has actually
  // faded in, so it never runs ahead of the text it belongs to.
  let caretIndex = revealed - 1;
  if (caretIndex > 0 && lineOpacity(caretIndex, frame) < 0.5) caretIndex -= 1;
  const caretLine = caretIndex >= 0 ? CODE_LINES[caretIndex] : null;
  const caretX = codeLeft + (caretLine?.length ?? 0) * MONO_ADVANCE * fontSize;
  const caretY = codeTop + caretIndex * lineHeight - scrollPx;
  const caretVisible = frame >= CODE_TYPE_START && revealed > 0;

  // The top edge only fades once there is something scrolled off above
  // it; before that, line 1 is simply the first line and stays solid.
  const topFade = Math.min(lineHeight * 0.85, scrollPx);
  const fadeMask =
    `linear-gradient(to bottom, transparent 0px, #000 ${topFade}px, ` +
    `#000 calc(100% - ${lineHeight * 1.15}px), transparent 100%)`;

  return (
    <>
      {/* Gutter — a narrow dim strip carrying line numbers, scrolling in
          lockstep with the code it belongs to. */}
      <div
        style={{
          position: "absolute",
          left: sidebarVisible,
          top: 0,
          width: gutterWidth,
          height: "100%",
          backgroundColor: GUTTER_BG,
        }}
      />

      {/* Prompt line, set in a lighter weight above the code. */}
      <div
        style={{
          position: "absolute",
          left: codeLeft,
          top: promptTop,
          fontFamily: `${SANS_FAMILY}, system-ui, sans-serif`,
          fontWeight: 300,
          fontSize: promptFontSize,
          letterSpacing: promptFontSize * 0.005,
          color: "#8b949e",
          whiteSpace: "pre",
        }}
      >
        {promptText}
        <span
          style={{
            opacity: frame < CODE_TYPE_START && frame % 30 < 17 ? 0.85 : 0,
            color: caretColor,
          }}
        >
          |
        </span>
      </div>

      {/* Clipped viewport. Lines that have not landed yet are simply not
          rendered — the highlighting behind them was computed once. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: codeTop,
          width,
          height: codeBottom - codeTop,
          overflow: "hidden",
          // Masked rather than covered by opaque strips: lines fade in
          // and out at the viewport edges without hiding the screen glow
          // behind them.
          maskImage: fadeMask,
          WebkitMaskImage: fadeMask,
        }}
      >
        <div style={{ transform: `translateY(${-scrollPx}px)` }}>
          {CODE_LINES.slice(0, revealed).map((line, index) => (
            <div
              key={index}
              style={{
                position: "absolute",
                left: 0,
                top: index * lineHeight,
                height: lineHeight,
                width,
                opacity: lineOpacity(index, frame),
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: sidebarVisible,
                  width: gutterWidth - fontSize * 0.5,
                  textAlign: "right",
                  fontFamily: `${MONO_FAMILY}, monospace`,
                  fontSize: fontSize * 0.86,
                  lineHeight: `${lineHeight}px`,
                  color: "#454e5c",
                }}
              >
                {index + 1}
              </span>
              <span
                style={{
                  position: "absolute",
                  left: codeLeft,
                  fontFamily: `${MONO_FAMILY}, monospace`,
                  fontSize,
                  lineHeight: `${lineHeight}px`,
                  whiteSpace: "pre",
                  // `==` and `!=` must read as two characters, not as a
                  // ligature glyph — legibility beats editor authenticity.
                  fontVariantLigatures: "none",
                  color: SYNTAX.plain,
                }}
              >
                {line.spans.map((span, i) => (
                  <span key={i} style={{ color: SYNTAX[span.role] }}>
                    {span.text}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Caret. Solid while lines are landing, blinking on the hold. */}
      {caretVisible ? (
        <div
          style={{
            position: "absolute",
            left: caretX,
            top: caretY + lineHeight * 0.17,
            width: Math.max(2, Math.round(fontSize * 0.11)),
            height: lineHeight * 0.68,
            backgroundColor: caretColor,
            opacity: caretOpacity(frame),
            boxShadow: `0 0 ${fontSize * 0.5}px ${caretColor}`,
          }}
        />
      ) : null}

    </>
  );
};
