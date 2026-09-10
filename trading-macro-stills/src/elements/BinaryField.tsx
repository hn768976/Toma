import { rgba, shade } from "../lib/color";
import type { BinarySpec } from "../types";
import { MONO, asElement, type ElementProps } from "./common";

const draw = ({
  ctx,
  width,
  height,
  palette,
  rng,
  spec,
}: ElementProps<BinarySpec>): void => {
  ctx.font = `${spec.fontSize}px ${MONO}`;
  ctx.textBaseline = "top";
  const advance = ctx.measureText("0").width * (1 + spec.tracking);
  const rows = Math.ceil(height / spec.lineHeight) + 1;
  const maxCols = Math.ceil(width / advance) + 1;

  ctx.globalAlpha = spec.gain;
  for (let r = 0; r < rows; r++) {
    // Row lengths vary — a field of equal-length rows reads as a texture
    // swatch rather than as data.
    const cols = Math.round(maxCols * rng.range(0.45, 1.02));
    const startX = rng.chance(0.35) ? rng.range(0, width * 0.35) : 0;
    // A whole row sits at its own level, and runs of blanks break the field
    // up. Without both, a defocused field blurs down to a flat checkerboard.
    const rowGain = rng.range(0.3, 1.15);
    const y = r * spec.lineHeight;
    let gap = 0;
    for (let c = 0; c < cols; c++) {
      const x = startX + c * advance;
      if (x > width) break;
      if (gap > 0) {
        gap--;
        continue;
      }
      if (rng.chance(0.07)) {
        gap = rng.int(2, 5);
        continue;
      }
      const bright = rng.chance(spec.brightRate);
      ctx.fillStyle = bright
        ? rgba(palette, "textBright", rng.range(0.7, 1) * rowGain)
        : shade(
            palette,
            "textDim",
            rng.range(0.9, 1.9),
            rng.range(0.55, 1) * rowGain,
          );
      ctx.fillText(rng.chance(0.5) ? "1" : "0", x, y);
    }
  }
  ctx.globalAlpha = 1;
};

export const BinaryField = asElement<BinarySpec>("BinaryField", draw);
