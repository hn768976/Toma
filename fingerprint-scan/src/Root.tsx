import React from "react";
import { Composition } from "remotion";
import { Fingerprint } from "./Fingerprint";

/**
 * Both versions run the same component. Everything that differs between them —
 * palette, scan mode, panel set, outcome — is read from VARIANTS by name.
 */
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
      <Composition
        id="FingerprintVerify"
        component={Fingerprint}
        durationInFrames={420}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ variant: "verify" as const }}
      />
    </>
  );
};
