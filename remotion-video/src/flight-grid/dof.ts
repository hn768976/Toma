// Thin-lens circle of confusion, in px. Shared by the line shader (where
// it sets the ribbon width) and by the defocused aircraft layers (where it
// sets the CSS blur radius), so both stay on the same lens.
export const circleOfConfusion = (
  viewDistance: number,
  focus: number,
  bokehK: number,
  maxCocPx: number,
): number =>
  Math.min(
    bokehK * Math.abs(1 / focus - 1 / Math.max(viewDistance, 0.001)),
    maxCocPx,
  );
