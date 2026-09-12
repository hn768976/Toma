import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Mono } from "../primitives";
import { FONT_SANS, type Theme } from "../theme";
import type { WorkflowNode } from "../content";
import { nodeExecFrame, nodeInFrame, nodeState, T } from "../timeline";

type Props = {
  theme: Theme;
  node: WorkflowNode;
  i: number;
  orientation?: "row" | "column";
  width?: number;
  height?: number;
};

/**
 * One step in the compiled workflow. Drops in when the builder places it,
 * then lights up as the run reaches it.
 */
export const NodeCard: React.FC<Props> = ({
  theme,
  node,
  i,
  orientation = "row",
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = nodeState(i, frame);

  const enter = spring({
    frame: frame - nodeInFrame(i),
    fps,
    config: { damping: 200, mass: 0.8 },
    durationInFrames: 22,
  });

  // Border/glow ramp as the node goes live.
  const live = interpolate(
    frame,
    [nodeExecFrame(i) - 4, nodeExecFrame(i) + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const running = state === "running";
  // Gentle breathing highlight while the step is the active one.
  const breathe = running
    ? interpolate(Math.sin(frame * 0.35), [-1, 1], [0.55, 1])
    : 1;

  const borderColor =
    live > 0
      ? theme.accent
      : state === "pending"
        ? "transparent"
        : theme.border;

  const isColumn = orientation === "column";

  const badgeText =
    node.kind === "agent" && frame >= T.buildPress && frame < T.buildDone
      ? "GENERATING WORKFLOW..."
      : node.badge;

  const badgeActive = badgeText.startsWith("GENERATING");

  return (
    <div
      style={{
        width,
        height,
        opacity: enter,
        transform: `translate${isColumn ? "Y" : "Y"}(${(1 - enter) * 14}px)`,
        background: live > 0 ? theme.cardAlt : theme.card,
        border: `1px solid ${borderColor}`,
        borderRadius: 5,
        boxShadow:
          live > 0
            ? `0 0 ${18 * live * breathe}px ${theme.accentGlow}, inset 0 0 0 1px ${theme.accentDim}`
            : "none",
        display: "flex",
        flexDirection: isColumn ? "column" : "row",
        alignItems: isColumn ? "stretch" : "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Progress wipe across the card while the step runs. */}
      {running ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, ${theme.accentDim} 0%, transparent 70%)`,
            opacity: interpolate(
              frame - nodeExecFrame(i),
              [0, T.execStagger],
              [0.9, 0],
              { extrapolateRight: "clamp" },
            ),
          }}
        />
      ) : null}

      <div
        style={{
          width: isColumn ? "auto" : 52,
          height: isColumn ? 34 : "100%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: isColumn ? "space-between" : "center",
          padding: isColumn ? "0 14px" : 0,
          borderRight: isColumn ? "none" : `1px solid ${theme.border}`,
          borderBottom: isColumn ? `1px solid ${theme.border}` : "none",
          position: "relative",
        }}
      >
        <Mono color={live > 0 ? theme.accent : theme.textFaint} size={11}>
          {node.index}
        </Mono>
        {isColumn ? (
          <Mono
            color={badgeActive || live > 0 ? theme.accent : theme.textFaint}
            size={9}
          >
            {node.badge}
          </Mono>
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          padding: isColumn ? "16px 14px" : "0 22px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          justifyContent: "center",
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: FONT_SANS,
            fontSize: isColumn ? 16 : 21,
            fontWeight: 500,
            color: theme.text,
            letterSpacing: 0.2,
            lineHeight: 1.2,
          }}
        >
          {node.title}
        </span>
        <Mono color={theme.textFaint} size={isColumn ? 8.5 : 9.5}>
          {node.subtitle}
        </Mono>
      </div>

      {!isColumn ? (
        <div style={{ paddingRight: 18, flexShrink: 0 }}>
          <div
            style={{
              height: 22,
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              borderRadius: 2,
              border: `1px solid ${badgeActive ? theme.accent : theme.border}`,
              background: badgeActive ? theme.accentDim : "transparent",
            }}
          >
            <Mono
              color={badgeActive ? theme.accentSoft : theme.textFaint}
              size={9}
            >
              {badgeText}
            </Mono>
          </div>
        </div>
      ) : null}

      {/* Column cards get a per-step meter in place of the row badge. */}
      {isColumn ? (
        <div
          style={{
            padding: "0 14px 13px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              height: 2,
              background: theme.bar,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${interpolate(
                  frame,
                  [nodeExecFrame(i), nodeExecFrame(i) + T.execStagger],
                  [0, 100],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                )}%`,
                height: "100%",
                background: theme.accent,
              }}
            />
          </div>
          <Mono
            color={live > 0 ? theme.accentSoft : theme.textFaint}
            size={8.5}
          >
            {state === "done"
              ? "COMPLETE"
              : state === "running"
                ? "RUNNING"
                : "QUEUED"}
          </Mono>
        </div>
      ) : null}

      {/* Corner tick that fills once the step is done. */}
      <div
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          width: 5,
          height: 5,
          background: state === "done" ? theme.accent : "transparent",
          border: `1px solid ${live > 0 ? theme.accent : theme.border}`,
          opacity: state === "pending" ? 0 : 1,
        }}
      />
    </div>
  );
};
