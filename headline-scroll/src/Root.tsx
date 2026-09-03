import React from "react";
import { Composition } from "remotion";
import { HeadlineScroll } from "./HeadlineScroll";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HeadlinesLight"
        component={HeadlineScroll}
        durationInFrames={348}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "light" as const }}
      />
      <Composition
        id="HeadlinesPaper"
        component={HeadlineScroll}
        durationInFrames={348}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "paper" as const }}
      />
    </>
  );
};
