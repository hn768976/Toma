import { Composition } from "remotion";
import { CpuCircuit, cpuCircuitSchema } from "./cpu/CpuCircuit";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version 1: matches the reference (three framings joined by whip moves). */}
      <Composition
        id="CpuCircuit-V1-4K"
        component={CpuCircuit}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cpuCircuitSchema}
        defaultProps={{ camera: "reference" as const }}
      />
      {/* Version 2: same scene, one continuous overhead crane-and-orbit move. */}
      <Composition
        id="CpuCircuit-V2-4K"
        component={CpuCircuit}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cpuCircuitSchema}
        defaultProps={{ camera: "crane" as const }}
      />
    </>
  );
};
