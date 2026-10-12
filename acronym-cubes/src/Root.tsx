import React from "react";
import { Composition } from "remotion";
import { AcronymCubes, type AcronymCubesProps } from "./AcronymCubes";
import { ACRONYMS, compositionId } from "./data/acronyms";
import { LOOP } from "./scene/layout";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {ACRONYMS.map((row) => (
        <Composition
          key={row.id}
          id={compositionId(row)}
          component={AcronymCubes}
          durationInFrames={LOOP}
          fps={30}
          width={3840}
          height={2160}
          defaultProps={{ row, loopTest: false } satisfies AcronymCubesProps}
          // Loop self-test: --props='{"loopTest":true}' renders 601 frames so
          // frame 600 can be compared with frame 0.
          calculateMetadata={({ props }) => ({ durationInFrames: props.loopTest ? LOOP + 1 : LOOP })}
        />
      ))}
    </>
  );
};
