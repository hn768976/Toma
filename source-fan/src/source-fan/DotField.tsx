import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { hexToRgb, rgba } from "./color";
import { buildDots, type Dot } from "./geometry";
import { useCanvasLayer } from "./hooks";
import { HEIGHT, WIDTH, ambientDrift, type Flow } from "./layout";
import { TAU, clamp } from "./math";
import type { VariantConfig } from "./variants";

/** Above this brightness a dot gets a little bloom of its own. */
const BLOOM_ABOVE = 0.72;

/**
 * Most dots breathe gently; a seeded few flash hard, a couple of times a
 * second across the whole field. Every period divides 600.
 */
const flickerAt = (dot: Dot, frame: number): number => {
  const s = 0.5 + 0.5 * Math.sin(TAU * ((frame % 600) / dot.period + dot.phase));
  if (dot.flash) {
    return dot.base * (0.14 + 2.9 * s ** 14);
  }
  return dot.base * (0.42 + 0.58 * s);
};

export const DotField: React.FC<{
  readonly config: VariantConfig;
  readonly flow: Flow;
}> = ({ config, flow }) => {
  const frame = useCurrentFrame();
  const dots = useMemo(() => buildDots(config, flow), [config, flow]);
  const hues = useMemo(
    () => config.palette.dotHues.map(hexToRgb),
    [config],
  );

  const ref = useCanvasLayer(WIDTH, HEIGHT, (ctx) => {
    const drift = ambientDrift(frame);
    ctx.translate(drift.dx, drift.dy);
    ctx.globalCompositeOperation = "lighter";

    // Dim dots first without shadow state, then the bright ones with bloom,
    // so the expensive shadow setting is toggled once rather than per dot.
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) {
        ctx.shadowBlur = 10;
      }
      for (const dot of dots) {
        const level = flickerAt(dot, frame);
        const bright = level > BLOOM_ABOVE;
        if (bright !== (pass === 1)) {
          continue;
        }
        const alpha = clamp(level, 0, 1);
        if (alpha < 0.02) {
          continue;
        }
        const colour = hues[dot.hue];
        const fill = rgba(colour, alpha);
        if (pass === 1) {
          ctx.shadowColor = fill;
        }
        ctx.fillStyle = fill;
        const size = dot.size * (bright ? 1.15 : 1);
        ctx.fillRect(dot.x - size / 2, dot.y - size / 2, size, size);
      }
    }
    ctx.shadowBlur = 0;
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        mixBlendMode: "screen",
      }}
    />
  );
};
