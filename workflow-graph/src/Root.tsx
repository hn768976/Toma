import { Composition } from "remotion";
import { emberTheme, referenceTheme } from "./theme";
import { CameraRig, WorkflowGraph } from "./WorkflowGraph";

// 4K master compositions. 14 s @ 30 fps = 420 frames (matches the reference).
const FPS = 30;
const DURATION = 14 * FPS;

export const referenceRig: CameraRig = {
  azimuth: 30,
  elevation: 37,
  distance: 16.2,
  fov: 46,
  lead: 0.3,
  lateral: 1.8,
  sway: 0,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WorkflowGraph"
        component={WorkflowGraph}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ theme: referenceTheme, rig: referenceRig }}
      />
      <Composition
        id="WorkflowGraphEmber"
        component={WorkflowGraph}
        fps={FPS}
        durationInFrames={DURATION}
        width={3840}
        height={2160}
        defaultProps={{ theme: emberTheme, rig: referenceRig }}
      />
    </>
  );
};
