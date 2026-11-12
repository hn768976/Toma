import { Composition } from "remotion";
import { HoloPrism } from "./holo/HoloPrism";
import { DURATION_IN_FRAMES, FPS, HEIGHT_4K, WIDTH_4K } from "./holo/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1 - matches the reference (flat, hand-held macro drift) */}
      <Composition
        id="HoloPrism-V1-Match-4K"
        component={HoloPrism}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={{ variant: "match" as const }}
      />
      {/* Version 2 - alternative camera: low-angle perspective tracking shot */}
      <Composition
        id="HoloPrism-V2-LowAngleTracking-4K"
        component={HoloPrism}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH_4K}
        height={HEIGHT_4K}
        defaultProps={{ variant: "camera" as const }}
      />
    </>
  );
};
