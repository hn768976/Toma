import React from "react";
import {usePass, type PassProps} from "./pass";

const TILE = 384;

/**
 * A fine seeded grain over the whole frame, laid down as a repeating tile so
 * the noise never has to be generated at full 4K resolution.
 */
export const GrainPass: React.FC<PassProps> = (props) => {
  usePass(props, (ctx, stage) => {
    const {width, height, rng} = stage;
    const cv = document.createElement("canvas");
    cv.width = TILE;
    cv.height = TILE;
    const c = cv.getContext("2d");
    if (!c) {
      return;
    }
    const img = c.createImageData(TILE, TILE);
    const d = img.data;
    for (let i = 0, p = 0; i < TILE * TILE; i++, p += 4) {
      const v = rng("grain", i);
      const a = Math.round(Math.pow(v, 2.4) * 38);
      d[p] = 255;
      d[p + 1] = 255;
      d[p + 2] = 255;
      d[p + 3] = a;
    }
    c.putImageData(img, 0, 0);

    const pattern = ctx.createPattern(cv, "repeat");
    if (!pattern) {
      return;
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  });
  return null;
};
