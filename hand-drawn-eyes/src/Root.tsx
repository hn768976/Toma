import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { CanvasHost } from "./lib/CanvasHost";
import { LOOKS } from "./looks/registry";

// All compositions: 3840x2160, 30fps, 10s loops (300 frames).
// Pass --props='{"loopCheck":true}' to render 301 frames (frame 300 must
// equal frame 0).
export const FPS = 30;
export const LOOP_FRAMES = 300;

type Props = { loopCheck?: boolean };

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

export const ORDER = [
  "ScribbleEyes_Blue",
  "ScribbleEyes_OrangeOnWhite",
  "CrayonEyes_Blue",
  "CrayonEyes_Amber",
  "PaleEyes_Dark",
  "EyesCrowd_Dark",
  "UnknownPerson_Cycle",
  "UnknownPerson_Lineup",
] as const;

const components = Object.fromEntries(
  ORDER.map((id) => {
    const look = LOOKS[id];
    const C: React.FC<Props> = () => <CanvasHost draw={look.draw} background={look.background} />;
    C.displayName = id;
    return [id, C];
  }),
) as Record<(typeof ORDER)[number], React.FC<Props>>;

export const RemotionRoot: React.FC = () => (
  <>
    {ORDER.map((id) => (
      <Composition
        key={id}
        // Remotion ids can't contain "_": ScribbleEyes_Blue -> ScribbleEyes-Blue.
        id={id.replace("_", "-")}
        component={components[id]}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ loopCheck: false } as Props}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
