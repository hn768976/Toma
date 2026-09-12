import { Easing, interpolate } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";

// The loading curve, shared by both variants so the two versions stay in
// sync frame-for-frame.
//
// A perfectly linear bar reads as fake, so the fill advances through four
// segments with different speeds — a quick start, a long steady middle, a
// short stall around 70%, then a confident run to 100% that lands a beat
// before the last frame and holds.
const SEGMENTS: { frame: number; value: number }[] = [
  { frame: 0, value: 0 },
  { frame: 26, value: 0.14 },
  { frame: 96, value: 0.44 },
  { frame: 150, value: 0.63 },
  { frame: 176, value: 0.68 }, // the stall
  { frame: 224, value: 1 },
  { frame: DURATION_IN_FRAMES, value: 1 },
];

export const getProgress = (frame: number): number => {
  return interpolate(
    frame,
    SEGMENTS.map((s) => s.frame),
    SEGMENTS.map((s) => s.value),
    {
      easing: Easing.inOut(Easing.ease),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
};

// "Generating" gets one animated ellipsis dot per ~9 frames, cycling 1-3.
export const getDotCount = (frame: number): number => {
  return (Math.floor(frame / 9) % 3) + 1;
};
