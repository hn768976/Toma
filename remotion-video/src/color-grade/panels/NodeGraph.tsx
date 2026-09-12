import React from "react";
import { UI } from "../constants";
import type { Grade } from "../grade";
import { gradedSwatch } from "./PreviewMonitor";

type NodeDef = {
  id: number;
  label: string;
  x: number;
  y: number;
  /** How much of the grade this node contributes, for its thumbnail. */
  mix: number;
};

type Props = {
  width: number;
  height: number;
  grade: Grade;
  frame: number;
  /** Which node is currently selected (1-based). */
  selected: number;
  title?: string;
};

const NODES: NodeDef[] = [
  { id: 1, label: "Balance", x: 0.06, y: 0.3, mix: 0.25 },
  { id: 2, label: "Primary", x: 0.37, y: 0.14, mix: 0.65 },
  { id: 3, label: "Look", x: 0.37, y: 0.58, mix: 1 },
  { id: 4, label: "Output", x: 0.68, y: 0.36, mix: 1 },
];

const LINKS: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
];

// Node tree. Each node carries a live thumbnail of the shot as it looks
// at that point in the chain, so the graph visibly reflects the grade
// instead of being decorative boxes.
export const NodeGraph: React.FC<Props> = ({
  width,
  height,
  grade,
  frame,
  selected,
  title = "Nodes",
}) => {
  const headerH = height * 0.13;
  const nodeW = width * 0.23;
  const nodeH = nodeW * 0.62;
  const bodyTop = headerH + height * 0.06;
  const bodyH = height - bodyTop - height * 0.07;

  const posOf = (n: NodeDef) => ({
    left: n.x * width,
    top: bodyTop + n.y * bodyH,
  });

  return (
    <div
      style={{
        width,
        height,
        background: UI.panel,
        border: `1px solid ${UI.edgeLine}`,
        borderRadius: height * 0.03,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          height: headerH,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${width * 0.028}px`,
          background: "linear-gradient(#1e2b39, #16202b)",
          borderBottom: `1px solid ${UI.edgeLine}`,
        }}
      >
        <span style={{ fontSize: headerH * 0.42, color: UI.text }}>{title}</span>
        <span style={{ fontSize: headerH * 0.36, color: UI.textDim }}>
          {NODES.length} nodes
        </span>
      </div>

      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {LINKS.map(([a, b], i) => {
          const na = NODES.find((n) => n.id === a)!;
          const nb = NODES.find((n) => n.id === b)!;
          const pa = posOf(na);
          const pb = posOf(nb);
          const x1 = pa.left + nodeW;
          const y1 = pa.top + nodeH / 2;
          const x2 = pb.left;
          const y2 = pb.top + nodeH / 2;
          const midX = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="rgba(150,195,225,0.45)"
              strokeWidth={1.4}
            />
          );
        })}
      </svg>

      {NODES.map((n) => {
        const p = posOf(n);
        const isSel = n.id === selected;
        return (
          <div
            key={n.id}
            style={{
              position: "absolute",
              left: p.left,
              top: p.top,
              width: nodeW,
              height: nodeH,
              borderRadius: nodeH * 0.08,
              overflow: "hidden",
              background: "#0a1017",
              border: `${isSel ? 2 : 1}px solid ${
                isSel ? UI.selection : UI.edgeLine
              }`,
              boxShadow: isSel
                ? `0 0 ${nodeH * 0.28}px rgba(240,160,60,0.45)`
                : `0 ${nodeH * 0.04}px ${nodeH * 0.12}px rgba(0,0,0,0.6)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                // Offsetting the frame per node means each thumbnail is a
                // slightly different moment of the shot, so the tree reads
                // as four separate previews rather than four copies.
                background: gradedSwatch(grade, frame + n.id * 113, n.mix),
                filter: `brightness(${isSel ? 0.62 : 0.42}) saturate(0.8)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: nodeH * 0.07,
                top: nodeH * 0.05,
                fontSize: nodeH * 0.18,
                color: "#dfeaf3",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              {String(n.id).padStart(2, "0")}
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: `${nodeH * 0.05}px ${nodeH * 0.08}px`,
                fontSize: nodeH * 0.17,
                color: isSel ? UI.textBright : UI.text,
                background: "linear-gradient(rgba(8,13,19,0), rgba(8,13,19,0.92))",
              }}
            >
              {n.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
