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
import { PreviewMonitor } from "./panels/PreviewMonitor";
import {
  ControlStrip,
  Filmstrip,
  MenuBar,
  Timeline,
  ToolbarRow,
} from "./panels/Chrome";
import { PlaneBleed } from "./effects/PlaneBleed";

// Layout A — the reference framing.
//
// Plane coordinates only. Where any of this ends up in frame, and how
// defocused it is, is entirely the camera's business (see camera.ts and
// optics.ts). Panels that never make it into shot still have to exist:
// at this angle the perspective drags a lot of off-frame UI into the
// corners, and a plane that just stops looks like a floating rectangle.

const WHEEL_SIZE = 372;
const WHEEL_Y = 1408;
const WHEEL_X = [96, 612, 1128, 1644];
const WHEEL_LABELS = ["Lift", "Gamma", "Gain", "Offset"];
const WHEEL_KEYS = ["lift", "gamma", "gain", "offset"];

/** Centre of a wheel's puck well, in plane space — the pointer aims here. */
const wheelCentre = (i: number) => ({
  x: WHEEL_X[i] + WHEEL_SIZE / 2,
  y: WHEEL_Y + WHEEL_SIZE / 2,
});

const PARADE = { x: 1990, y: 214, w: 1230, h: 806 };
const VECTOR = { x: 1990, y: 1070, size: 470 };

export const SCRIPT_A: Script = {
  // Every target below is inside the final crop. The trackball row runs
  // off both edges of frame at this focal length, so the script works
  // Gamma/Gain/Offset and the scope tabs — reaching for Lift would send
  // the pointer out of shot.
  start: { x: 1420, y: 1980 },
  initial: {
    lift: { x: 0, y: 0 },
    gamma: { x: 0, y: 0 },
    gain: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    exposure: { x: 0, y: 0 },
    saturation: { x: 0, y: 0 },
  },
  segments: [
    // Approach the Gain trackball.
    { kind: "move", dur: 45, to: wheelCentre(2), arc: 70 },
    { kind: "dwell", dur: 20 },
    // Cool the highlights — the blue trace in the parade lifts with it.
    {
      kind: "drag",
      dur: 70,
      to: { x: wheelCentre(2).x + 46, y: wheelCentre(2).y - 26 },
      control: "gain",
      value: { x: 0.56, y: -0.3 },
      arc: 10,
    },
    { kind: "dwell", dur: 25 },
    // Small correction, the way a colourist nudges back after checking.
    {
      kind: "drag",
      dur: 40,
      to: { x: wheelCentre(2).x + 52, y: wheelCentre(2).y - 10 },
      control: "gain",
      value: { x: 0.63, y: -0.11 },
    },
    // Across to Gamma, warm the midtones.
    { kind: "move", dur: 55, to: wheelCentre(1), arc: 54 },
    {
      kind: "drag",
      dur: 62,
      to: { x: wheelCentre(1).x - 28, y: wheelCentre(1).y + 34 },
      control: "gamma",
      value: { x: -0.34, y: 0.46 },
      arc: 8,
    },
    { kind: "dwell", dur: 28 },
    // Pull exposure down on the Offset master slider.
    { kind: "move", dur: 50, to: { x: WHEEL_X[3] + 92, y: WHEEL_Y + 402 }, arc: 40 },
    {
      kind: "scrub",
      dur: 45,
      to: { x: WHEEL_X[3] + 246, y: WHEEL_Y + 402 },
      control: "exposure",
      value: { x: 0, y: -0.52 },
    },
    { kind: "dwell", dur: 20 },
    // Up to the scope tabs to switch the readout.
    { kind: "move", dur: 58, to: { x: VECTOR.x + 96, y: VECTOR.y + 30 }, arc: -70 },
    { kind: "click", dur: 30 },
    { kind: "dwell", dur: 41 },
  ],
};

type Props = {
  camera: Camera;
  frame: number;
  cursor: CursorState;
  grade: Grade;
};

