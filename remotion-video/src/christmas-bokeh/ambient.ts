// A very slight drift of the whole composition — not a camera move, just
// enough that the frame is never completely static. Both axes are whole
// cycles over the loop, so the path closes at frame 240.

import { AMBIENT_DRIFT, DURATION_IN_FRAMES } from "./config";
import { TAU } from "./canvas";

const PHASE_Y = Math.PI / 3;

export const ambientDrift = (frame: number, scale: number) => ({
  x: AMBIENT_DRIFT * scale * Math.sin((TAU * frame) / DURATION_IN_FRAMES),
  y:
    AMBIENT_DRIFT *
    scale *
    0.7 *
    Math.sin((TAU * 2 * frame) / DURATION_IN_FRAMES + PHASE_Y),
});
