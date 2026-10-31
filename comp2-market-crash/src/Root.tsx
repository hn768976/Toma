import { Composition } from "remotion";
import { DURATION_FRAMES, FPS } from "./market/build";
import { MarketCrash } from "./market/MarketCrash";

// Composition 2 – "Market Crash" red stock-data motion graphic.
// Authored at 4K UHD (3840x2160), 30 fps, 400 frames (13.333 s) to match the
// reference clip exactly.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketCrash-V1"
        component={MarketCrash}
        fps={FPS}
        durationInFrames={DURATION_FRAMES}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="MarketCrash-V2"
        component={MarketCrash}
        fps={FPS}
        durationInFrames={DURATION_FRAMES}
        width={3840}
        height={2160}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
