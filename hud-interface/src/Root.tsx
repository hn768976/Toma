import { Composition } from "remotion";
import { HudInterface, HudInterfaceProps } from "./HudInterface";

// Authored at 4K UHD (3840x2160), 30 fps.
// Duration matches the reference clip exactly: 30.000 s = 900 frames.
export const FPS = 30;
export const DURATION_IN_FRAMES = 900;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: teal/blue holographic interface, matches the reference. */}
      <Composition
        id="HudInterface-V1-4K"
        component={HudInterface}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v1" } satisfies HudInterfaceProps}
      />
      {/* Version 2: same interface in an amber/red "alert" colour palette. */}
      <Composition
        id="HudInterface-V2-4K"
        component={HudInterface}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "v2" } satisfies HudInterfaceProps}
      />
    </>
  );
};
