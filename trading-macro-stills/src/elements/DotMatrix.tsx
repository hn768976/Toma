import { rgba, shade } from "../lib/color";
import type { DotsSpec } from "../types";
import { asElement, type ElementProps } from "./common";

const draw = ({
  ctx,
  width,
  height,
  palette,
  rng,
  spec,
}: ElementProps<DotsSpec>): void => {
  const cols = Math.ceil(width / spec.cell);
  const rows = Math.ceil(height / spec.cell);

  // Hotspots make some regions denser and brighter, so the panel reads as a
  // display showing something rather than as uniform noise.
  const hotspots = Array.from({ length: spec.clusters }, () => ({
    x: rng.range(0, width),
    y: rng.range(0, height),
    r: rng.range(width * 0.08, width * 0.3),
  }));

  ctx.globalAlpha = spec.gain;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * spec.cell;
      const y = r * spec.cell;
      let heat = 0;
      for (const h of hotspots) {
        const d = Math.hypot(x - h.x, y - h.y) / h.r;
        if (d < 1) heat += (1 - d) ** 2;
      }
      heat = Math.min(1, heat);
      if (rng.next() > 0.18 + heat * 0.75) continue;
      const bright = heat > 0.45 && rng.chance(0.35);
      ctx.fillStyle = bright
        ? rgba(palette, "textBright", rng.range(0.6, 1))
        : shade(palette, "textDim", 1.3 + heat * 2, rng.range(0.45, 1));
      ctx.fillRect(x, y, spec.dot, spec.dot);
    }
  }
  ctx.globalAlpha = 1;
};

export const DotMatrix = asElement<DotsSpec>("DotMatrix", draw);
