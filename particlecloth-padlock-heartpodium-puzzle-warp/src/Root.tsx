import React from "react";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/loop";
import { VERSIONS } from "./versions";
import { ParticleCloth } from "./looks/particle-cloth/ParticleCloth";
import { CircuitPadlock } from "./looks/circuit-padlock/CircuitPadlock";
import { HeartPodium } from "./looks/heart-podium/HeartPodium";
import { PuzzleSurface } from "./looks/puzzle-surface/PuzzleSurface";
import { WarpStreaks } from "./looks/warp-streaks/WarpStreaks";

const COMPONENTS = {
  particleCloth: ParticleCloth,
  circuitPadlock: CircuitPadlock,
  heartPodium: HeartPodium,
  puzzleSurface: PuzzleSurface,
  warpStreaks: WarpStreaks,
} as const;

// --props='{"loopCheck":true}' makes a composition 601 frames long so frame
// 600 can be rendered and compared with frame 0.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const calculateMetadata: CalculateMetadataFunction<any> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});

export const RemotionRoot: React.FC = () => (
  <Folder name="Loops">
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={COMPONENTS[v.look] as React.FC<any>}
        defaultProps={{ ...v.props, loopCheck: false }}
        calculateMetadata={calculateMetadata}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </Folder>
);
