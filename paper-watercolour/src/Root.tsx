import React from "react";
import { Composition } from "remotion";
import { Chalkboard } from "./clips/Chalkboard";
import { HatchedMap } from "./clips/HatchedMap";
import { InkReveal } from "./clips/InkReveal";
import { SketchyDrift } from "./clips/SketchyDrift";
import { WatercolourBloom } from "./clips/WatercolourBloom";
import { PaintComps } from "./paint/PaintComps";
import { StillComps } from "./stills/Stills";
import { LiveBrushBloom } from "./clips/LiveBrushBloom";
import {
  BLOOM_COLOURWAYS,
  BOARD_COLOURWAYS,
  INK_COLOURWAYS,
  MAP_COLOURWAYS,
  SKETCH_COLOURWAYS,
  findRow,
} from "./palettes";

const FPS = 30;
const W = 3840;
const H = 2160;
const LOOP = 600;

// Loops are 600 frames. Pass --props='{"loopCheck":true}' to render 601
// frames, so frame 600 can be compared with frame 0.
type LoopProps = { loopCheck?: boolean };
const loopMeta = ({ props }: { props: LoopProps }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP });

// Remotion ids may not contain "_", so the clip WatercolourBloom_Pastel is
// registered as WatercolourBloom-Pastel (output files keep the underscore).
export const RemotionRoot: React.FC = () => (
  <>
    {BLOOM_COLOURWAYS.filter((c) => c.name !== "MintLavender").map((c) => (
      <Composition
        key={c.name}
        id={`WatercolourBloom-${c.name}`}
        component={WatercolourBloom}
        durationInFrames={LOOP}
        calculateMetadata={loopMeta}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ colourway: c, seedId: `WatercolourBloom_${c.name}` }}
      />
    ))}
    {["Indigo", "Sepia"].map((n) => (
      <Composition
        key={n}
        id={`InkReveal-${n}`}
        component={InkReveal}
        durationInFrames={360}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ colourway: findRow(INK_COLOURWAYS, n) }}
      />
    ))}
    {SKETCH_COLOURWAYS.map((c) => (
      <Composition
        key={c.name}
        id={`SketchyDrift-${c.name}`}
        component={SketchyDrift}
        durationInFrames={LOOP}
        calculateMetadata={loopMeta}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ colourway: c, seedId: `SketchyDrift_${c.name}` }}
      />
    ))}
    <Composition
      id="HatchedMap-Antique"
      component={HatchedMap}
      durationInFrames={LOOP}
      calculateMetadata={loopMeta}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ colourway: findRow(MAP_COLOURWAYS, "Antique") }}
    />
    <Composition
      id="Chalkboard-Green"
      component={Chalkboard}
      durationInFrames={LOOP}
      calculateMetadata={loopMeta}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ colourway: findRow(BOARD_COLOURWAYS, "Green") }}
    />
    <StillComps />
    {/* benchmark: clip 1 with p5.brush repainting live every frame */}
    <Composition
      id="WatercolourBloom-Pastel-LiveBrush"
      component={LiveBrushBloom}
      durationInFrames={LOOP}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ colourway: BLOOM_COLOURWAYS[0], seedId: "WatercolourBloom_Pastel", width: W, height: H }}
    />
    <PaintComps />
  </>
);
