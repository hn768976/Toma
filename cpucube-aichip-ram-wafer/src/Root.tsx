import React from "react";
import { Composition, Folder } from "remotion";
import { LookCanvas } from "./lib/LookCanvas";
import { FPS, LOOP } from "./lib/loop";
import { DEV_VERSIONS, VERSIONS } from "./versions";

// REMOTION_LOOP_CHECK=1 gives 601-frame compositions for the loop test
// (frame 600 must equal frame 0).
const DURATION = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP + 1 : LOOP;

const Look: React.FC<{ version: string }> = ({ version }) => {
  const v = [...VERSIONS, ...DEV_VERSIONS].find((x) => x.id === version)!;
  return <LookCanvas factory={v.factory} params={v.params} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Look}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ version: v.id }}
      />
    ))}
    <Folder name="dev">
      {DEV_VERSIONS.map((v) => (
        <Composition key={v.id} id={v.id} component={Look} durationInFrames={1} fps={FPS} width={3840} height={2160} defaultProps={{ version: v.id }} />
      ))}
    </Folder>
  </>
);
