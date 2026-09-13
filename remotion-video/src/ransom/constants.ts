// Timing and canvas config for the ransom-note title animation.
//
// Everything is authored in a 1920x1080 design space. Higher-resolution
// compositions render the exact same layout scaled up (see RansomNote), so the
// 1080p and 4K outputs are guaranteed to match frame for frame.

export const FPS = 30;
export const DURATION_IN_FRAMES = 300; // 10.0s

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const BACKGROUND_COLOR = "#000000";

// Stop-motion cadence. The reference holds each pose for 3 frames before
// moving, i.e. it is shot "on 3s" (10 poses/sec at 30fps). Every animated
// value is quantised to this step, which is what gives the piece its
// handmade, paper-under-a-camera feel instead of a smooth digital tween.
export const BOIL_STEP = 3;

// Build-in: letters unfold left-to-right, all lines running in parallel.
//
// The wave takes the same time to cross the piece however many letters it has
// to cross, so a 6-letter line and a 10-letter line read at the same pace and
// the last letter always lands in the same place. Per-letter stagger is
// derived from the span, not fixed, which also keeps the crumple-out from
// running off the end of the composition on a longer word.
export const IN_START = 16;
export const IN_WAVE_SPAN = 25;
export const IN_DURATION = 16;

// Build-out: the same wave, crumpling back up.
export const OUT_START = 246;
export const OUT_WAVE_SPAN = 25;
export const OUT_DURATION = 14;

// Stagger between neighbouring letters, given how many follow the first.
export const waveStagger = (span: number, maxCol: number): number =>
  maxCol > 0 ? span / maxCol : 0;

// How small a letter balls up to at its most crumpled.
export const CRUMPLE_SCALE = 0.34;

// Cut-paper edge. Magazine letters are scissored out, so every tile carries a
// sliver of the page's white core around its rim. It is also what keeps the
// near-black tiles legible against a pure black background.
export const PAPER_EDGE_COLOR = "#EDE6D6";
export const PAPER_EDGE_PX = 3;
