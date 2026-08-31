import React, { useCallback } from "react";
import { hexToRgb, rgba } from "../lib/color";
import type { Variant } from "../variants";
import { CanvasLayer } from "./CanvasLayer";

/**
 * The floor of the image: a flat near-black fill with one broad, very soft
 * gradient of the wash colour over it. Static — everything that moves lives in
 * the layers above.
 */
export const BackgroundWash: React.FC<{ readonly variant: Variant }> = ({
  variant,
}) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.fillStyle = variant.backgroundDeep;
      ctx.fillRect(0, 0, width, height);

      const wash = hexToRgb(variant.backgroundWash);
      const cx = variant.wash.x * width;
      const cy = variant.wash.y * height;
      const radius = variant.wash.radius * Math.hypot(width, height) * 0.5;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, rgba(wash, variant.wash.alpha));
      gradient.addColorStop(0.45, rgba(wash, variant.wash.alpha * 0.42));
      gradient.addColorStop(1, rgba(wash, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    [variant],
  );

  return <CanvasLayer draw={draw} />;
};
