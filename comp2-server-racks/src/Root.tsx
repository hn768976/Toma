import { Composition } from "remotion";
import { ServerRacks } from "./server-racks/ServerRacks";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./server-racks/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference - oblique close-up, slow crane down. */}
      <Composition
        id="ServerRacks-V1"
        component={ServerRacks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ shot: "craneDown" as const }}
      />
      {/* Version 2: alternative camera - low-angle lateral tracking shot. */}
      <Composition
        id="ServerRacks-V2"
        component={ServerRacks}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ shot: "lateralTrack" as const }}
      />
    </>
  );
};
