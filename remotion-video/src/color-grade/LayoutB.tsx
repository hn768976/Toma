import React from "react";
import { PLANE_WIDTH, UI } from "./constants";
import { DepthLayer } from "./Stage";
import { Cursor } from "./Cursor";
import type { Camera } from "./optics";
import type { CursorState, Script } from "./cursor";
import type { Grade } from "./grade";
import { ColorWheel } from "./panels/ColorWheel";
import { ParadeScope } from "./panels/ParadeScope";
import { Vectorscope } from "./panels/Vectorscope";
import { CurvesPanel } from "./panels/CurvesPanel";
import { NodeGraph } from "./panels/NodeGraph";
import { PreviewMonitor } from "./panels/PreviewMonitor";
import {
  ControlStrip,
  Filmstrip,
  MenuBar,
  Timeline,
  ToolbarRow,
} from "./panels/Chrome";
import { PlaneBleed } from "./effects/PlaneBleed";

// Layout B — mirrored rig, node-first workflow.
//
// The plane rises to the *left* here, so depth runs the other way: the
// node tree and trackballs sit near, the scopes fall away into the
// background. The camera racks focus between the two (camera.ts), which
// is why the node graph is placed at a genuinely different depth from
// the wheels rather than just somewhere else on screen.

const WHEEL_SIZE = 330;
const WHEEL_Y = 1424;
const WHEEL_X = [1704, 2144, 2584, 3024];
const WHEEL_LABELS = ["Lift", "Gamma", "Gain", "Offset"];
const WHEEL_KEYS = ["lift", "gamma", "gain", "offset"];

const wheelCentre = (i: number) => ({
  x: WHEEL_X[i] + WHEEL_SIZE / 2,
  y: WHEEL_Y + WHEEL_SIZE / 2,
});

const NODES_PANEL = { x: 2080, y: 296, w: 1230, h: 786 };
const CURVES = { x: 1248, y: 916, w: 740, h: 486 };
const PARADE = { x: 44, y: 916, w: 1150, h: 744 };
const VECTOR = { x: 1248, y: 236, size: 500 };

/** Screen position of a node box inside the graph panel. */
const nodeAt = (nx: number, ny: number) => ({
  x: NODES_PANEL.x + nx * NODES_PANEL.w + NODES_PANEL.w * 0.115,
  y: NODES_PANEL.y + NODES_PANEL.h * 0.13 + NODES_PANEL.h * 0.06 + ny * NODES_PANEL.h * 0.74,
});

export const SCRIPT_B: Script = {
  // As in layout A, every target is checked against the final crop — the
  // Output node and the right-hand trackball both sit on the frame line
  // here, so the script works the ones inboard of them.
  start: { x: 1980, y: 1960 },
  initial: {
    lift: { x: 0, y: 0 },
    gamma: { x: 0, y: 0 },
    gain: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    exposure: { x: 0, y: 0 },
    saturation: { x: 0, y: 0 },
    node: { x: 2, y: 0 },
    highlight: { x: 0, y: 0 },
  },
  segments: [
    // Up into the node tree and select the Look node.
    { kind: "move", dur: 50, to: nodeAt(0.37, 0.58), arc: -110 },
    { kind: "click", dur: 26, control: "node", value: { x: 3, y: 0 } },
    { kind: "dwell", dur: 18 },
    // Warm the midtones through that node.
    { kind: "move", dur: 44, to: wheelCentre(1), arc: 64 },
    {
      kind: "drag",
      dur: 60,
      to: { x: wheelCentre(1).x - 30, y: wheelCentre(1).y + 24 },
      control: "gamma",
      value: { x: -0.38, y: 0.28 },
      arc: 8,
    },
    { kind: "dwell", dur: 18 },
    // Over to the curve editor and lift the highlight control point.
    {
      kind: "move",
      dur: 50,
      to: { x: CURVES.x + CURVES.w * 0.93, y: CURVES.y + CURVES.h * 0.3 },
      arc: 58,
    },
    {
      kind: "drag",
      dur: 56,
      to: { x: CURVES.x + CURVES.w * 0.93, y: CURVES.y + CURVES.h * 0.17 },
      control: "highlight",
      value: { x: 0, y: 0.85 },
    },
    { kind: "dwell", dur: 20 },
    // Back up to the Primary node to check the grade upstream.
    { kind: "move", dur: 52, to: nodeAt(0.37, 0.14), arc: -74 },
    { kind: "click", dur: 26, control: "node", value: { x: 2, y: 0 } },
    { kind: "dwell", dur: 16 },
    // Finish on Lift, cooling the shadows.
    { kind: "move", dur: 46, to: wheelCentre(0), arc: 70 },
    {
      kind: "drag",
      dur: 54,
      to: { x: wheelCentre(0).x + 34, y: wheelCentre(0).y - 22 },
      control: "lift",
      value: { x: 0.5, y: -0.36 },
    },
    { kind: "dwell", dur: 33 },
  ],
};

type Props = {
  camera: Camera;
  frame: number;
  cursor: CursorState;
  grade: Grade;
};

