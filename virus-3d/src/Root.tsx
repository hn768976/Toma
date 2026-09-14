import React from "react";
import { Composition } from "remotion";
import { LOOKS } from "./looks";
import { VirusVideo } from "./VirusVideo";

/**
 * Every look is registered twice: a 1080p master and a 4K master of the exact
 * same shot. All resolution-dependent values (blur radii, point sizes, bokeh,
 * grain, line weights) scale off the composition width, so the 4K render is a
 * true up-res of the 1080p one rather than a different-looking frame.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {LOOKS.map((look) => (
        <React.Fragment key={look.id}>
          <Composition
            id={`${look.id}-1080`}
            component={VirusVideo}
            durationInFrames={look.durationInFrames}
            fps={30}
            width={1920}
            height={1080}
            defaultProps={{ lookId: look.id }}
          />
          <Composition
            id={`${look.id}-4k`}
            component={VirusVideo}
            durationInFrames={look.durationInFrames}
            fps={30}
            width={3840}
            height={2160}
            defaultProps={{ lookId: look.id }}
          />
        </React.Fragment>
      ))}
    </>
  );
};
