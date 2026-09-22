import { useVideoConfig } from "remotion";

/**
 * Everything in this project is authored in "design px" against a 3840x2160
 * canvas and multiplied by `k = width / 3840`. That is the same thing as
 * expressing sizes as fractions of the frame, but far more readable for a
 * dashboard — and it means a composition rendered at 1920 wide is a pure scale
 * of the 4K one, with the same layout and the same *proportional* text size
 * and stroke weight. A 2 design-px panel border is 2px at 4K and 1px at 1080p,
 * which is exactly what it should be.
 */
export const DESIGN_W = 3840;
export const DESIGN_H = 2160;

export const useScale = () => {
  const { width } = useVideoConfig();
  return width / DESIGN_W;
};

/** design px -> composition px */
export const useU = () => {
  const k = useScale();
  return (n: number) => n * k;
};
