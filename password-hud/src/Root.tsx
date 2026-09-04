import React from "react";
import { Composition } from "remotion";
import { PasswordHud } from "./PasswordHud";
import "./lib/fonts";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./lib/design";
import { DURATION_IN_FRAMES, FPS } from "./lib/timeline";

/**
 * Both compositions are the same component with a different `outcome`, defined
 * at 3840x2160 so they can be rendered at 4K. Render 1080p previews with
 * `--scale=0.5`.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-PasswordGranted"
      component={PasswordHud}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={DESIGN_WIDTH}
      height={DESIGN_HEIGHT}
      defaultProps={{ outcome: "granted" as const }}
    />
    <Composition
      id="V2-PasswordDenied"
      component={PasswordHud}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={DESIGN_WIDTH}
      height={DESIGN_HEIGHT}
      defaultProps={{ outcome: "denied" as const }}
    />
  </>
);
