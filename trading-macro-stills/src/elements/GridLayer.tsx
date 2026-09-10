import { shade } from "../lib/color";
import type { GridSpec } from "../types";
import { asElement, type ElementProps } from "./common";

const draw = ({
  ctx,
  width,
  height,
  palette,
  spec,
}: ElementProps<GridSpec>): void => {
  ctx.globalAlpha = spec.gain;
  const cols = Math.ceil(width / spec.pitch);
  const rows = Math.ceil(height / spec.pitch);

  // Every fourth line brighter. On a keystoned layer the grid is the element
  // that shows the tilt most plainly, so it is worth keeping crisp.
  for (let c = 0; c <= cols; c++) {
    const major = c % 4 === 0;
    ctx.fillStyle = shade(palette, "textDim", major ? 2.4 : 1.35, major ? 0.95 : 0.5);
    ctx.fillRect(
      c * spec.pitch,
      0,
      spec.lineWidth * (major ? 1.7 : 1),
      height,
    );
  }
  for (let r = 0; r <= rows; r++) {
    const major = r % 4 === 0;
    ctx.fillStyle = shade(palette, "textDim", major ? 2.4 : 1.35, major ? 0.95 : 0.5);
    ctx.fillRect(0, r * spec.pitch, width, spec.lineWidth * (major ? 1.7 : 1));
  }
  ctx.globalAlpha = 1;
};

export const GridLayer = asElement<GridSpec>("GridLayer", draw);
