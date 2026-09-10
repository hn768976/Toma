// The compositions are authored at 4K so the same source can be rendered
// at 3840x2160 later; every size in the scene is expressed as a fraction
// of the frame from useVideoConfig(), so `--scale=0.5` previews are
// pixel-for-pixel the same picture, just smaller.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s — a hold, not a loop.

// Motion beats, in frames.
export const PROMPT_TYPE_START = 20;
export const PROMPT_TYPE_END = 60;
export const CODE_TYPE_START = 62;
export const CODE_TYPE_END = 415;

// One full turn of the orb takes 16s, so the 20s clip shows 1.25 turns
// and never lands back where it started (this clip is not a loop).
export const ORB_ROTATION_PERIOD = 480;
export const ORB_BREATH_PERIOD = 214;
