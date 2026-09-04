import { useVideoConfig } from "remotion";
import {
  CHAR_ADVANCE,
  FONT_TO_ROW,
  ROWS_ON_SCREEN,
} from "./constants";

export type Layout = {
  width: number;
  height: number;
  rowH: number;
  fontSize: number;
  charW: number;
};

/**
 * All sizes derive from the frame height, and the ratios are chosen so each one
 * is a whole pixel at 4K (40 / 30 / 18) and at 1080p (20 / 15 / 9).
 */
export const useLayout = (): Layout => {
  const { width, height } = useVideoConfig();
  const rowH = height / ROWS_ON_SCREEN;
  const fontSize = rowH * FONT_TO_ROW;
  return { width, height, rowH, fontSize, charW: fontSize * CHAR_ADVANCE };
};
