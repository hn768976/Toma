/**
 * Delivery spec, matched to the reference clip: 20.000s at 30fps = 600 frames,
 * 16:9. The 4K pair are the master compositions; 1080p deliverables are
 * rendered from them at --scale 0.5, which lands on exactly 1920x1080.
 */
export const HUD_FPS = 30;
export const HUD_DURATION_IN_SECONDS = 20;
export const HUD_DURATION_IN_FRAMES = HUD_FPS * HUD_DURATION_IN_SECONDS;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;
export const HD_WIDTH = 1920;
export const HD_HEIGHT = 1080;
