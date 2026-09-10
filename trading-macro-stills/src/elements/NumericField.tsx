import { rgba, shade } from "../lib/color";
import type { NumericSpec } from "../types";
import { MONO, asElement, type ElementProps } from "./common";

/**
 * Invented codes. These are deliberately built from letter shapes that do not
 * belong to any listed instrument — nothing in this image refers to a real
 * security, and no value shown is a real quote.
 */
const CODES = [
  "QVRT", "ZNLX", "XQAB", "JVEK", "QWLN", "ZRTP", "XKVU", "JQOM",
  "VXRN", "KQZL", "ZJAV", "QNTX", "XWQE", "JZRB", "VQOL", "KXNV",
  "QZE", "XVU", "JQN", "ZKW", "VQX", "XJL", "QWZ", "ZVN",
] as const;

const draw = ({
  ctx,
  width,
  height,
  palette,
  rng,
  spec,
}: ElementProps<NumericSpec>): void => {
  ctx.font = `${spec.fontSize}px ${MONO}`;
  ctx.textBaseline = "top";
  const colW = width / spec.columns;
  const rows = Math.ceil(height / spec.lineHeight) + 1;

  ctx.globalAlpha = spec.gain;
  for (let r = 0; r < rows; r++) {
    const y = r * spec.lineHeight;
    for (let c = 0; c < spec.columns; c++) {
      const x = c * colW + colW * rng.range(0.02, 0.16);
      const decimals = rng.chance(0.35) ? 4 : 2;
      const digits = rng.int(2, 4);
      const value = rng.range(1, 10 ** digits).toFixed(decimals);
      const accent = rng.chance(spec.accentRate);
      let cursor = x;

      if (rng.chance(spec.labelRate)) {
        ctx.fillStyle = shade(palette, "textDim", 1.9, 0.95);
        const label = rng.pick(CODES);
        ctx.fillText(label, cursor, y);
        cursor += ctx.measureText(label + " ").width;
      }
      ctx.fillStyle = accent
        ? rgba(palette, spec.accent, rng.range(0.8, 1))
        : rng.chance(0.18)
          ? rgba(palette, "textBright", rng.range(0.7, 1))
          : shade(palette, "textDim", rng.range(1.1, 2.1), rng.range(0.7, 1));
      ctx.fillText(value, cursor, y);
    }
  }
  ctx.globalAlpha = 1;
};

export const NumericField = asElement<NumericSpec>("NumericField", draw);
