import React, {useMemo} from "react";
import {useCurrentFrame} from "remotion";
import {CONFIG, HEIGHT, WIDTH} from "../config";
import {catmullRomPath} from "../lib/catmull-rom";
import {withAlpha} from "../lib/color";
import {useCanvas2D} from "../lib/use-canvas";
import {buildContours} from "../scene/geometry";
import type {Theme} from "../theme";

/**
 * Smooth grey curves wandering behind everything, like isobars. Very low
 * contrast and deliberately grey rather than blue so they never compete with
 * the digit field.
 *
 * They drift on a period unrelated to the push-in, which is what makes the
 * background separate from the map instead of moving with it.
 */
export const ContourLayer: React.FC<{theme: Theme; seed?: string}> = ({
  theme,
  seed = "contour",
}) => {
  const frame = useCurrentFrame();
  const contours = useMemo(() => buildContours(seed), [seed]);
  const {lineWidth, opacity, driftAmplitude, driftPeriod} = CONFIG.contours;

  const ref = useCanvas2D(WIDTH, HEIGHT, (ctx) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const c of contours) {
      const t = (frame / driftPeriod) * Math.PI * 2 + c.driftPhase;
      const drifted = c.points.map((p, k) => ({
        x: p.x + Math.sin(t + k * 0.55) * driftAmplitude * c.driftScale,
        y: p.y + Math.cos(t * 0.83 + k * 0.41) * driftAmplitude * c.driftScale * 0.7,
      }));
      ctx.strokeStyle = withAlpha(theme.contourGrey, opacity * c.opacity);
      ctx.beginPath();
      catmullRomPath(ctx, drifted, c.closed);
      ctx.stroke();
    }
  });

  return <canvas ref={ref} style={{position: "absolute", inset: 0, width: "100%", height: "100%"}} />;
};
