import { Composition } from "remotion";
import { PlexusNetwork, type PlexusProps } from "./plexus/PlexusNetwork";

// Both compositions are authored at native 4K UHD (3840x2160), 30 fps.
// Duration matches the reference clip exactly: 28.333 s = 850 frames.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 850;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PlexusNetwork-V1-Reference"
        component={PlexusNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "blue", seed: 20261112 } satisfies PlexusProps}
      />
      <Composition
        id="PlexusNetwork-V2-AmberPalette"
        component={PlexusNetwork}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "amber", seed: 20261112 } satisfies PlexusProps}
      />
    </>
  );
};
