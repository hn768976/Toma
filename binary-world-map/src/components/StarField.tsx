import React, {useMemo} from "react";
import {useCurrentFrame} from "remotion";
import {HEIGHT, WIDTH} from "../config";
import {withAlpha} from "../lib/color";
import {useCanvas2D} from "../lib/use-canvas";
import {buildStars} from "../scene/geometry";
import type {Theme} from "../theme";

/**
 * Sparse dim points across the background so the empty regions do not read as
 * flat black. Each star breathes on its own slow period.
 */
export const StarField: React.FC<{theme: Theme; seed?: string}> = ({theme, seed = "star"}) => {
  const frame = useCurrentFrame();
  const stars = useMemo(() => buildStars(seed), [seed]);

  const ref = useCanvas2D(WIDTH, HEIGHT, (ctx) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const s of stars) {
      const twinkle = 0.72 + 0.28 * Math.sin((frame / s.period) * Math.PI * 2 + s.phase);
      ctx.fillStyle = withAlpha(theme.starPale, s.alpha * twinkle * 0.55);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return <canvas ref={ref} style={{position: "absolute", inset: 0, width: "100%", height: "100%"}} />;
};
