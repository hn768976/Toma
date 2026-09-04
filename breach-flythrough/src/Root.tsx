import React from "react";
import { Composition } from "remotion";
import { BreachFlythrough } from "./BreachFlythrough";

/**
 * Both compositions are defined at 3840x2160 and rendered down with `--scale`
 * for previews. Everything in the scene is sized from the composition width,
 * so the 4K render is the same picture at more pixels.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="V1-BreachFlythroughCyan"
      component={BreachFlythrough}
      width={3840}
      height={2160}
      fps={30}
      durationInFrames={360}
      defaultProps={{ variant: "cyan" as const }}
    />
    <Composition
      id="V2-BreachFlythroughAmber"
      component={BreachFlythrough}
      width={3840}
      height={2160}
      fps={30}
      durationInFrames={360}
      defaultProps={{ variant: "amber" as const }}
    />
  </>
);
