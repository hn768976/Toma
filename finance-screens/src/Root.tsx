import React from "react";
import { Composition } from "remotion";
import { FinanceScreen } from "./engine/FinanceScreen";
import { VERSIONS } from "./versions";
import { LOOP } from "./engine/rng";

type Props = { versionId: string; loopCheck?: boolean };

const Comp: React.FC<Props> = ({ versionId }) => {
  const v = VERSIONS.find((x) => x.id === versionId);
  if (!v) throw new Error(`Unknown version ${versionId}`);
  return <FinanceScreen version={v} />;
};

// 3840x2160, 30 fps, 600 frames. `loopCheck: true` (via --props) makes a
// composition 601 frames long so frame 600 can be compared with frame 0.
export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Comp}
        fps={30}
        width={3840}
        height={2160}
        durationInFrames={LOOP}
        defaultProps={{ versionId: v.id, loopCheck: false } as Props}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
        })}
      />
    ))}
  </>
);
