// Every beat in the 360-frame (12s @ 30fps) clip. Frames, not seconds, so the
// table matches the storyboard one-to-one.
export const DURATION = 360;

export const FILL_WIPE = {from: 15, to: 45} as const;

export const PING = {from: 30, to: 70, rings: 3, ringStagger: 8} as const;

export const CITIES = {
  from: 50,
  to: 140,
  markerRise: 14, // frames for a marker to reach full size
  labelDelay: 6,
  labelFade: 12,
} as const;

export const NAME = {from: 90, to: 130} as const;

// The push runs the entire clip: 1.0 to 1.18, easing off so the last two
// seconds are close to still. Nothing bounces — this is a bed, not a reveal.
//
// Shared with tools/bake.mjs, which needs the same numbers to work out which
// part of the frame is still on screen at the end of the push and cull labels
// that the push would crop.
import PUSH from './push.json';

export {PUSH};