export const LayoutB: React.FC<Props> = ({ camera, frame, cursor, grade }) => {
  const playhead = 0.08 + ((frame / 569) * 0.5) % 1;
  const selectedNode = Math.round(cursor.controls.node?.x ?? 2);
  const highlightPull = cursor.controls.highlight?.y ?? 0;
  const activeWheel = (() => {
    for (let i = 0; i < 4; i++) {
      const c = wheelCentre(i);
      if (Math.hypot(cursor.x - c.x, cursor.y - c.y) < WHEEL_SIZE * 0.62) return i;
    }
    return -1;
  })();

  return (
    <>
      <PlaneBleed />
      <DepthLayer camera={camera} x={0} y={0} width={PLANE_WIDTH} height={46} bands={8}>
        <MenuBar
          width={PLANE_WIDTH}
          height={46}
          items={["File", "Edit", "Clip", "Nodes", "Grade", "Deliver", "Help"]}
        />
      </DepthLayer>
      {[0, 1].map((half) => (
        <DepthLayer
          key={`tb-${half}`}
          camera={camera}
          x={half * (PLANE_WIDTH / 2)}
          y={52}
          width={PLANE_WIDTH / 2}
          height={52}
        >
          <div style={{ background: UI.panelHi, height: 52 }}>
            <ToolbarRow width={PLANE_WIDTH / 2} height={52} count={14} seed={3 + half} />
          </div>
        </DepthLayer>
      ))}

      {/* ---- far column: viewer + parade ---- */}
      <DepthLayer camera={camera} x={44} y={220} width={1150} height={648} bands={5} blurBias={2}>
        <PreviewMonitor width={1150} height={648} grade={grade} frame={frame} label="NODE 04  ·  OUTPUT" />
      </DepthLayer>
      <DepthLayer camera={camera} x={PARADE.x} y={PARADE.y} width={PARADE.w} height={PARADE.h} bands={4}>
        <ParadeScope width={PARADE.w} height={PARADE.h} grade={grade} frame={frame} columns={100} />
      </DepthLayer>
      <DepthLayer camera={camera} x={44} y={1724} width={1150} height={120} bands={5}>
        <Filmstrip width={1150} height={120} grade={grade} frame={frame} count={8} selected={2} />
      </DepthLayer>

      {/* ---- mid column: vectorscope + curves ---- */}
      <DepthLayer camera={camera} x={VECTOR.x} y={VECTOR.y} width={VECTOR.size} height={VECTOR.size * 1.12}>
        <Vectorscope size={VECTOR.size} grade={grade} frame={frame} />
      </DepthLayer>
      <DepthLayer camera={camera} x={VECTOR.x + VECTOR.size + 30} y={VECTOR.y} width={214} height={VECTOR.size * 1.12}>
        <div
          style={{
            background: UI.panel,
            width: 214,
            height: VECTOR.size * 1.12,
            border: `1px solid ${UI.edgeLine}`,
          }}
        >
          <ControlStrip width={214} height={VECTOR.size * 1.12} rows={9} seed={44} />
        </div>
      </DepthLayer>
      <DepthLayer camera={camera} x={CURVES.x} y={CURVES.y} width={CURVES.w} height={CURVES.h} bands={3} zIndex={8}>
        <CurvesPanel width={CURVES.w} height={CURVES.h} grade={grade} highlightPull={highlightPull} />
      </DepthLayer>
      <DepthLayer camera={camera} x={CURVES.x} y={CURVES.y + CURVES.h + 22} width={740} height={82}>
        <div style={{ background: UI.panelHi, height: 82, borderRadius: 6, border: `1px solid ${UI.edgeLine}` }}>
          <ToolbarRow width={740} height={82} count={8} seed={63} />
        </div>
      </DepthLayer>

      {/* ---- near column: node tree + timeline ---- */}
      <DepthLayer
        camera={camera}
        x={NODES_PANEL.x}
        y={NODES_PANEL.y}
        width={NODES_PANEL.w}
        height={NODES_PANEL.h}
        bands={4}
        zIndex={9}
      >
        <NodeGraph
          width={NODES_PANEL.w}
          height={NODES_PANEL.h}
          grade={grade}
          frame={frame}
          selected={selectedNode}
        />
      </DepthLayer>
      <DepthLayer camera={camera} x={NODES_PANEL.x} y={1128} width={1230} height={170} bands={4}>
        <Timeline width={1230} height={170} grade={grade} frame={frame} playhead={playhead} lanes={2} />
      </DepthLayer>

      {/* ---- primaries ---- */}
      {WHEEL_X.map((x, i) => (
        <DepthLayer
          key={WHEEL_KEYS[i]}
          camera={camera}
          x={x}
          y={WHEEL_Y}
          width={WHEEL_SIZE}
          height={WHEEL_SIZE * 1.42}
          zIndex={10}
        >
          <ColorWheel
            size={WHEEL_SIZE}
            label={WHEEL_LABELS[i]}
            puck={cursor.controls[WHEEL_KEYS[i]] ?? { x: 0, y: 0 }}
            active={activeWheel === i}
            value={(1 + (cursor.controls[WHEEL_KEYS[i]]?.y ?? 0) * -0.4).toFixed(3)}
          />
        </DepthLayer>
      ))}

      <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
        <DepthLayer camera={camera} x={cursor.x} y={cursor.y} width={1} height={1} zIndex={60}>
          <Cursor x={0} y={0} size={38} pressed={cursor.pressed} clickPulse={cursor.clickPulse} />
        </DepthLayer>
      </div>
    </>
  );
};
