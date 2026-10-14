// Every composition is a 20s loop at 30fps. All motion is a function of
// `loopFrame = frame % LOOP`, and every periodic term completes a whole number
// of cycles in LOOP frames, so frame 600 is exactly frame 0.
export const FPS = 30;
export const LOOP = 600;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;
/** 0..1 phase of the loop */
export const loopPhase = (frame: number) => loopFrame(frame) / LOOP;
/** angle on the loop circle, 0..2π */
export const loopTheta = (frame: number) => loopPhase(frame) * Math.PI * 2;

/** smooth 0→1→0 bump on [a,b] of phase p (cosine window), 0 outside */
export const bump = (p: number, a: number, b: number) => {
  if (p <= a || p >= b) return 0;
  const x = (p - a) / (b - a);
  return 0.5 - 0.5 * Math.cos(x * Math.PI * 2);
};

/** canvas backing-store scale: Remotion's --scale sets devicePixelRatio. */
export const renderDpr = () =>
  typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 1);
