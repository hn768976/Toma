import { Composition } from "remotion";
import { AIAgentWorkflow } from "./AIAgentWorkflow";
import { DURATION, FPS } from "./layout";
import { compSchema } from "./theme";

// Both versions are authored at 4K (3840×2160). Render them at 1080p with
// `--scale=0.5` (see package.json scripts).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Version A: matches the reference (teal / violet). */}
      <Composition
        id="AIAgentWorkflow"
        component={AIAgentWorkflow}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        schema={compSchema}
        defaultProps={{ palette: "teal" as const }}
      />
      {/* Version B: same choreography, warm "solar" amber / rose palette. */}
      <Composition
        id="AIAgentWorkflowSolar"
        component={AIAgentWorkflow}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        schema={compSchema}
        defaultProps={{ palette: "solar" as const }}
      />
    </>
  );
};
