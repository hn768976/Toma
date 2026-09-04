import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import type { Content } from "../content/types";
import { FONT_MONO, FONT_UI } from "../fonts";
import type { HLine } from "../highlight";
import { T } from "../layout";
import type { Theme } from "../theme";
import { Blob } from "./Blob";
import { DotsGlyph, PaperclipGlyph, SendGlyph, SparkGlyph } from "./Icons";

const RISE = 8;

const useEnter = (start: number, duration = 14) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [start, start + duration], [RISE, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, transform: `translateY(${y}px)` };
};

const UserMessage: React.FC<{ theme: Theme; start: number; text: string }> = ({
  theme,
  start,
  text,
}) => {
  const enter = useEnter(start);
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", ...enter }}>
      <div
        style={{
          maxWidth: "88%",
          background: theme.bubbleUser,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          borderTopRightRadius: 3,
          padding: "9px 12px",
          fontSize: 12.5,
          lineHeight: "18px",
          color: theme.code,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const CodeBlock: React.FC<{ theme: Theme; lines: HLine[]; opacity: number }> = ({
  theme,
  lines,
  opacity,
}) => (
  <div
    style={{
      opacity,
      marginTop: 9,
      background: theme.codeBlock,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      padding: "9px 11px",
      fontFamily: FONT_MONO,
      fontSize: 11,
      lineHeight: "17px",
    }}
  >
    {lines.map((line, index) => (
      <div key={index} style={{ whiteSpace: "pre", color: theme.syn.plain }}>
        {line.length === 0 ? " " : null}
        {line.map((span, spanIndex) => (
          <span key={spanIndex} style={{ color: theme.syn[span.key] }}>
            {span.text}
          </span>
        ))}
      </div>
    ))}
  </div>
);

const AssistantMessage: React.FC<{
  theme: Theme;
  content: Content;
  codeLines: HLine[];
}> = ({ theme, content, codeLines }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(T.chat2, 12);

  const full = content.chat.reply.join("\n");
  const shown = Math.round(
    interpolate(frame, [T.chat2 + 6, T.chat2TypeEnd], [0, full.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const typed = full.slice(0, shown).split("\n");

  const codeOpacity = interpolate(frame, [T.chat2Code, T.chat2CodeEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={enter}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: `linear-gradient(140deg, #22d3ee, #c026d3)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SparkGlyph size={11} color="#ffffff" />
        </div>
        <span style={{ fontSize: 11, color: theme.chromeDim, letterSpacing: 0.2 }}>
          Assistant
        </span>
      </div>

      <div
        style={{
          background: theme.bubbleAi,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          borderTopLeftRadius: 3,
          padding: "10px 12px",
        }}
      >
        <div style={{ fontSize: 12.5, lineHeight: "18px", color: theme.code, minHeight: 36 }}>
          {typed.map((line, index) => (
            <div key={index}>{line || " "}</div>
          ))}
        </div>
        {codeOpacity > 0 ? (
          <CodeBlock theme={theme} lines={codeLines} opacity={codeOpacity} />
        ) : null}
      </div>
    </div>
  );
};

export const Assistant: React.FC<{
  theme: Theme;
  content: Content;
  replyCodeLines: HLine[];
  width: number;
}> = ({ theme, content, replyCodeLines, width }) => {
  const canvasW = width - 24;
  const canvasH = 190;

  return (
    <div
      style={{
        background: theme.panel,
        borderLeft: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_UI,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              background: theme.ok,
              boxShadow: `0 0 7px ${theme.ok}`,
            }}
          />
          <span style={{ fontSize: 12, color: theme.code, fontWeight: 500 }}>
            AI Assistance
          </span>
        </div>
        <DotsGlyph size={13} color={theme.chromeDim} />
      </div>

      <div
        style={{
          margin: 12,
          height: canvasH,
          borderRadius: 10,
          background: theme.blobCanvas,
          border: `1px solid ${theme.id === "dark" ? theme.border : "#c3cbd4"}`,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <Blob width={canvasW} height={canvasH} uid={content.id} />
      </div>

      <div
        style={{
          flex: 1,
          padding: "6px 14px 2px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflow: "hidden",
        }}
      >
        <UserMessage theme={theme} start={T.chat1} text={content.chat.first} />
        <AssistantMessage theme={theme} content={content} codeLines={replyCodeLines} />
        <UserMessage theme={theme} start={T.chat3} text={content.chat.follow} />
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${theme.border}` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 38,
            padding: "0 8px 0 12px",
            borderRadius: 9,
            background: theme.field,
            border: `1px solid ${theme.border}`,
          }}
        >
          <span style={{ flex: 1, fontSize: 12.5, color: theme.chromeDim }}>
            Ask anything…
          </span>
          <PaperclipGlyph size={14} color={theme.chromeDim} />
          <SparkGlyph size={14} color={theme.chromeDim} />
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: theme.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SendGlyph size={14} color={theme.onAccent} />
          </div>
        </div>
      </div>
    </div>
  );
};
