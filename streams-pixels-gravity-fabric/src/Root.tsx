import React from "react";
import { Composition } from "remotion";
import { Stage } from "./gl/Stage";
import { LOOP } from "./rng";
import { VERSIONS } from "./versions";

type Props = { durationInFrames?: number };

// One composition per data row in versions.ts. All 3840x2160, 30fps, 600 frames.
// `--props='{"durationInFrames":601}'` extends a composition for the loop check.
export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => {
      const Comp: React.FC<Props> = () => <Stage create={v.create} />;
      Comp.displayName = v.id;
      return (
        <Composition
          key={v.id}
          id={v.id}
          component={Comp}
          width={3840}
          height={2160}
          fps={30}
          durationInFrames={LOOP}
          defaultProps={{} as Record<string, unknown>}
          calculateMetadata={({ props }) => ({
            durationInFrames: (props as Props).durationInFrames ?? LOOP,
          })}
        />
      );
    })}
  </>
);
