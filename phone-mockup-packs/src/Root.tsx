import React from "react";
import { Composition } from "remotion";
import { compositionId, PACKS, PACKS_FILE } from "./data";
import { PhonePack } from "./PhonePack";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {PACKS.map((pack) => (
        <Composition
          key={pack.id}
          id={compositionId(pack.id)}
          component={PhonePack}
          durationInFrames={pack.segments.reduce((sum, s) => sum + s.length, 0)}
          fps={PACKS_FILE.fps}
          width={PACKS_FILE.width}
          height={PACKS_FILE.height}
          defaultProps={{ packId: pack.id }}
        />
      ))}
    </>
  );
};
