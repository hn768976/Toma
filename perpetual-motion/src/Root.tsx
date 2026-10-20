import React from "react";
import { Composition, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { MachineVideo } from "./lib/Stage.tsx";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/camera.ts";
import type { LookName } from "./lib/look.ts";
import { MACHINES } from "./machines/index.ts";

export type MachineCompProps = {
  /** "workshop" renders the series look; "blueprint" is the alternate data row. */
  look: LookName;
  /** true adds frame 600 (= frame 0) so the loop seam can be checked. */
  verify: boolean;
};

const metadata: CalculateMetadataFunction<MachineCompProps> = ({ props }) => ({
  durationInFrames: props.verify ? LOOP + 1 : LOOP,
});

const make = (id: string) => {
  const def = MACHINES[id];
  const Comp: React.FC<MachineCompProps> = ({ look }) => {
    // every value downstream comes from this frame number
    const frame = useCurrentFrame();
    return <MachineVideo def={def} frame={frame} look={look} />;
  };
  Comp.displayName = id;
  return Comp;
};

export const RemotionRoot: React.FC = () => (
  <>
    {Object.keys(MACHINES).map((id) => (
      <Composition
        key={id}
        id={id}
        component={make(id)}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ look: "workshop", verify: false } as MachineCompProps}
        calculateMetadata={metadata}
      />
    ))}
  </>
);
