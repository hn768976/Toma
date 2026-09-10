// The `Ai` wordmark, drawn as our own outlines rather than set in a
// typeface - a stock clip can't carry a font licence.
//
// Authored in a local box roughly 6..81 across and 12..78 down. The
// capital A is three overlapping slabs (two splayed legs sharing a flat
// apex, plus a crossbar) filled with the nonzero rule so the overlaps
// merge; the lowercase i is a stem and a round tittle.

import { circlePath } from "./svg-shapes";

export const MARK_LEFT = 6;
export const MARK_RIGHT = 81;
export const MARK_TOP = 12;
export const MARK_BOTTOM = 78;

export const MARK_CENTER_X = (MARK_LEFT + MARK_RIGHT) / 2;
export const MARK_CENTER_Y = (MARK_TOP + MARK_BOTTOM) / 2;

export const MARK_PATH = [
  // A - left leg, splaying down-left from the apex.
  "M 30 12 L 36 12 L 17 78 L 6 78 Z",
  // A - right leg. Mirrored about x = 33, but re-ordered so it winds the
  // same way as the left leg: with the nonzero rule, opposite windings
  // would cancel where the two legs overlap and punch a hole in the apex.
  "M 30 12 L 36 12 L 60 78 L 49 78 Z",
  // A - crossbar, tucked inside both legs so the joins merge cleanly.
  "M 14.2 54 L 51.8 54 L 51.8 64.5 L 14.2 64.5 Z",
  // i - stem.
  "M 70 31 L 81 31 L 81 78 L 70 78 Z",
  // i - tittle.
  circlePath(75.5, 16.8, 5.3),
].join(" ");
