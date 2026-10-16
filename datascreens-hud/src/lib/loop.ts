export const FPS = 30;
export const LOOP_FRAMES = 600; // 20 s
export const LOOP_SECONDS = LOOP_FRAMES / FPS;

// Normalised loop phase in [0,1). Frame 600 maps to the same phase as frame 0.
export const loopPhase = (frame: number) =>
  (((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES) / LOOP_FRAMES;

export const loopFrame = (frame: number) =>
  ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;

export const fract = (x: number) => x - Math.floor(x);
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};
