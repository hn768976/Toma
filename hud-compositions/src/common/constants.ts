// Both compositions are authored at 4K UHD and rendered to 1080p with
// `--scale=0.5` for delivery (see README).
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

// HUD layers are laid out in a 1920x1080 design space and scaled up to the
// composition size, so all HUD coordinates below are in that space.
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

// Reference durations: 22.2556 s and 20.8542 s. At exactly 30 fps the
// nearest frame counts are 668 (22.2667 s) and 626 (20.8667 s), both within
// half a frame of the reference.
export const SATELLITE_DURATION = 668;
export const WORLD_DURATION = 626;

export const FONT_LABEL = "'Barlow Condensed', sans-serif";
export const FONT_MONO = "'Share Tech Mono', monospace";
