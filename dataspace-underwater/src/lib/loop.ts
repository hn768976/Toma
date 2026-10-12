// Loop helpers. All five compositions are 600-frame seamless loops: every
// visual is a function of `frame % LOOP` only, so frame 600 === frame 0.
export const LOOP = 600;
export const FPS = 30;
export const COMP_W = 3840;
export const COMP_H = 2160;
export const TAU = Math.PI * 2;

export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;
/** θ = 2π·frame/600 — the only clock in the project. */
export const loopTheta = (frame: number) => (TAU * loopFrame(frame)) / LOOP;
/** Positive modulo. */
export const pmod = (a: number, n: number) => ((a % n) + n) % n;
