import { useVideoConfig } from "remotion";

/** Every look is authored on a 3840-wide design grid. */
export const DESIGN_WIDTH = 3840;
export const DESIGN_HEIGHT = 2160;

/**
 * Returns a function that converts design-grid pixels (at 3840x2160) into
 * pixels of the actual composition, i.e. every size is a fraction of the
 * frame width. A 2px line at 4K stays 1px at 1920x1080, and so on.
 */
export const useUnit = () => {
  const { width, height } = useVideoConfig();
  const s = width / DESIGN_WIDTH;
  const u = (px: number) => px * s;
  return { u, s, width, height };
};
