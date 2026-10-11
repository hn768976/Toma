export const FPS = 30;
export const LOOP = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Every animated value is derived from this phase. Using frame % LOOP makes
// frame 600 the exact same input as frame 0; all motion is also built from
// whole cycles per loop, so 599 -> 600 is continuous as well.
export const loopPhase = (frame: number) => (((frame % LOOP) + LOOP) % LOOP) / LOOP;
export const TAU = Math.PI * 2;
