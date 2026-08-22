// The camera scrolls sideways across the sheet. Panning right is the default;
// a move begins every 120 frames, runs 90 and holds 30, and between moves the
// camera is completely still.
//
// One push-in in the whole video (scene 3) and the pull-out that undoes it
// (scene 5). Nothing else changes scale.

import { Easing } from "remotion";
import { WIDTH } from "./constants";

export type CameraMove = {
  start: number;
  duration: number;
  /** Scene-space pan. Positive moves the camera right (content slides left). */
  dx?: number;
  ds?: number;
  label: string;
};

const CAMERA_EASING = Easing.bezier(0.45, 0, 0.55, 1);

export const CAMERA_MOVES: CameraMove[] = [
  // scene 1 — f0 still
  { start: 120, duration: 90, dx: 300, label: "pan right" },
  // scene 2
  { start: 240, duration: 90, dx: 300, label: "pan right" },
  // f360 still
  { start: 480, duration: 90, dx: 300, label: "pan right" },
  // scene 3
  { start: 600, duration: 90, dx: 300, label: "pan right onto the skull" },
  { start: 720, duration: 90, ds: 0.15, label: "push in 1.00 → 1.15 (the only push)" },
  // f840 still
  // scene 4
  { start: 960, duration: 90, dx: 300, label: "pan right" },
  // Runs 60 rather than 90: scene 5's pan starts at f1140 and the cue sheet
  // puts these two only 60 frames apart, so this one lands exactly as that
  // one begins instead of overlapping it.
  { start: 1080, duration: 60, dx: 300, label: "pan right" },
  // scene 5
  { start: 1140, duration: 90, dx: 300, label: "pan right onto the bank" },
  // f1260 still
  { start: 1380, duration: 90, ds: -0.15, label: "pull out to fit all three labels" },
  // scene 6
  { start: 1500, duration: 90, dx: 300, label: "pan right onto empty white" },
  // f1620 still · f1710 camera stops
];

export type CameraState = { centre: number; scale: number };

/** Where the camera starts. Slightly left of the sheet's first mark so scene 1
 *  sits in the frame rather than against its edge. */
const HOME_CENTRE = 880;

export const cameraAt = (frame: number): CameraState => {
  let centre = HOME_CENTRE;
  let scale = 1;

  for (const move of CAMERA_MOVES) {
    const raw = (frame - move.start) / move.duration;
    if (raw <= 0) continue;
    const progress = raw >= 1 ? 1 : CAMERA_EASING(raw);
    centre += (move.dx ?? 0) * progress;
    scale += (move.ds ?? 0) * progress;
  }

  return { centre, scale };
};

/** The sheet x-range on screen at a given frame — handy for placing content. */
export const viewportAt = (frame: number) => {
  const { centre, scale } = cameraAt(frame);
  const half = WIDTH / 2 / scale;
  return { left: centre - half, right: centre + half, scale };
};
