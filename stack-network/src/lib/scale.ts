import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { BOARD_HEIGHT, BOARD_WIDTH, HEIGHT, WIDTH } from "./constants";

/**
 * Maps the fixed board coordinate system onto whatever size the
 * composition is actually registered at.
 *
 * The board <div> is always BOARD_WIDTH x BOARD_HEIGHT CSS pixels, and a
 * single scale() in its transform chain does the fitting. Children can
 * therefore use raw board units for position, size, stroke width and
 * blur radius, and all of it scales together.
 */
export const useBoardScale = () => {
  const { width, height } = useVideoConfig();

  return useMemo(() => {
    // Cover the frame in both axes, so a composition registered at an
    // unusual aspect ratio still has no bare plane showing at the edges.
    const fit = Math.max(width / WIDTH, height / HEIGHT);
    return {
      width,
      height,
      /** Board units -> CSS px at the board's own scale of 1. */
      boardWidth: BOARD_WIDTH,
      boardHeight: BOARD_HEIGHT,
      /** Multiplier the board transform applies. */
      fit: (WIDTH / BOARD_WIDTH) * fit,
      /** Fraction of the frame width -> CSS px, for full-frame overlays. */
      fw: (fraction: number) => fraction * width,
    };
  }, [width, height]);
};

export type BoardScale = ReturnType<typeof useBoardScale>;
