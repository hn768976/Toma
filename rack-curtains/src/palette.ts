import { z } from "zod";

export type Palette = {
  /** Deep background, away from the lit regions. */
  bgDeep: string;
  /** Background where the shafts and panel clusters light the haze. */
  bgLit: string;
  /** Dimmest state of a panel dot. */
  dotDim: string;
  /** Brightest state of a panel dot. */
  dotBright: string;
  /** Light shaft colour. */
  shaft: string;
};

export const V1_CYAN: Palette = {
  bgDeep: "#062a52",
  bgLit: "#0a4a7a",
  dotDim: "#1a6a9e",
  dotBright: "#7ae8ff",
  shaft: "#a8e8ff",
};

export const V2_MAGENTA: Palette = {
  bgDeep: "#2a0a4a",
  bgLit: "#4a1070",
  dotDim: "#7a2ab0",
  dotBright: "#ff8ae8",
  shaft: "#ffb0f0",
};

export const paletteSchema = z.object({
  bgDeep: z.string(),
  bgLit: z.string(),
  dotDim: z.string(),
  dotBright: z.string(),
  shaft: z.string(),
});

/** "#7ae8ff" -> [0.478, 0.910, 1.0] */
export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
