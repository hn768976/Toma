import React, { useMemo } from "react";
import { Canvas2D } from "./lib/Canvas2D";
import { mixHex, rgba } from "./lib/color";
import { neonPasses, neonStroke } from "./lib/neonStroke";
import { bloomPasses, glowPool, makeBloomScratch } from "./lib/postFx";
import { leaningRect, roundedPolygon } from "./lib/shapes";
import { applyTilt, DEFAULT_TILT, type Tilt } from "./lib/tilt";

export type NeonBarPalette = {
  outline: string;
  core: string;
  fill: string;
  fillBright: string;
};

export type NeonBarProps = {
  width: number;
  height: number;
  x: number;
  y: number;
  barWidth: number;
  barHeight: number;
  /** How far the top edge leans past the bottom edge, in px. */
  skew: number;
  cornerRadius: number;
  /** 0..1, supplied by the caller's fill curve. */
  progress: number;
  /**
   * 1 while filling, easing to ~0 once complete — the leading edge is
   * the brightest thing on screen right up until there is nowhere left
   * to advance to.
   */
  leadFlash: number;
  palette: NeonBarPalette;
  /** Stroke weights and blur radii are authored against a 1920 frame. */
  scale: number;
  tilt?: Tilt;
  blend?: React.CSSProperties["mixBlendMode"];
};

/**
 * A skewed, outlined progress bar with a glowing fill.
 *
 * The track is outline-only — a four-pass neon stroke over a
 * parallelogram whose left edge is vertical and whose right edge leans,
 * with the backdrop showing through. The fill is a solid block growing
 * from the left with the same lean, brighter than the outline, blooming
 * outside the bar's own boundary and dragging a pool of light across
 * the surface behind it. Its leading edge is a hot vertical band so the
 * growth point always holds the eye.
 *
 * Everything on this layer is composited with 'lighter'; the layer as a
 * whole is blended onto the backdrop so the spill lands on the wall
 * rather than being clipped to the bar.
 */
export const NeonBar: React.FC<NeonBarProps> = ({
  width,
  height,
  x,
  y,
  barWidth,
  barHeight,
  skew,
  cornerRadius,
  progress,
  leadFlash,
  palette,
  scale,
  tilt = DEFAULT_TILT,
  blend = "screen",
}) => {
  const bloom = useMemo(() => makeBloomScratch(width, height), [width, height]);

  return (
    <Canvas2D
      width={width}
      height={height}
      blend={blend}
      draw={(ctx) => {
        const trackPath = (c: CanvasRenderingContext2D) => {
          roundedPolygon(
            c,
            leaningRect(x, y, barWidth, barHeight, skew),
            cornerRadius,
          );
        };

        ctx.save();
        applyTilt(ctx, width, height, tilt);
        ctx.globalCompositeOperation = "lighter";

        const filled = Math.max(0, Math.min(1, progress)) * barWidth;
        const leadX = x + filled;
        const leadTopX = leadX + skew;
        const midY = y + barHeight / 2;

        if (filled > 0.5) {
          // 1. Pool of light thrown onto the surface behind the fill.
          //    It grows with the bar, so the wall lights up as it fills.
          glowPool(
            ctx,
            x + filled * 0.55,
            midY,
            Math.max(filled * 0.75, barHeight * 1.4),
            barHeight * 2.3,
            palette.fill,
            0.26,
          );

          // 2. Bloom spilling past the outline. Drawn unclipped and
          //    heavily blurred, so light leaks onto the backdrop
          //    instead of stopping dead at the bar's edge.
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.shadowBlur = 22 * scale;
          ctx.shadowColor = palette.fill;
          ctx.fillStyle = rgba(palette.fill, 0.5);
          roundedPolygon(
            ctx,
            leaningRect(x, y, filled, barHeight, skew),
            cornerRadius,
          );
          ctx.fill();
          ctx.fill();
          ctx.restore();

          // 3. The fill body, clipped to the track so its edges follow
          //    the rounded, leaning outline exactly.
          ctx.save();
          trackPath(ctx);
          ctx.clip();

          // Source-over, not 'lighter': the body is a solid block, and
          // accumulating it additively over the spill pass beneath
          // would sum every channel to white and throw the hue away.
          ctx.globalCompositeOperation = "source-over";
          const body = ctx.createLinearGradient(0, y, 0, y + barHeight);
          body.addColorStop(0, mixHex(palette.fill, palette.fillBright, 0.34));
          body.addColorStop(0.38, mixHex(palette.fill, palette.fillBright, 0.8));
          body.addColorStop(1, mixHex(palette.fill, palette.fillBright, 0.22));
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(x - cornerRadius, y);
          ctx.lineTo(leadTopX, y);
          ctx.lineTo(leadX, y + barHeight);
          ctx.lineTo(x - cornerRadius, y + barHeight);
          ctx.closePath();
          ctx.fill();

          // 4. Leading edge: a hot band at the growth point, brighter
          //    than the body behind it.
          ctx.globalCompositeOperation = "lighter";
          const bandWidth = Math.min(
            barHeight * 0.55,
            Math.max(barHeight * 0.16, filled),
          );
          const band = ctx.createLinearGradient(leadX - bandWidth, 0, leadX, 0);
          band.addColorStop(0, rgba(palette.fillBright, 0));
          band.addColorStop(0.5, rgba(palette.fillBright, 0.5 * leadFlash));
          band.addColorStop(1, rgba(palette.core, 0.95 * leadFlash));
          ctx.fillStyle = band;
          ctx.beginPath();
          ctx.moveTo(leadTopX - bandWidth, y);
          ctx.lineTo(leadTopX, y);
          ctx.lineTo(leadX, y + barHeight);
          ctx.lineTo(leadX - bandWidth, y + barHeight);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // 5. The leading edge again, unclipped: a narrow blurred
          //    stroke plus a tight halo, so the growth point reads as
          //    the source of all the light on this layer.
          ctx.save();
          ctx.globalAlpha = leadFlash;
          ctx.lineCap = "round";
          ctx.shadowColor = palette.fillBright;
          ctx.shadowBlur = 20 * scale;
          ctx.strokeStyle = rgba(palette.fillBright, 0.55);
          ctx.lineWidth = 7 * scale;
          ctx.beginPath();
          ctx.moveTo(leadTopX, y + barHeight * 0.06);
          ctx.lineTo(leadX, y + barHeight * 0.94);
          ctx.stroke();
          ctx.shadowBlur = 8 * scale;
          ctx.strokeStyle = rgba(palette.core, 0.85);
          ctx.lineWidth = 3 * scale;
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.globalAlpha = leadFlash;
          glowPool(
            ctx,
            leadX + skew / 2,
            midY,
            barHeight * 1.15,
            barHeight * 1.5,
            palette.fillBright,
            0.5,
          );
          ctx.restore();
        }

        // 6. The track outline, last, so its hot core sits above the fill.
        neonStroke(
          ctx,
          trackPath,
          neonPasses(palette.outline, palette.core, scale),
        );

        ctx.restore();

        // Generous, two-radius bloom over the finished layer: a tight
        // glow hugging the bar and a wide atmospheric halo that spills
        // well outside it onto the backdrop.
        bloomPasses(
          ctx,
          bloom,
          [
            { blur: 3, amount: 0.85 },
            { blur: 14, amount: 1 },
          ],
          true,
        );
      }}
    />
  );
};
