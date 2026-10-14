import React from "react";
import { Composition } from "remotion";
import { ROWS } from "./data/versions";
import { VersionScene, type SceneProps } from "./Scenes";

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={VersionScene}
        durationInFrames={row.frames}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ rowId: row.id } as SceneProps}
        // --props='{"durationOverride":601}' is used by the loop check.
        calculateMetadata={({ props }: { props: SceneProps }) => ({
          durationInFrames: props.durationOverride ?? row.frames,
        })}
      />
    ))}
  </>
);
