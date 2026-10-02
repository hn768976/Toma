export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Positive modulo, safe for negative inputs. */
export const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Phase of a seamless loop in [0, 1). Uses an integer modulo on the frame so
 * frame LOOP lands on exactly the same value as frame 0 (no float drift).
 */
export const loopPhase = (frame: number, loopFrames: number) =>
  mod(Math.round(frame), loopFrames) / loopFrames;

export const TAU = Math.PI * 2;
