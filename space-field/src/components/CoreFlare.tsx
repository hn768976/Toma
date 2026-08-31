import React, { useCallback, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { hexToRgb, rgba } from "../lib/color";
import { TAU } from "../lib/math";
import type { Variant } from "../variants";
import { CanvasLayer } from "./CanvasLayer";

/**
 * The core the warp family streaks away from: a small, intensely bright centre
 * inside a coloured ring inside a very wide halo, all layered radial gradients.
 *
 * The ring colour is the signature of each warp version — amber around a white
 * centre in an otherwise cold blue field (warpBlue), the same relationship
 * inverted to teal in a warm field (warpAmber), and removed entirely in favour
 * of a violet halo (warpViolet).
 *
 * Renders nothing for the starfield family, which has no core.
 */
export const CoreFlare: React.FC<{ readonly variant: Variant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();

  const palette = useMemo(() => {
    const core = variant.core;
    if (!core) {
      return null;
    }
    return {
      hot: hexToRgb(core.hot),
      ring: hexToRgb(core.ring),
      halo: hexToRgb(core.halo),
    };
  }, [variant]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const core = variant.core;
      if (!core || !palette) {
        return;
      }

      // Pulse on a sine whose period divides the loop length.
      const pulse =
        1 +
        core.pulseAmp *
          Math.sin(TAU * ((frame % core.pulsePeriod) / core.pulsePeriod));

      const cx = core.x * width;
      const cy = core.y * height;
      const base = core.radius * height * pulse;

      const blob = (
        color: readonly [number, number, number],
        radius: number,
        alpha: number,
        falloff: number,
      ) => {
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, rgba(color, alpha));
        gradient.addColorStop(falloff, rgba(color, alpha * 0.35));
        gradient.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      };

      ctx.globalCompositeOperation = "lighter";

      // Outermost halo, well beyond the core itself.
      blob(palette.halo, base * 18, 0.26 * core.haloStrength, 0.26);
      blob(palette.halo, base * 8.5, 0.3 * core.haloStrength, 0.3);
      // The ring: the warm (or cool) band around the hot centre. It has to
      // out-reach the white centre or the centre simply swallows it.
      blob(palette.ring, base * 6, 0.34 * core.ringStrength, 0.26);
      blob(palette.ring, base * 3.2, 0.5 * core.ringStrength, 0.3);
      blob(palette.ring, base * 1.7, 0.72 * core.ringStrength, 0.34);
      // The hot centre.
      blob(palette.hot, base * 0.85, 0.8, 0.42);
      blob(palette.hot, base * 0.36, 1, 0.55);

      ctx.globalCompositeOperation = "source-over";
    },
    [variant, palette, frame],
  );

  if (!variant.core) {
    return null;
  }

  return <CanvasLayer draw={draw} blend="screen" />;
};
