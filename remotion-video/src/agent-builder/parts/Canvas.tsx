import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { GridBackdrop, Mono } from "../primitives";
import type { Theme } from "../theme";
import { NODES } from "../content";
import { nodeExecFrame, nodeInFrame, placedNodeCount, T } from "../timeline";
import { NodeCard } from "./NodeCard";

/** Connector between two steps, drawn as it is created. */
const Connector: React.FC<{
  theme: Theme;
  i: number;
  vertical: boolean;
  length: number;
}> = ({ theme, i, vertical, length }) => {
  const frame = useCurrentFrame();
  // The edge draws just before the node it feeds lands.
  const start = nodeInFrame(i + 1) - 10;
  const draw = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Packet travels the edge while the upstream step is running.
  const exec = nodeExecFrame(i) + T.execStagger * 0.55;
  const travel = interpolate(frame, [exec, exec + T.execStagger], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const packetVisible = travel > 0 && travel < 1;
  const lit = frame >= nodeExecFrame(i + 1);

  return (
    <div
      style={{
        position: "relative",
        width: vertical ? 1 : length,
        height: vertical ? length : 1,
        background: lit ? theme.accentDim : theme.border,
        transform: vertical ? `scaleY(${draw})` : `scaleX(${draw})`,
        transformOrigin: vertical ? "top" : "left",
        flexShrink: 0,
      }}
    >
      {packetVisible ? (
        <div
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            background: theme.accent,
            boxShadow: `0 0 10px ${theme.accentGlow}`,
            left: vertical ? -2.5 : `${travel * 100}%`,
            top: vertical ? `${travel * 100}%` : -2.5,
          }}
        />
      ) : null}
    </div>
  );
};

/** Reference layout: steps stacked top-to-bottom on a gridded canvas. */
export const VerticalCanvas: React.FC<{
  theme: Theme;
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
}> = ({ theme, cardWidth = 560, cardHeight = 74, gap = 26 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Anchored to the top: the stack grows downward as steps are added
        // rather than re-centring and nudging placed cards around.
        justifyContent: "flex-start",
        paddingTop: 22,
        overflow: "hidden",
      }}
    >
      <GridBackdrop theme={theme} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        {NODES.map((node, i) => (
          <React.Fragment key={node.index}>
            <NodeCard
              theme={theme}
              node={node}
              i={i}
              orientation="row"
              width={cardWidth}
              height={cardHeight}
            />
            {i < NODES.length - 1 ? (
              <Connector theme={theme} i={i} vertical length={gap} />
            ) : null}
          </React.Fragment>
        ))}
      </div>
      <CanvasStats theme={theme} frame={frame} />
    </div>
  );
};

/** Alternate layout: steps flow left-to-right in a single lane. */
export const HorizontalCanvas: React.FC<{
  theme: Theme;
  cardWidth?: number;
  cardHeight?: number;
  gap?: number;
}> = ({ theme, cardWidth = 248, cardHeight = 128, gap = 32 }) => (
  <div
    style={{
      position: "relative",
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    <GridBackdrop theme={theme} size={34} />
    <div style={{ display: "flex", alignItems: "center" }}>
      {NODES.map((node, i) => (
        <React.Fragment key={node.index}>
          <NodeCard
            theme={theme}
            node={node}
            i={i}
            orientation="column"
            width={cardWidth}
            height={cardHeight}
          />
          {i < NODES.length - 1 ? (
            <Connector theme={theme} i={i} vertical={false} length={gap} />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  </div>
);

/** "NODES 6 · EDGES 5 · GRID 48" readout in the canvas header. */
export const CanvasMeta: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const n = placedNodeCount(frame);
  return (
    <Mono color={theme.textFaint} size={10}>
      NODES {n} · EDGES {Math.max(0, n - 1)} · GRID 48
    </Mono>
  );
};

const CanvasStats: React.FC<{ theme: Theme; frame: number }> = ({
  theme,
  frame,
}) => (
  <div
    style={{
      position: "absolute",
      left: 20,
      bottom: 16,
      display: "flex",
      gap: 18,
      opacity: frame >= T.buildPress ? 0.9 : 0,
    }}
  >
    <Mono color={theme.textFaint} size={9}>
      AUTO-LAYOUT
    </Mono>
    <Mono color={theme.textFaint} size={9}>
      SNAP ON
    </Mono>
  </div>
);
