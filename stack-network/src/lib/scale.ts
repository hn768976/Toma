import { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { BOARD_WIDTH, HEIGHT, WIDTH } from "./constants";

/**
 * Fits the fixed board coordinate system to whatever size the composition
 * is actually registered at.
 *
 * The board <div> is always BOARD_WIDTH x BOARD_HEIGHT CSS pixels and a
 * single scale() in its transform chain does the fitting, so children can
 * use raw board units for position, size, stroke width and blur radius
 * and all of it scales together.
 */
export const useBoardScale = () => {
  const { width, height } = useVideoConfig();

  return useMemo(() => {
    // Cover the frame on both axes, so a composition registered at an
    // unusual aspect ratio still has no bare plane showing at the edges.
    const cover = Math.max(width / WIDTH, height / HEIGHT);
    return { fit: (WIDTH / BOARD_WIDTH) * cover };
  }, [width, height]);
};
