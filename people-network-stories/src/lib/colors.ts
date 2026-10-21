import colors from "../../data/colors.json";
import counts from "../../data/counts.json";
import { hexToRgb } from "./ease";

export const COLORS = colors;
export const COUNTS = counts;
export const rgb = (hex: string) => hexToRgb(hex);
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
