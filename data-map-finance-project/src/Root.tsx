import React from "react";
import { Composition, getInputProps } from "remotion";
import {
  DATA_MATRIX,
  DOT_GLOBE,
  FINANCE_DEPTH,
  HOLOGRAM,
  OVERLAY,
  MATRIX_FRAMES,
  FPS,
  HEIGHT,
  LOOP_FRAMES,
  WIDTH,
} from "./versions";
import { DotMapGlobe } from "./looks/dotglobe/DotMapGlobe";
import { DataMatrix } from "./looks/datamatrix/DataMatrix";
import { FinanceDepth } from "./looks/financedepth/FinanceDepth";
import { HologramMap } from "./looks/hologram/HologramMap";
import { FinanceOverlay } from "./looks/overlay/FinanceOverlay";

// `--props='{"loopTest":true}'` makes every looping composition 601 frames so
// frame 600 can be rendered and compared with frame 0.
const loopTest = Boolean((getInputProps() as { loopTest?: boolean }).loopTest);
const LOOP_LEN = loopTest ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    {DOT_GLOBE.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={DotMapGlobe}
        durationInFrames={LOOP_LEN}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: v.palette }}
      />
    ))}
    {DATA_MATRIX.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={DataMatrix}
        durationInFrames={MATRIX_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: v.palette }}
      />
    ))}
    {FINANCE_DEPTH.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={FinanceDepth}
        durationInFrames={LOOP_LEN}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: v.palette }}
      />
    ))}
    {HOLOGRAM.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={HologramMap}
        durationInFrames={LOOP_LEN}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: v.palette }}
      />
    ))}
    {OVERLAY.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={FinanceOverlay}
        durationInFrames={LOOP_LEN}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: v.palette }}
      />
    ))}
  </>
);