export const LayoutA: React.FC<Props> = ({ camera, frame, cursor, grade }) => {
  const playhead = 0.18 + ((frame / 569) * 0.34) % 1;
  const activeWheel = (() => {
    // Light up whichever trackball the pointer is currently over.
    for (let i = 0; i < 4; i++) {
      const c = wheelCentre(i);
      if (Math.hypot(cursor.x - c.x, cursor.y - c.y) < WHEEL_SIZE * 0.62) return i;
    }
    return -1;
  })();

  return (
    <>
      <PlaneBleed />
      {/* ---- far chrome: menu + toolbars ---- */}
      <DepthLayer camera={camera} x={0} y={0} width={PLANE_WIDTH} height={46} bands={8}>
        <MenuBar
          width={PLANE_WIDTH}
          height={46}
          items={["File", "Edit", "Clip", "Timeline", "Grade", "Workspace", "Help"]}
        />
      </DepthLayer>
      {[0, 1].map((half) => (
        <DepthLayer
          key={`tb1-${half}`}
          camera={camera}
          x={half * (PLANE_WIDTH / 2)}
          y={52}
          width={PLANE_WIDTH / 2}
          height={52}
        >
          <div style={{ background: UI.panelHi, height: 52 }}>
            <ToolbarRow width={PLANE_WIDTH / 2} height={52} count={15} seed={1 + half} />
          </div>
        </DepthLayer>
      ))}
      {[0, 1].map((half) => (
        <DepthLayer
          key={`tb2-${half}`}
          camera={camera}
          x={half * (PLANE_WIDTH / 2)}
          y={108}
          width={PLANE_WIDTH / 2}
          height={48}
        >
          <div style={{ background: UI.panel, height: 48 }}>
            <ToolbarRow
              width={PLANE_WIDTH / 2}
              height={48}
              count={11}
              seed={7 + half}
              accent={UI.cyanDim}
            />
          </div>
        </DepthLayer>
      ))}

      {/* ---- viewers ---- */}
      <DepthLayer camera={camera} x={60} y={196} width={1180} height={664} bands={5} blurBias={3}>
        <PreviewMonitor width={1180} height={664} grade={grade} frame={frame} label="TIMELINE  01:04:22:11" />
      </DepthLayer>
      <DepthLayer camera={camera} x={1288} y={196} width={620} height={350} bands={3}>
        <PreviewMonitor width={620} height={350} grade={grade} frame={frame + 300} label="GALLERY" />
      </DepthLayer>
      <DepthLayer camera={camera} x={1288} y={570} width={620} height={290}>
        <div style={{ background: UI.panel, width: 620, height: 290, border: `1px solid ${UI.edgeLine}` }}>
          <ControlStrip width={620} height={290} rows={6} seed={21} />
        </div>
      </DepthLayer>

      {/* ---- scopes ---- */}
      <DepthLayer camera={camera} x={PARADE.x} y={PARADE.y} width={PARADE.w} height={PARADE.h} bands={4}>
        <ParadeScope width={PARADE.w} height={PARADE.h} grade={grade} frame={frame} />
      </DepthLayer>
      <DepthLayer camera={camera} x={VECTOR.x} y={VECTOR.y} width={VECTOR.size} height={VECTOR.size * 1.12}>
        <Vectorscope size={VECTOR.size} grade={grade} frame={frame} />
      </DepthLayer>
      <DepthLayer
        camera={camera}
        x={VECTOR.x + VECTOR.size + 36}
        y={VECTOR.y}
        width={VECTOR.size}
        height={VECTOR.size * 1.12}
      >
        <ParadeScope
          width={VECTOR.size}
          height={VECTOR.size * 1.12}
          grade={grade}
          frame={frame + 41}
          title="Waveform"
          columns={72}
        />
      </DepthLayer>

      {/* ---- timeline + media ---- */}
      <DepthLayer camera={camera} x={60} y={900} width={1848} height={186} bands={6}>
        <Timeline width={1848} height={186} grade={grade} frame={frame} playhead={playhead} />
      </DepthLayer>
      <DepthLayer camera={camera} x={60} y={1114} width={1848} height={128} bands={6}>
        <Filmstrip width={1848} height={128} grade={grade} frame={frame} count={11} selected={4} />
      </DepthLayer>
      <DepthLayer camera={camera} x={60} y={1282} width={900} height={84}>
        <div style={{ background: UI.panelHi, height: 84, borderRadius: 6, border: `1px solid ${UI.edgeLine}` }}>
          <ToolbarRow width={900} height={84} count={9} seed={31} />
        </div>
      </DepthLayer>

      {/* ---- primaries: the focal plane ---- */}
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
            value={(
              1 +
              (cursor.controls[WHEEL_KEYS[i]]?.y ?? 0) * -0.4 +
              (i === 3 ? cursor.controls.exposure?.y ?? 0 : 0) * -0.3
            ).toFixed(3)}
          />
        </DepthLayer>
      ))}

      {/* Off-frame filler so the plane never visibly ends. */}
      <DepthLayer camera={camera} x={2150} y={1408} width={1150} height={560} bands={3}>
        <div style={{ background: UI.panel, width: 1150, height: 560, border: `1px solid ${UI.edgeLine}` }}>
          <ControlStrip width={1150} height={560} rows={9} seed={57} />
        </div>
      </DepthLayer>

      <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
        <DepthLayer camera={camera} x={cursor.x} y={cursor.y} width={1} height={1} zIndex={31}>
          <Cursor x={0} y={0} size={40} pressed={cursor.pressed} clickPulse={cursor.clickPulse} />
        </DepthLayer>
      </div>
    </>
  );
};
