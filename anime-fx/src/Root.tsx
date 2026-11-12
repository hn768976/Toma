import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { AnimeShards } from "./shards/AnimeShards";
import { AnimeFire } from "./fire/AnimeFire";
import { GraffitiWall } from "./graffiti/GraffitiWall";
import { StyleWalk, WALK_FRAMES } from "./stylewalk/StyleWalk";
import { InkFigure, INK_FRAMES } from "./inkfigure/InkFigure";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Loop compositions are 300 frames (10 s). Passing {"loopCheck": true} as
// input props makes them 301 frames so frame 300 can be rendered and
// compared with frame 0.
type LoopProps = { loopCheck?: boolean };
const loopMeta: CalculateMetadataFunction<LoopProps> = ({ props }) => ({
  durationInFrames: props.loopCheck ? 301 : 300,
});

const ShardsNeon: React.FC<LoopProps> = () => <AnimeShards variant="neon" />;
const ShardsIce: React.FC<LoopProps> = () => <AnimeShards variant="ice" />;
const GraffitiNeon: React.FC<LoopProps> = () => <GraffitiWall variant="neon" />;
const GraffitiPaper: React.FC<LoopProps> = () => <GraffitiWall variant="paper" />;
const FireRed: React.FC<LoopProps> = () => <AnimeFire variant="red" />;
const FireBlue: React.FC<LoopProps> = () => <AnimeFire variant="blue" />;

// Remotion ids can't contain "_", so ids use "-"; output files use "_".
const LOOPS: [string, React.FC<LoopProps>][] = [
  ["AnimeShards-Neon", ShardsNeon],
  ["AnimeShards-Ice", ShardsIce],
  ["GraffitiWall-Neon", GraffitiNeon],
  ["GraffitiWall-Paper", GraffitiPaper],
  ["AnimeFire-Red", FireRed],
  ["AnimeFire-Blue", FireBlue],
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {LOOPS.map(([id, C]) => (
        <Composition
          key={id}
          id={id}
          component={C}
          durationInFrames={300}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ loopCheck: false }}
          calculateMetadata={loopMeta}
        />
      ))}
      <Composition
        id="StyleWalk-Colours"
        component={StyleWalk}
        defaultProps={{} as { forceCut?: number }}
        durationInFrames={WALK_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="InkFigure-DotBurst"
        component={InkFigure}
        durationInFrames={INK_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
