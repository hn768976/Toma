import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, MATRIX, MONO_FONT } from "../shared/theme";
import { Panel } from "../shared/ui";
import { cubicAt, sCurve } from "../shared/paths";
import { rand, randRange, wander } from "../shared/rand";
import { EDGES, LAYOUT, NODE_H, NODE_W, NODES } from "./data";

const PANEL = LAYOUT.graph;
/** Inner plotting box, relative to the panel. */
const BOX = { x: 20, y: 46, w: PANEL.w - 40, h: PANEL.h - 66 };

const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

/** Edges leave the right face of one card and enter the left face of the next. */
const EDGE_GEOMETRY = EDGES.map(([from, to]) => {
  const a = NODE_BY_ID[from];
  const b = NODE_BY_ID[to];
  const start = { x: a.x + NODE_W / 2 - PANEL.x, y: a.y - PANEL.y };
  const end = { x: b.x - NODE_W / 2 - PANEL.x, y: b.y - PANEL.y };
  return { from, to, color: a.color, ...sCurve(start, end, 0.55) };
});

/** Ambient dots drifting behind the graph. */
const AMBIENT = Array.from({ length: 26 }, (_, i) => ({
  x: randRange(`amb-x${i}`, BOX.x, BOX.x + BOX.w),
  y: randRange(`amb-y${i}`, BOX.y, BOX.y + BOX.h),
  drift: randRange(`amb-d${i}`, 6, 22),
  phase: randRange(`amb-p${i}`, 0, Math.PI * 2),
  size: randRange(`amb-s${i}`, 1.4, 2.8),
}));

const NodeCard: React.FC<{ node: (typeof NODES)[number]; index: number }> = ({
  node,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({
    frame,
    fps,
    delay: 20 + index * 3,
    config: { damping: 200, mass: 0.55 },
  });

  // A focus sweep walks the graph left to right on a 5.2s cycle; the node it
  // lands on brightens and its underline fills.
  const cycle = 156;
  const sweep = ((frame % cycle) / cycle) * NODES.length;
  const focus = Math.max(0, 1 - Math.abs(sweep - index) / 1.4);
  const fill = wander(`node${index}`, frame / 45 + index, 42, 94, 2);
  const glow = 0.3 + 0.7 * focus;

  return (
    <div
      style={{
        position: "absolute",
        left: node.x - NODE_W / 2 - PANEL.x,
        top: node.y - NODE_H / 2 - PANEL.y,
        width: NODE_W,
        height: NODE_H,
        opacity: entry,
        transform: `scale(${interpolate(entry, [0, 1], [0.82, 1]) * (1 + focus * 0.025)})`,
        borderRadius: 7,
        background: "rgba(8, 17, 31, 0.92)",
        border: `1px solid ${alpha(node.color, 0.28 + focus * 0.5)}`,
        boxShadow: `0 0 ${10 + focus * 22}px ${alpha(node.color, 0.1 + focus * 0.3)}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -1,
          top: -1,
          width: 52,
          height: 2,
          borderRadius: 1,
          background: node.color,
          boxShadow: `0 0 7px ${alpha(node.color, glow)}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 7,
          top: 7,
          width: 4,
          height: 4,
          borderRadius: 2,
          background: alpha(node.color, 0.35 + focus * 0.65),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 11,
          top: NODE_H / 2 - 12,
          width: 15,
          height: 15,
          borderRadius: 8,
          background: `radial-gradient(circle, ${node.color} 0%, ${alpha(node.color, 0.35)} 42%, ${alpha(node.color, 0)} 72%)`,
          opacity: 0.6 + focus * 0.4,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 34,
          top: 13,
          fontFamily: DISPLAY_FONT,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 1.1,
          color: MATRIX.text,
          opacity: 0.72 + focus * 0.28,
        }}
      >
        {node.label}
      </div>
      <div
        style={{
          position: "absolute",
          left: 34,
          top: 26,
          fontFamily: MONO_FONT,
          fontSize: 7,
          letterSpacing: 0.2,
          color: MATRIX.textFaint,
        }}
      >
        {node.sub}
      </div>
      {/* Underline meter along the bottom edge of the card. */}
      <div
        style={{
          position: "absolute",
          left: 11,
          right: 11,
          bottom: 7,
          height: 1.6,
          borderRadius: 1,
          background: "rgba(90, 125, 170, 0.16)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${fill * entry}%`,
            height: "100%",
            background: node.color,
            boxShadow: `0 0 6px ${alpha(node.color, 0.8)}`,
          }}
        />
      </div>
    </div>
  );
};

export const ExecutionGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const { x, y, w, h } = PANEL;

  // Packets ride the edges. Three slots per edge, offset so the traffic reads
  // as continuous rather than pulsed.
  const packets = useMemo(() => {
    return EDGE_GEOMETRY.flatMap((e, ei) =>
      Array.from({ length: 3 }, (_, si) => ({
        edge: e,
        period: 62 + rand(`per${ei}`) * 46,
        offset: rand(`off${ei}-${si}`),
        key: `${ei}-${si}`,
      })),
    );
  }, []);

  const drawIn = interpolate(frame, [10, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Panel
      x={x}
      y={y}
      width={w}
      height={h}
      title="NEURAL WORKFLOW / LIVE EXECUTION GRAPH"
      accent={ACCENT.cyan}
      delay={3}
    >
      {/* Recessed plot area behind the graph. */}
      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          borderRadius: 5,
          background:
            "radial-gradient(120% 130% at 50% 45%, rgba(16,34,58,0.55) 0%, rgba(5,11,21,0.2) 70%)",
          border: `1px solid ${MATRIX.borderSoft}`,
        }}
      />

      <svg
        width={w}
        height={h}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {EDGE_GEOMETRY.map((e, i) => (
          <path
            key={`${e.from}-${e.to}`}
            d={e.d}
            fill="none"
            stroke={alpha("#7fb0e8", 0.22)}
            strokeWidth={1}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - Math.max(0, Math.min(1, drawIn * 1.4 - i * 0.02))}
          />
        ))}
      </svg>

      {AMBIENT.map((a, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: a.x + Math.sin(frame / 48 + a.phase) * a.drift,
            top: a.y + Math.cos(frame / 61 + a.phase) * a.drift * 0.6,
            width: a.size,
            height: a.size,
            borderRadius: a.size,
            background: alpha("#cfe4ff", 0.5),
            opacity: drawIn * (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(frame / 22 + a.phase))),
          }}
        />
      ))}

      {packets.map((p) => {
        const t = ((frame / p.period + p.offset) % 1 + 1) % 1;
        const pos = cubicAt(p.edge.p0, p.edge.c1, p.edge.c2, p.edge.p1, t);
        // Fade in and out at the ends so packets do not pop at the card edges.
        const fade = Math.min(1, t / 0.12, (1 - t) / 0.12);
        return (
          <div
            key={p.key}
            style={{
              position: "absolute",
              left: pos.x - 2,
              top: pos.y - 2,
              width: 4,
              height: 4,
              borderRadius: 1,
              background: "#eaf4ff",
              boxShadow: `0 0 7px ${alpha("#bcdcff", 0.9)}`,
              opacity: fade * drawIn * 0.95,
            }}
          />
        );
      })}

      {NODES.map((n, i) => (
        <NodeCard key={n.id} node={n} index={i} />
      ))}
    </Panel>
  );
};
