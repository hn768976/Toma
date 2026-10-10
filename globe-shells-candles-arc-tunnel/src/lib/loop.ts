export const FPS = 30;
export const LOOP = 600; // 20 s
export const WIDTH = 3840;
export const HEIGHT = 2160;

// All motion is a function of the loop phase only. Every animated term uses a
// whole number of cycles per loop, so frame 600 is the same picture as frame 0.
export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;
export const TAU = Math.PI * 2;

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};
