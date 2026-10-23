import { Composition } from "remotion";
import { GlassBlob } from "./GlassBlob";
import { PALETTES } from "./palettes";

// Reference clip: 10.000 s -> exactly 300 frames at 30 fps.
const FPS = 30;
const DURATION = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (cool iridescent glass on black). */}
      <Composition
        id="GlassBlob-V1"
        component={GlassBlob}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ palette: PALETTES.reference }}
      />
      {/* Version 2: same motion and form, alternative warm dichroic palette. */}
      <Composition
        id="GlassBlob-V2"
        component={GlassBlob}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ palette: PALETTES.dichroicGold }}
      />
    </>
  );
};
