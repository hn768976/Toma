import React from "react";
import { Composition } from "remotion";
import {
  DiagonalSlats,
  EarthHorizon,
  HierarchyNetwork,
  HIERARCHY_FRAMES,
  LoopProps,
  LOOP_FRAMES,
  NeonGridTunnel,
  SpeedTrails,
} from "./compositions";

// All compositions are defined at 3840x2160, 30fps. Render previews with
// --scale (see README); the 3D is drawn at the scaled buffer size.
const W = 3840;
const H = 2160;
const FPS = 30;

// Looping compositions are 600 frames. Passing {"loopCheck": true} as
// input props makes them 601 so frame 600 can be compared with frame 0.
const loopMeta = ({ props }: { props: LoopProps }) => ({
  durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

const common = { fps: FPS, width: W, height: H };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EarthHorizon-Blue"
        component={EarthHorizon}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "Blue" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
      <Composition
        id="EarthHorizon-Gold"
        component={EarthHorizon}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "Gold" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
      <Composition
        id="NeonGridTunnel-Blue"
        component={NeonGridTunnel}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "Blue" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
      <Composition
        id="NeonGridTunnel-Magenta"
        component={NeonGridTunnel}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "Magenta" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
      <Composition
        id="HierarchyNetwork"
        component={HierarchyNetwork}
        durationInFrames={HIERARCHY_FRAMES}
        {...common}
        defaultProps={{ version: "Blue" as const }}
      />
      <Composition
        id="DiagonalSlats-Black"
        component={DiagonalSlats}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "Black" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
      <Composition
        id="DiagonalSlats-White"
        component={DiagonalSlats}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "White" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
      <Composition
        id="SpeedTrails"
        component={SpeedTrails}
        durationInFrames={LOOP_FRAMES}
        {...common}
        defaultProps={{ version: "BlueOrange" as const, loopCheck: false }}
        calculateMetadata={loopMeta}
      />
    </>
  );
};
