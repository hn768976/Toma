import { Composition } from "remotion";
import { CircuitDataCore, circuitDataCoreSchema } from "./CircuitDataCore";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./scene/constants";

// Two 4K (3840x2160) master compositions, 30 fps, 450 frames (15.0 s).
//  - Version 1 matches the reference: slow accelerating push-in on the core.
//  - Version 2 keeps the look but uses a different camera move: a low,
//    sweeping 130° orbit that cranes up to a high three-quarter view.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CircuitDataCore-V1-Reference"
        component={CircuitDataCore}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        schema={circuitDataCoreSchema}
        defaultProps={{ variant: "dolly" as const }}
      />
      <Composition
        id="CircuitDataCore-V2-OrbitCrane"
        component={CircuitDataCore}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        schema={circuitDataCoreSchema}
        defaultProps={{ variant: "orbit" as const }}
      />
    </>
  );
};
