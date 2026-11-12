import React from "react";
import { Composition } from "remotion";
import { DnaHelix } from "./dna/DnaHelix";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps.
// Reference clip length: 10.033 s = 301 frames @ 30 fps.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DNA-Helix-Spectrum-V1-Reference"
      component={DnaHelix}
      fps={30}
      durationInFrames={301}
      width={3840}
      height={2160}
      defaultProps={{ variant: "v1" as const }}
    />
    <Composition
      id="DNA-Helix-Spectrum-V2-Orbit-Camera"
      component={DnaHelix}
      fps={30}
      durationInFrames={301}
      width={3840}
      height={2160}
      defaultProps={{ variant: "v2" as const }}
    />
  </>
);
