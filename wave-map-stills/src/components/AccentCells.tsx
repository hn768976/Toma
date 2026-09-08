import React from "react";
import {KIND_ACCENT} from "../lib/dots";
import {lightFalloff} from "../lib/stage";
import {usePass, type PassProps} from "./pass";

/**
 * Roughly 2% of dots render in the palette's accent colour instead of its main
 * hue — scattered, weighted towards the light. Some are single dots, some are
 * short horizontal runs of 3-6 cells, which read as data fragments.
 */
export const AccentCells: React.FC<PassProps> = (props) => {
  usePass(props, (_ctx, stage) => {
    const {dots, rng} = stage;
    dots.kind.set(dots.baseKind);

    for (let r = 0; r < dots.rows; r++) {
      for (let c = 0; c < dots.cols; c++) {
        const i = r * dots.cols + c;
        const f = lightFalloff(stage, dots.sx[i], dots.sy[i]);
        const weight = 0.3 + f * 2.1;
        if (rng("acc", i) >= 0.0085 * weight) {
          continue;
        }
        const runs = rng("acc", i, "run");
        const len = runs < 0.55 ? 1 : 3 + Math.floor(rng("acc", i, "len") * 4);
        for (let d = 0; d < len && c + d < dots.cols; d++) {
          dots.kind[i + d] = KIND_ACCENT;
        }
        c += len;
      }
    }
  });
  return null;
};
