/** Base composition size. Everything downstream is a fraction of these, so a
 *  1080p preview and a 4K render are pixel-identical up to resolution. */
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 20s. Every cyclic animation completes an integer number of passes in this
 *  many frames, so frame 600 is identical to frame 0 (see MOTION in README). */
export const DURATION_IN_FRAMES = 600;

/** Border draw-on, then staggered furniture reveal, then hold. */
export const BORDER_DRAW_END = 60;
export const FURNITURE_START = 60;
export const FURNITURE_GROUP_STAGGER = 14;
export const FURNITURE_FADE = 20;

/** Glow breathing period; 600 / 120 = 5 whole cycles. */
export const GLOW_PERIOD = 120;
