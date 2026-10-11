import React from "react";
import { Composition, getInputProps } from "remotion";
import { GLStage } from "./lib/GLStage";
import { VERSIONS } from "./versions";

const loopCheck = !!(getInputProps() as { loopCheck?: boolean }).loopCheck;

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => {
      const Comp: React.FC = () => <GLStage factory={v.factory} label={v.id} />;
      return (
        <Composition
          key={v.id}
          id={v.id}
          component={Comp}
          durationInFrames={v.frames + (loopCheck && v.loop ? 1 : 0)}
          fps={30}
          width={3840}
          height={2160}
        />
      );
    })}
  </>
);
