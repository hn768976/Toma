import "./index.css";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { GlassCircuitDatacore, glassCircuitSchema } from "./circuit/GlassCircuitDatacore";

/**
 * Both compositions are authored at 4K UHD (3840×2160), 30 fps, 219 frames
 * (7.300 s – identical to the reference clip).
 * Deliverables are rendered from these 4K compositions with --scale=0.5
 * (supersampled down to 1920×1080).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GlassCircuit-V1-Reference"
        component={GlassCircuitDatacore}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={glassCircuitSchema}
        defaultProps={{ variant: "v1" as const }}
      />
      <Composition
        id="GlassCircuit-V2-CraneOrbit"
        component={GlassCircuitDatacore}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={glassCircuitSchema}
        defaultProps={{ variant: "v2" as const }}
      />
    </>
  );
};
