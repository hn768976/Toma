import "./index.css";
import { Composition } from "remotion";
import { MapPinsDrop, mapPinsDropSchema } from "./map/MapPinsDrop";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

/**
 * Both compositions are authored at 4K UHD (3840×2160), 30 fps, 451 frames
 * (15.033 s – identical to the reference clip).
 * Deliverables are rendered from these 4K compositions with --scale=0.5
 * (supersampled down to 1920×1080).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MapPinsDrop-V1-Reference"
        component={MapPinsDrop}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={mapPinsDropSchema}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="MapPinsDrop-V2-NightPalette"
        component={MapPinsDrop}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={mapPinsDropSchema}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
