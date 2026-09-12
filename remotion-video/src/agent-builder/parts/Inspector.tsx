import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Mono } from "../primitives";
import { FONT_SANS, type Theme } from "../theme";
import { NODES, PROPERTIES } from "../content";
import {
  agentStatus,
  nodeExecFrame,
  nodeInFrame,
  nodeState,
  placedNodeCount,
  T,
} from "../timeline";

/** Key/value rows that fill in as the workflow compiles. */
export const PropertyRows: React.FC<{
  theme: Theme;
  direction?: "column" | "row";
  compact?: boolean;
}> = ({ theme, direction = "column", compact = false }) => {
  const frame = useCurrentFrame();
  const placed = placedNodeCount(frame);

  const values: Record<string, string> = {
    Purpose: frame >= T.firstNode ? "Document Processing" : "",
    Tools: placed >= 4 ? "3" : "",
    "Workflow Steps": placed > 0 ? String(placed) : "",
    "Approval Required": placed >= 5 ? "Yes" : "",
    Status: agentStatus(frame),
  };

  const rows = [...PROPERTIES, { label: "Status", value: "" }];
  const isRow = direction === "row";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap: isRow ? 0 : 0,
        flex: isRow ? 1 : undefined,
      }}
    >
      {rows.map((p, i) => {
        const value = values[p.label] ?? "";
        const isStatus = p.label === "Status";
        return (
          <div
            key={p.label}
            style={{
              flex: isRow ? 1 : undefined,
              display: "flex",
              flexDirection: isRow ? "column" : "row",
              alignItems: isRow ? "flex-start" : "center",
              justifyContent: "space-between",
              gap: isRow ? 8 : 12,
              padding: isRow ? "0 20px" : compact ? "10px 0" : "15px 0",
              borderBottom: isRow ? "none" : `1px solid ${theme.border}`,
              borderRight:
                isRow && i < rows.length - 1
                  ? `1px solid ${theme.border}`
                  : "none",
            }}
          >
            <span
              style={{
                fontFamily: FONT_SANS,
                fontSize: compact ? 12.5 : 13,
                color: theme.textDim,
                fontWeight: 400,
              }}
            >
              {p.label}
            </span>
            <Mono
              color={isStatus && value ? theme.accent : theme.text}
              size={10}
              style={{ opacity: value ? 1 : 0 }}
            >
              {value || "—"}
            </Mono>
          </div>
        );
      })}
    </div>
  );
};

/** Execution checklist: IDLE → RUN → DONE, with a fill meter per row. */
export const ExecutionList: React.FC<{
  theme: Theme;
  compact?: boolean;
  columns?: number;
}> = ({ theme, compact = false, columns = 1 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={
        columns > 1
          ? {
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gridAutoFlow: "column",
              gridTemplateRows: `repeat(${Math.ceil(
                NODES.length / columns,
              )}, auto)`,
              columnGap: 34,
            }
          : { display: "flex", flexDirection: "column" }
      }
    >
      {NODES.map((node, i) => {
        const state = nodeState(i, frame);
        const known = frame >= nodeInFrame(i);
        const label =
          state === "done" ? "DONE" : state === "running" ? "RUN" : "IDLE";
        const fill = interpolate(
          frame,
          [nodeExecFrame(i), nodeExecFrame(i) + T.execStagger],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <div
            key={node.index}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: compact ? "10px 0" : "13px 0",
              borderBottom: `1px solid ${theme.border}`,
              opacity: known ? 1 : 0.4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                flexShrink: 0,
                borderRadius: 1,
                background:
                  state === "done" || state === "running"
                    ? theme.accent
                    : "transparent",
                border: `1px solid ${
                  known ? theme.borderStrong : theme.border
                }`,
              }}
            />
            <span
              style={{
                flex: 1,
                fontFamily: FONT_SANS,
                fontSize: 12.5,
                color: known ? theme.text : theme.textFaint,
              }}
            >
              {node.title}
            </span>
            <Mono
              color={state === "pending" ? theme.textFaint : theme.textDim}
              size={9}
            >
              {label}
            </Mono>
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: -1,
                height: 1,
                width: `${fill * 100}%`,
                background: theme.accent,
                opacity: 0.8,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
