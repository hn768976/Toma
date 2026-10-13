import React from "react";
import { Composition, getInputProps } from "remotion";
import { LightStreams } from "./looks/LightStreams";
import { PillSpill } from "./looks/PillSpill";
import { DataStrands } from "./looks/DataStrands";
import { NeonWaves } from "./looks/NeonWaves";
import { ShieldDome } from "./looks/ShieldDome";
import { VERSIONS } from "./versions";

const COMPONENTS = {
  lightStreams: LightStreams,
  pillSpill: PillSpill,
  dataStrands: DataStrands,
  neonWaves: NeonWaves,
  shieldDome: ShieldDome,
} as const;

// Verification only: --props='{"loopCheck":true}' adds one frame to every
// loop so frame 600 can be rendered and compared with frame 0.
const loopCheck = Boolean((getInputProps() as { loopCheck?: boolean }).loopCheck);

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => {
      const Comp = COMPONENTS[v.look as keyof typeof COMPONENTS] as React.FC<Record<string, unknown>>;
      if (!Comp) return null;
      return (
        <Composition
          key={v.id}
          id={v.id}
          component={Comp}
          defaultProps={v.props as Record<string, unknown>}
          durationInFrames={v.frames + (loopCheck && v.frames === 600 ? 1 : 0)}
          fps={30}
          width={3840}
          height={2160}
        />
      );
    })}
  </>
);
