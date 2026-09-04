import React from "react";
import { useCurrentFrame } from "remotion";
import { CODE_LINES, sliceTokens, type TokenKind } from "../code";
import { useU } from "../layout";
import { MONO } from "../load-fonts";
import type { Theme } from "../theme";

/**
 * The centre panel: the only high-contrast element on the screen.
 *
 * The listing was tokenised once at module load. Here we only decide how
 * many characters of each line are on screen yet, so a frame costs a
 * slice, not a re-highlight.
 */
export const CodePanel: React.FC<{ theme: Theme; scale: number }> = ({
  theme,
  scale,
}) => {
  const frame = useCurrentFrame();
  const u = useU();

  const fs = u(scale);
  const lineH = fs * 1.5;

  const colour = (kind: TokenKind) => theme.syntax[kind];

  // The line currently being typed, if any — the cursor rides it, and
  // stays solid while it moves.
  const activeIndex = CODE_LINES.findIndex(
    (l) => frame >= l.start && frame < l.end,
  );
  const lastStarted = CODE_LINES.reduce(
    (acc, l, i) => (frame >= l.start ? i : acc),
    -1,
  );
  // Before the first line lands the cursor waits, blinking, on line 0 —
  // otherwise the panel sits as an empty box between frames 40 and 120.
  const cursorLine = activeIndex >= 0 ? activeIndex : Math.max(0, lastStarted);
  const blinkOn = activeIndex >= 0 || Math.floor(frame / 16) % 2 === 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: theme.codeBg,
        padding: `${fs * 0.8}px ${fs * 1.1}px`,
        fontFamily: MONO,
        // Ligatures would fuse "===" into a glyph nobody types.
        fontVariantLigatures: "none",
        fontSize: fs,
        lineHeight: `${lineH}px`,
        // Screen glow: the panel is the light source on this desk.
        boxShadow: `inset 0 0 ${u(0.06)}px ${theme.glow}`,
        textShadow: `0 0 ${u(0.006)}px ${theme.glow}`,
      }}
    >
      {CODE_LINES.map((line, i) => {
        const chars =
          frame >= line.end
            ? line.length
            : frame <= line.start
              ? 0
              : Math.floor(
                  ((frame - line.start) / (line.end - line.start)) *
                    line.length,
                );
        const tokens = sliceTokens(line.tokens, chars);
        const showCursor = i === cursorLine && blinkOn;
        return (
          <div
            key={i}
            style={{
              height: lineH,
              whiteSpace: "pre",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span>
              {tokens.map((t, j) => (
                <span
                  key={j}
                  style={{
                    color: colour(t.kind),
                    fontWeight: t.kind === "keyword" ? 700 : 400,
                  }}
                >
                  {t.text}
                </span>
              ))}
            </span>
            {showCursor ? (
              <span
                style={{
                  display: "inline-block",
                  width: fs * 0.58,
                  height: fs * 1.06,
                  background: theme.bright,
                  opacity: 0.85,
                  marginLeft: fs * 0.06,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
