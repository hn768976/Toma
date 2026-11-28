import React from "react";
import { Freeze, useCurrentFrame } from "remotion";
import { Variant } from "./config";
import { MarsDome } from "./MarsDome";

/**
 * Look-development stills: frame i of this composition shows key moment i of
 * the animation (start, middle, the far end of the camera drift), frozen.
 *   npx remotion render LookDev out/lookdev --frames=0-2 --sequence --image-format=png --scale=0.5
 */
export const LOOKDEV_MOMENTS = [
  { name: "start", frame: 0, refSeconds: 0.0 },
  { name: "middle", frame: 156, refSeconds: 5.2 },
  { name: "peak", frame: 188, refSeconds: 6.25 },
];

export const LookDev: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const moment = LOOKDEV_MOMENTS[Math.min(frame, LOOKDEV_MOMENTS.length - 1)];
  return (
    <Freeze frame={moment.frame}>
      <MarsDome variant={variant} />
    </Freeze>
  );
};
