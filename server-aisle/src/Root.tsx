import React, { useCallback } from "react";
import { Composition } from "remotion";
import { GLStage, LookBuilder } from "./lib/GLStage";
import { buildServerAisle, ServerAisleParams } from "./looks/serverAisle";
import { buildFrameTunnel, FrameTunnelParams } from "./looks/frameTunnel";
import { buildStreamCorridor, StreamCorridorParams } from "./looks/streamCorridor";
import { buildScreenCorridor, ScreenCorridorParams } from "./looks/screenCorridor";
import { buildStageBeams, StageBeamsParams } from "./looks/stageBeams";
import { Variant, VARIANTS } from "./variants";

type Props = { variantId: string; loopCheck?: boolean };

const builderFor = (v: Variant): LookBuilder => {
  switch (v.look) {
    case "serverAisle":
      return (gl) => buildServerAisle(gl, { ...(v.params as unknown as ServerAisleParams), loop: v.loop });
    case "frameTunnel":
      return (gl) =>
        buildFrameTunnel(gl, { ...(v.params as unknown as FrameTunnelParams), loop: v.loop, duration: v.durationInFrames });
    case "streamCorridor":
      return (gl) => buildStreamCorridor(gl, { ...(v.params as unknown as StreamCorridorParams), loop: v.loop });
    case "screenCorridor":
      return (gl) => buildScreenCorridor(gl, { ...(v.params as unknown as ScreenCorridorParams), loop: v.loop });
    case "stageBeams":
      return (gl) => buildStageBeams(gl, { ...(v.params as unknown as StageBeamsParams), loop: v.loop });
    default:
      throw new Error(`Unknown look ${v.look}`);
  }
};

const LookComp: React.FC<Props> = ({ variantId }) => {
  const v = VARIANTS.find((x) => x.id === variantId)!;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const build = useCallback(builderFor(v), [variantId]);
  return <GLStage build={build} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookComp}
        durationInFrames={v.durationInFrames}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variantId: v.id, loopCheck: false } as Props}
        // `--props='{"loopCheck":true}'` makes a loop 601 frames long so
        // frame 600 can be compared with frame 0.
        calculateMetadata={({ props }) => ({
          durationInFrames: props.loopCheck && v.loop > 0 ? v.durationInFrames + 1 : v.durationInFrames,
        })}
      />
    ))}
  </>
);
