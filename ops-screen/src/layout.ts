import { useVideoConfig } from "remotion";

/**
 * Everything on screen is sized as a fraction of frame height, so the
 * 1080p preview is an exact scale model of the 4K render — no font size
 * or border width is ever hard-coded in pixels.
 *
 * Fractions below are quoted against a 1080-tall frame for readability:
 * 0.0148 is "16px at 1080p", and 32px at 2160p.
 */
export const useU = () => {
  const { height } = useVideoConfig();
  return (fraction: number) => fraction * height;
};

/** The main window field is a 24 x 24 grid; windows claim cells on it. */
export const GRID_COLS = 24;
export const GRID_ROWS = 24;

export const area = (
  colStart: number,
  colEnd: number,
  rowStart: number,
  rowEnd: number,
) => ({
  gridColumn: `${colStart} / ${colEnd}`,
  gridRow: `${rowStart} / ${rowEnd}`,
});
