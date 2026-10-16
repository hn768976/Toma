export const FPS = 30;
/** Every composition is a 20 s seamless loop. */
export const LOOP = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Phase of the loop in [0, 1). Frame 600 maps to exactly the same value as frame 0. */
export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;
export const TAU = Math.PI * 2;
