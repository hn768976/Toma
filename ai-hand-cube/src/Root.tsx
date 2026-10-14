import React from "react";
import { Composition } from "remotion";
import { AIHandCube } from "./AIHandCube";
import { HandStudy } from "./HandStudy";
import { VERSIONS } from "./versions";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VERSIONS.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={AIHandCube}
          defaultProps={{ versionId: v.id }}
          durationInFrames={v.durationInFrames}
          fps={30}
          width={3840}
          height={2160}
        />
      ))}
      {/* Realism gate: the hand alone, 3 views (frame 0, 1, 2) */}
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
