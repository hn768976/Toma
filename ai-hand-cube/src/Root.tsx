import React from "react";
import { Composition } from "remotion";
import { HandStudy } from "./HandStudy";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HandStudy"
        component={HandStudy}
        durationInFrames={3}
        fps={30}
        width={3840}
        height={2160}
      />
    </>
  );
};
