// The camera. It never sits still: a new move starts at least every 60 frames
// (2s) for the whole 870-frame runtime, and every move runs a little longer
// than the gap to the next one so two moves always overlap and the motion
// never fully settles.
//
// Moves are stored as *deltas* and summed. That is what makes overlap work:
// a pull-out that is still easing out simply adds to a lateral drift that has
// just started, instead of fighting it for control of one value.

import { Easing } from "remotion";

export type CameraMove = {
  /** Frame the move starts on. */
  start: number;
  /** How long it eases over. Longer than the gap to the next move. */
  duration: number;
  /** Camera translation in viewport px. +x pans right, +y pans down. */
  dx?: number;
  dy?: number;
  /** Zoom delta added to the running scale. */
  ds?: number;
  /** Human-readable, for the timeline overlay and for reading the list. */
  label: string;
};

// Every move uses the same curve — cubic-bezier(0.4, 0, 0.2, 1).
// No linear, no bounce.
const CAMERA_EASING = Easing.bezier(0.4, 0, 0.2, 1);

export const CAMERA_MOVES: CameraMove[] = [
  { start: 0, duration: 34, ds: 0.08, label: "push in 1.00 → 1.08" },
  { start: 30, duration: 34, ds: 0.07, label: "push continues 1.08 → 1.15" },
  { start: 60, duration: 66, dx: 120, label: "lateral drift right" },
  { start: 90, duration: 66, ds: -0.15, label: "pull out 1.15 → 1.00" },
  { start: 150, duration: 66, dx: -90, dy: 60, label: "diagonal drift down-left" },
  { start: 180, duration: 66, ds: 0.12, label: "push in on the guard" },
  { start: 240, duration: 66, ds: -0.12, label: "slow pull out" },
  { start: 270, duration: 66, dx: -120, label: "lateral drift left" },
  { start: 330, duration: 66, ds: 0.1, label: "push in 1.00 → 1.10" },
  { start: 360, duration: 66, dy: -80, label: "vertical drift up" },
  { start: 390, duration: 66, ds: -0.1, label: "pull out to reveal the burst" },
  { start: 420, duration: 66, ds: 0.08, label: "slow push back in" },
  { start: 450, duration: 66, dx: 120, label: "lateral drift right" },
  { start: 510, duration: 66, ds: -0.13, dy: -40, label: "pull out wide — guard alone" },
  { start: 540, duration: 66, ds: 0.13, dx: -60, label: "push in on the cushion" },
  { start: 600, duration: 66, dx: 110, ds: -0.05, label: "slow orbit" },
  { start: 660, duration: 66, dy: -90, label: "vertical drift up toward the ?" },
  { start: 705, duration: 50, ds: -0.11, dx: -70, label: "pull out wide" },
  // The two moves below are the cue sheet's two flagged exceptions to the
  // "never more than 15% scale" envelope: the tightest and the widest shot.
  { start: 750, duration: 55, ds: 0.33, dx: 90, dy: 40, label: "hard push in on the gauge → 1.25" },
  { start: 810, duration: 60, ds: -0.3, dx: -60, dy: 120, label: "wide pull out 1.25 → 0.95" },
  // Starts near the end and is still running at frame 870 so the final frame
  // is mid-move rather than parked.
  { start: 840, duration: 90, dx: 70, dy: -30, label: "still drifting on the last frame" },
];

export type CameraState = { x: number; y: number; scale: number };

export const cameraAt = (frame: number): CameraState => {
  let x = 0;
  let y = 0;
  let scale = 1;

  for (const move of CAMERA_MOVES) {
    const raw = (frame - move.start) / move.duration;
    const progress = raw <= 0 ? 0 : raw >= 1 ? 1 : CAMERA_EASING(raw);
    if (progress === 0) continue;
    x += (move.dx ?? 0) * progress;
    y += (move.dy ?? 0) * progress;
    scale += (move.ds ?? 0) * progress;
  }

  return { x, y, scale };
};

/** The move that most recently started at or before `frame`. */
export const currentMove = (frame: number): CameraMove =>
  CAMERA_MOVES.reduce((best, move) =>
    move.start <= frame && move.start >= best.start ? move : best,
  );
