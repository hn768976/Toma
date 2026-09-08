import React from "react";
import {lightFalloff} from "../lib/stage";
import {usePass, type PassProps} from "./pass";

/**
 * The defining treatment. Every dot in the frame — land and ocean alike — is
 * displaced VERTICALLY by the height field evaluated at its own position, so
 * the rows of dots undulate, cross and bunch. The regular ocean rows are what
 * make the undulation readable; the continents alone never would.
 *
 * This pass writes no pixels. It computes the displaced screen position of
 * every dot, plus the crest-lit size and brightness that sell the surface as
 * three-dimensional, for the drawing passes that follow.
 */
export const WaveField: React.FC<PassProps> = (props) => {
  usePass(props, (_ctx, stage) => {
    const {dots, wave, comp, width, height, k} = stage;
    const tilt = (comp.tilt * Math.PI) / 180;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const cx = width / 2;
    const cy = height / 2;
    const baseSize = comp.dotSize * k;
    const invAmp = 1 / wave.maxAmp;

    for (let i = 0; i < dots.n; i++) {
      const fx = dots.bx[i];
      const fy = dots.by[i];
      const h = wave.at(fx, fy);
      let hn = h * invAmp;
      hn = hn < -1 ? -1 : hn > 1 ? 1 : hn;
      dots.hn[i] = hn;

      // Vertical displacement in field space, then the composition's tilt.
      const dy = fy + h;
      let x = fx;
      let y = dy;
      if (tilt !== 0) {
        const rx = fx - cx;
        const ry = dy - cy;
        x = cx + rx * ct - ry * st;
        y = cy + rx * st + ry * ct;
      }
      dots.sx[i] = x;
      dots.sy[i] = y;

      // Crests catch the light: slightly larger, slightly brighter.
      const crest = hn * 0.5 + 0.5;
      dots.size[i] = baseSize * (0.86 + crest * 0.28);

      const f = lightFalloff(stage, x, y);
      const lit =
        dots.bright[i] *
        (0.84 + crest * 0.32) *
        (1 + stage.light.gain * f);
      dots.lit[i] = lit;

      dots.bracket[i] = stage.bracketAt(stage.blurAt(x, y), stage.rng("br", i));
    }
  });
  return null;
};
