import React from "react";
import { Freeze, useCurrentFrame } from "remotion";
import { Variant } from "./config";
import { Conveyor } from "./Conveyor";

/**
 * Look-development stills: frame i of this composition shows key moment i of
 * the animation (start, the light arriving, fully lit), frozen.
 *   npx remotion render LookDev out/lookdev --frames=0-2 --sequence --image-format=png --scale=0.5
 */
export const LOOKDEV_MOMENTS = [
  { name: "start", frame: 0, refSeconds: 0.0 },
  { name: "peak", frame: 90, refSeconds: 3.0 },
  { name: "middle", frame: 156, refSeconds: 5.2 },
];

export const LookDev: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const moment = LOOKDEV_MOMENTS[Math.min(frame, LOOKDEV_MOMENTS.length - 1)];
  return (
    <Freeze frame={moment.frame}>
      <Conveyor variant={variant} />
    </Freeze>
  );
};
