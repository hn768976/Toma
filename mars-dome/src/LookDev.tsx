import React from "react";
import { useCurrentFrame } from "remotion";
import { Variant } from "./config";
import { MarsDome } from "./MarsDome";

/**
 * Look-development stills: frame i of this composition shows key moment i of
 * the animation (start, middle, the far end of the camera drift).
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
  return <MarsDome variant={variant} atFrame={moment.frame} />;
};

/**
 * Loop check: frame 0 of this composition shows the frame *after* the last one,
 * frame 1 shows frame 0. The two must be identical, pixel for pixel.
 *   npx remotion render LoopCheck out/loop --sequence --image-format=png --scale=0.5
 */
export const LoopCheck: React.FC<{ variant: Variant; loopFrames: number }> = ({ variant, loopFrames }) => {
  const frame = useCurrentFrame();
  return <MarsDome variant={variant} atFrame={frame === 0 ? loopFrames : 0} />;
};
