import { useCurrentFrame } from "remotion";
import { DURATION_IN_FRAMES } from "./config";

/**
 * The current frame folded into [0, 240).
 *
 * Every period in the piece is a whole number of cycles per loop, so
 * frame 240 already lands on frame 0 mathematically — but `sin(phase +
 * 2*pi*k)` and `sin(phase)` are not bit-identical in floating point, and
 * the difference shows up as the odd 1/255 antialiasing wobble. Folding
 * the frame first makes the two frames identical pixel for pixel.
 */
export const useLoopFrame = () => {
  const frame = useCurrentFrame();
  return (
    ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES
  );
};
