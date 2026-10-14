import React from "react";
import { Composition } from "remotion";
import { WalletScene } from "./WalletScene";
import { FPS, HEIGHT, VERSIONS, WIDTH, compositionId } from "./versions";

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        // Remotion ids allow only letters, digits and '-': WalletBlocks_Blue -> WalletBlocks-Blue
        id={compositionId(v.id)}
        component={WalletScene}
        durationInFrames={v.durationInFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ versionId: v.id }}
      />
    ))}
  </>
);
