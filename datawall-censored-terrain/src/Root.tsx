import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { DataWall } from "./datawall/DataWall";
import { CensoredTerminal } from "./terminal/CensoredTerminal";
import { ParticleTerrain } from "./terrain/ParticleTerrain";
import { DATAWALL_VERSIONS, TERMINAL_VERSIONS, TERRAIN_VERSIONS } from "./versions";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const LOOP_FRAMES = 600;
export const STORY_FRAMES = 450;

type LoopProps = { versionId: string; loopCheck: boolean };

// loopCheck=true makes a loop composition 601 frames long so frames 0 and 600 can be compared.
const loopMetadata: CalculateMetadataFunction<LoopProps> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {DATAWALL_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={DataWall}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ versionId: v.id, loopCheck: false }}
          calculateMetadata={loopMetadata}
        />
      ))}
      {TERMINAL_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={CensoredTerminal}
          durationInFrames={STORY_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ versionId: v.id }}
        />
      ))}
      {TERRAIN_VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={ParticleTerrain}
          durationInFrames={LOOP_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ versionId: v.id, loopCheck: false }}
          calculateMetadata={loopMetadata}
        />
      ))}
    </>
  );
};
