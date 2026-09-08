import React from "react";
import {cssA, css, mix} from "../lib/color";
import {usePass, type PassProps} from "./pass";

/**
 * A deep base colour with a broad radial wash centred on the light, plus very
 * subtle large-scale mottling. Computed at 1/8 resolution, heavily blurred, and
 * upscaled — the mottling is meant to be felt rather than seen.
 */
export const BackgroundPass: React.FC<PassProps> = (props) => {
  usePass(props, (ctx, stage) => {
    const {width, height, pal, rng, light} = stage;
    const s = 1 / 8;
    const lw = Math.max(2, Math.round(width * s));
    const lh = Math.max(2, Math.round(height * s));

    const cv = document.createElement("canvas");
    cv.width = lw;
    cv.height = lh;
    const c = cv.getContext("2d");
    if (!c) {
      return;
    }

    c.fillStyle = css(pal.bgDeep);
    c.fillRect(0, 0, lw, lh);

    const lx = light.x * s;
    const ly = light.y * s;
    const wash = c.createRadialGradient(lx, ly, 0, lx, ly, light.r * s * 3.1);
    wash.addColorStop(0, cssA(mix(pal.bgWash, pal.lightCore, 0.16), 0.55));
    wash.addColorStop(0.28, cssA(pal.bgWash, 0.24));
    wash.addColorStop(0.68, cssA(pal.bgWash, 0.07));
    wash.addColorStop(1, cssA(pal.bgWash, 0));
    c.fillStyle = wash;
    c.fillRect(0, 0, lw, lh);

    // Large-scale mottling.
    c.globalCompositeOperation = "lighter";
    const blobs = 16;
    for (let i = 0; i < blobs; i++) {
      const bx = rng("bg", i, "x") * lw;
      const by = rng("bg", i, "y") * lh;
      const br = (0.12 + rng("bg", i, "r") * 0.34) * lw;
      const a = 0.015 + rng("bg", i, "a") * 0.035;
      const tint = mix(pal.bgDeep, pal.bgWash, 0.35 + rng("bg", i, "t") * 0.65);
      const g = c.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, cssA(tint, a));
      g.addColorStop(1, cssA(tint, 0));
      c.fillStyle = g;
      c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    c.globalCompositeOperation = "source-over";

    // Heavy blur, then upscale.
    const blurred = document.createElement("canvas");
    blurred.width = lw;
    blurred.height = lh;
    const b = blurred.getContext("2d");
    if (!b) {
      return;
    }
    b.filter = `blur(${Math.max(1, lw * 0.022)}px)`;
    b.drawImage(cv, 0, 0);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = css(pal.bgDeep);
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blurred, 0, 0, width, height);
  });
  return null;
};
