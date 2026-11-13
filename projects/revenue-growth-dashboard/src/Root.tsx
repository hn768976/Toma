import { Composition } from "remotion";
import { RevenueDashboard } from "./dashboard/RevenueDashboard";

// Both compositions are authored at native 4K UHD (3840x2160), 30 fps,
// 600 frames = 20.000 s (exact length of the reference clip).
const FPS = 30;
const DURATION = 600;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (navy / red-green / orange). */}
      <Composition
        id="RevenueGrowth-V1-Reference-4K"
        component={RevenueDashboard}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      {/* Version 2: alternative colour palette "Amber Night", same camera. */}
      <Composition
        id="RevenueGrowth-V2-AmberPalette-4K"
        component={RevenueDashboard}
        fps={FPS}
        durationInFrames={DURATION}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
    </>
  );
};
