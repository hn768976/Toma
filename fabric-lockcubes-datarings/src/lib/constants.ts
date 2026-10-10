export const FPS = 30;
/** Every composition is a 20s seamless loop: frame LOOP equals frame 0. */
export const LOOP = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Loop phase in [0, 1). Everything animated is a whole-cycle function of this. */
export const phase = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
export const TAU = Math.PI * 2;
