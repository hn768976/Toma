export const FPS = 30;
export const DURATION = 450; // 15 s
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type Direction = "Up" | "Down";
export const DIRECTIONS: Direction[] = ["Up", "Down"];

// Timeline (frames)
export const FADE_IN_END = 30;
export const LINE_START = 15;
export const LINE_END = 390;
export const ARROWS_START = 60;
export const ARROWS_END = 420;

export const PRESETS: Record<
  Direction,
  { line: string; core: string; ticker: string; sign: "+" | "−"; flagDim: number }
> = {
  // flagDim = opacity of the black layer over the flag (0.40 → ~60% brightness)
  Up: { line: "#5CFF5C", core: "#EFFFEF", ticker: "#D2F25A", sign: "+", flagDim: 0.4 },
  Down: { line: "#FF3B3B", core: "#FFF1F1", ticker: "#FF7A45", sign: "−", flagDim: 0.46 },
};
