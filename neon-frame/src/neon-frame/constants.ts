/** Composition-wide constants. Everything here is fixed for both variants. */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 360 frames @ 30fps = 12.0s, and the loop length everything closes over. */
export const DURATION_IN_FRAMES = 360;

/**
 * The canonical clock. Every animated quantity is a function of this, and
 * every period divides DURATION_IN_FRAMES, so frame 0 and frame 360 are
 * pixel-identical by construction.
 */
export const loopedFrame = (frame: number) =>
  ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;

export const layerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
};
