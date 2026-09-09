import React from "react";
import { Composition } from "remotion";
import { HyperspaceWarp, HyperspaceWarpProps } from "./HyperspaceWarp";

const FPS = 30;
const W4K = 3840;
const H4K = 2160;
const W_PREVIEW = 1920;
const H_PREVIEW = 1080;

const ARC_FRAMES = 450; // 15s
const LOOP_FRAMES = 600; // 20s

const SEED = 20260909;

const VERSIONS: {
  id: string;
  durationInFrames: number;
  props: HyperspaceWarpProps;
}[] = [
  {
    id: "v1-blue-arc",
    durationInFrames: ARC_FRAMES,
    props: { palette: "blue", mode: "arc", seed: SEED },
  },
  {
    id: "v2-violet-arc",
    durationInFrames: ARC_FRAMES,
    props: { palette: "violet", mode: "arc", seed: SEED },
  },
  {
    id: "v3-blue-loop",
    durationInFrames: LOOP_FRAMES,
    props: { palette: "blue", mode: "loop", seed: SEED },
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Deliverable compositions: 3840x2160. */}
      {VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={HyperspaceWarp}
          durationInFrames={v.durationInFrames}
          fps={FPS}
          width={W4K}
          height={H4K}
          defaultProps={v.props}
        />
      ))}

      {/* Identical code and props at 1080p, for fast preview renders. */}
      {VERSIONS.map((v) => (
        <Composition
          key={`${v.id}-preview`}
          id={`${v.id}-preview`}
          component={HyperspaceWarp}
          durationInFrames={v.durationInFrames}
          fps={FPS}
          width={W_PREVIEW}
          height={H_PREVIEW}
          defaultProps={v.props}
        />
      ))}

      {/*
        Loop verification harness: one frame longer than the loop, so frame 600
        can be rendered and diffed against frame 0. See `npm run verify:loop`.
      */}
      <Composition
        id="v3-blue-loop-seamcheck"
        component={HyperspaceWarp}
        durationInFrames={LOOP_FRAMES + 1}
        fps={FPS}
        width={W_PREVIEW}
        height={H_PREVIEW}
        defaultProps={{ palette: "blue", mode: "loop", seed: SEED }}
      />
    </>
  );
};
