import React from "react";
import { Composition } from "remotion";
import { Fingerprint } from "./Fingerprint";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FingerprintScan"
        component={Fingerprint}
        durationInFrames={420}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "acquire" as const }}
      />
    </>
  );
};
