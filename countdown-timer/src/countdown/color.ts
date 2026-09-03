import { makeCyclicGradient } from "./cyclicGradient";
import { PALETTE } from "./theme";

/**
 * The bar sweep: cyan -> blue -> violet -> magenta, closing back to cyan
 * so the ring shows no hard seam where the gradient's end meets its
 * start. Built with the shared cyclic-gradient helper; the palette is
 * the only thing this file contributes.
 */
export const sweepColorAt = makeCyclicGradient([
  PALETTE.barCyan,
  PALETTE.barBlue,
  PALETTE.barViolet,
  PALETTE.barMagenta,
]);
