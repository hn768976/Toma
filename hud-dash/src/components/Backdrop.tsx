import React, { useMemo } from "react";
import { HEIGHT, WIDTH } from "../constants";
import { LAYOUT } from "../layout";
import { alpha } from "../lib/color";
import type { Variant } from "../variants";
import { Layer } from "./Layer";

/**
 * Deep background field plus the soft radial wash behind the centre form.
 * Fully static — rasterised once and blitted.
 */
export const Backdrop: React.FC<{ variant: Variant }> = ({ variant }) => {
  const p = variant.palette;
  const baked = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = WIDTH;
    c.height = HEIGHT;
    const ctx = c.getContext("2d");
    if (!ctx) {
      return c;
    }
    ctx.fillStyle = p.bgDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const g = ctx.createRadialGradient(
      LAYOUT.centre.cx,
      LAYOUT.centre.cy,
      0,
      LAYOUT.centre.cx,
      LAYOUT.centre.cy,
      WIDTH * 0.42,
    );
    g.addColorStop(0, alpha(p.bgWash, 0.9));
    g.addColorStop(0.45, alpha(p.bgWash, 0.32));
    g.addColorStop(1, alpha(p.bgWash, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return c;
  }, [p]);

  return (
    <Layer
      x={0}
      y={0}
      w={WIDTH}
      h={HEIGHT}
      draw={(ctx) => {
        ctx.drawImage(baked, 0, 0);
      }}
    />
  );
};
