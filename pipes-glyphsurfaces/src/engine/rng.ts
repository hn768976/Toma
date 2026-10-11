// Seeded PRNG. Every random choice in the project goes through this, seeded
// with a fixed constant, so results never depend on render order or thread.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const LOOP_FRAMES = 600;
export const FPS = 30;

// Everything on screen is a function of this phase in [0, 1).
export const loopFrame = (frame: number) =>
  ((Math.round(frame) % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
export const loopT = (frame: number) => loopFrame(frame) / LOOP_FRAMES;
