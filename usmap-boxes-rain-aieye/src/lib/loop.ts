// Frame helpers for seamless loops. Every animated value is periodic by construction
// (whole cycles per loop); `wrapFrame` additionally folds the frame into [0, period) so
// frame 600 is bit-identical to frame 0. The loop-check mode (`noWrap`) disables the
// fold for motion so the periodicity itself can be verified.
let noWrap = false;
export const setNoWrap = (v: boolean) => {
  noWrap = v;
};
export const wrapFrame = (frame: number, period: number) => ((frame % period) + period) % period;
export const motionFrame = (frame: number, period: number) => (noWrap ? frame : wrapFrame(frame, period));
