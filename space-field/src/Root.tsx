import React from "react";
import { Composition } from "remotion";
import { SpaceField } from "./SpaceField";
import { VARIANTS } from "./variants";

/**
 * Family A — warp bursts, 168 frames (5.6s) at 30fps, 4K, seamless.
 * Family B — starfields, 390 frames (13.0s) at 30fps, 4K, seamless.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WarpBlue"
        component={SpaceField}
        durationInFrames={VARIANTS.warpBlue.loopLength}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "warpBlue" as const }}
      />
      <Composition
        id="WarpViolet"
        component={SpaceField}
        durationInFrames={VARIANTS.warpViolet.loopLength}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "warpViolet" as const }}
      />
      <Composition
        id="WarpAmber"
        component={SpaceField}
        durationInFrames={VARIANTS.warpAmber.loopLength}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "warpAmber" as const }}
      />
      <Composition
        id="FieldBlue"
        component={SpaceField}
        durationInFrames={VARIANTS.fieldBlue.loopLength}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "fieldBlue" as const }}
      />
    </>
  );
};
