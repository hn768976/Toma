import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Caret, Mono } from "../primitives";
import { FONT_SANS, type Theme } from "../theme";
import { INTENTS, PROMPT } from "../content";
import { buildButtonLabel, T, typedChars, typedText } from "../timeline";

/** The prompt textarea: typing, char counter and fill meter. */
export const PromptBox: React.FC<{
  theme: Theme;
  height?: number;
  fontSize?: number;
}> = ({ theme, height = 176, fontSize = 21 }) => {
  const frame = useCurrentFrame();
  const text = typedText(frame);
  const chars = typedChars(frame);
  const typing = frame >= T.typeStart && frame < T.typeEnd;
  const focus = interpolate(frame, [T.typeStart - 8, T.typeStart + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.border}`,
        boxShadow: `inset 0 0 0 1px ${
          focus > 0.5 ? theme.accentDim : "transparent"
        }`,
        borderRadius: 5,
        padding: "14px 20px 16px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Mono color={theme.textFaint} size={10}>
          PROMPT
        </Mono>
        <Mono color={theme.textFaint} size={10}>
          NL → WORKFLOW
        </Mono>
      </div>

      <div
        style={{
          flex: 1,
          height,
          paddingTop: 18,
          fontFamily: FONT_SANS,
          fontSize,
          lineHeight: 1.62,
          color: theme.text,
          fontWeight: 400,
        }}
      >
        {text}
        <Caret theme={theme} active={typing} height={fontSize} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Mono color={theme.textFaint} size={10}>
          {chars} / {PROMPT.length} CHARS
        </Mono>
        <div
          style={{
            width: 128,
            height: 2,
            background: theme.bar,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(chars / PROMPT.length) * 100}%`,
              height: "100%",
              background: theme.accent,
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Primary action button; presses in at T.buildPress and latches on. */
export const BuildButton: React.FC<{ theme: Theme; width?: number }> = ({
  theme,
  width = 200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const armed = frame >= T.buildPress;

  const press = spring({
    frame: frame - T.buildPress,
    fps,
    config: { damping: 12, mass: 0.4 },
    durationInFrames: 18,
  });
  const scale = armed ? 1 - 0.04 * Math.sin(press * Math.PI) : 1;

  return (
    <div
      style={{
        width,
        height: 46,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        transform: `scale(${scale})`,
        background: armed ? theme.accentDim : theme.card,
        border: `1px solid ${armed ? theme.accent : theme.borderStrong}`,
        boxShadow: armed ? `0 0 22px ${theme.accentGlow}` : "none",
      }}
    >
      <Mono
        color={armed ? theme.accentSoft : theme.text}
        size={13}
        weight={500}
      >
        {buildButtonLabel(frame)}
      </Mono>
    </div>
  );
};

/** Intent chips, each revealed when its phrase finishes typing. */
export const IntentChips: React.FC<{
  theme: Theme;
  columns?: number;
  chipWidth?: number;
}> = ({ theme, columns = 2, chipWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = typedChars(frame);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, ${
          chipWidth ? `${chipWidth}px` : "1fr"
        })`,
        gap: 10,
      }}
    >
      {INTENTS.map((intent) => {
        const reached = chars >= intent.atChar;
        const appearFrame = interpolate(
          intent.atChar,
          [0, PROMPT.length],
          [T.typeStart, T.typeEnd],
        );
        const t = spring({
          frame: frame - appearFrame,
          fps,
          config: { damping: 200 },
          durationInFrames: 14,
        });
        return (
          <div
            key={intent.label}
            style={{
              height: 30,
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "0 13px",
              borderRadius: 3,
              background: theme.card,
              border: `1px solid ${reached ? theme.border : "transparent"}`,
              opacity: reached ? t : 0.12,
              transform: `translateY(${(1 - (reached ? t : 1)) * 6}px)`,
            }}
          >
            <Mono color={theme.accent} size={11}>
              +
            </Mono>
            <Mono color={reached ? theme.textDim : theme.textFaint} size={10}>
              {intent.label}
            </Mono>
          </div>
        );
      })}
    </div>
  );
};
