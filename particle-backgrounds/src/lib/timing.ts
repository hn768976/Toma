/** All looks: 30 fps, 600 frames = 20 s seamless loop. */
export const FPS = 30;
export const LOOP_FRAMES = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Loop phase in [0,1). Frame 600 maps to exactly the same phase as frame 0. */
export const loopPhase = (frame: number) => (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;
