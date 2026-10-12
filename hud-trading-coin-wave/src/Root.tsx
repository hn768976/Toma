import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import "./lib/fonts";
import { LOOP } from "./lib/random";
import { VERSIONS } from "./versions";

// Every composition: 3840×2160, 30fps, 600 frames. `loopCheck: true` adds one
// frame (601) so frame 600 can be compared with frame 0.
type Common = { loopCheck?: boolean };
const meta: CalculateMetadataFunction<Common> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={v.component as React.FC<Common>}
        durationInFrames={LOOP}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ ...(v.props as object), loopCheck: false } as Common}
        calculateMetadata={meta}
      />
    ))}
  </>
);
