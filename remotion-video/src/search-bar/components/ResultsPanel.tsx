import React from "react";
import { Easing, interpolate } from "remotion";
import { CanvasLayer, roundedRectPath } from "./CanvasLayer";
import { fontString, SANS } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import type { Palette, ResultsPanelConfig } from "../variants";

/**
 * The panel that opens under the bar once the search is submitted.
 *
 * It expands from zero height rather than fading in at full size — a panel
 * that fades in reads as a slide build, one that grows reads as a UI
 * responding. The lines then stagger in behind it, top to bottom, so the eye
 * is led down the panel instead of being handed a finished block.
 */

/** Two overlapping four-pointed stars, the small one trailing the large. */
const drawSparkle = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) => {
  const star = (x: number, y: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    // A control point at the centre pinches each side into a concave curve.
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.quadraticCurveTo(x, y, x, y + radius);
    ctx.quadraticCurveTo(x, y, x - radius, y);
    ctx.quadraticCurveTo(x, y, x, y - radius);
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.fillStyle = color;
  star(cx - r * 0.18, cy + r * 0.16, r * 0.86);
  star(cx + r * 0.62, cy - r * 0.6, r * 0.4);
  ctx.restore();
};

export const ResultsPanel: React.FC<{
  layout: Layout;
  palette: Palette;
  config: ResultsPanelConfig;
  frame: number;
}> = ({ layout, palette, config, frame }) => {
  const panel = palette.panel;
  const barH = layout.barH;

  const padX = barH * 0.42;
  const padY = barH * 0.34;
  const sparkleR = barH * 0.22;
  const headingSize = barH * 0.32;
  const bodySize = barH * 0.21;
  const lineHeight = barH * 0.38;
  const headingBlock = barH * 0.62;
  const fullHeight =
    padY * 2 + headingBlock + lineHeight * config.lines.length;

  const top = layout.barY + barH + layout.panelGap;
  const grow = interpolate(
    frame,
    [config.start, config.start + config.openFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );
  const height = fullHeight * grow;

  // The sparkle lands ahead of the panel and pulses once as it arrives.
  const sparkleIn = interpolate(
    frame,
    [config.sparkleFrame, config.sparkleFrame + 6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pulseAge = frame - config.sparkleFrame;
  const pulse =
    pulseAge >= 0 && pulseAge < 12 ? Math.sin((Math.PI * pulseAge) / 12) : 0;
  const sparkleScale = 1 + pulse * 0.35;

  const sparkleCx = layout.barX + padX + sparkleR;
  const sparkleCy = top + padY + headingSize * 0.42;

  return (
    <CanvasLayer
      x={layout.barX - barH}
      y={Math.round(top - barH)}
      width={Math.ceil(layout.barW + barH * 2)}
      height={Math.ceil(fullHeight + barH * 2.5)}
      draw={(ctx) => {
        if (panel === null) {
          return;
        }
        const path = () =>
          roundedRectPath(ctx, layout.barX, top, layout.barW, height, barH * 0.28);

        if (height >= 1) {
          ctx.save();
          ctx.fillStyle = palette.barFill;
          path();
          ctx.fill();
          ctx.strokeStyle = palette.barBorder;
          ctx.lineWidth = layout.borderWidth;
          ctx.stroke();
          ctx.restore();

          ctx.save();
          path();
          ctx.clip();

          ctx.textBaseline = "middle";
          ctx.textAlign = "left";

          const headingOpacity = interpolate(
            frame,
            [config.start, config.start + 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          ctx.fillStyle = withAlpha(panel.heading, headingOpacity);
          ctx.font = fontString(500, headingSize, SANS);
          ctx.fillText(
            config.heading,
            sparkleCx + sparkleR + barH * 0.3,
            sparkleCy + headingSize * 0.04,
          );

          ctx.font = fontString(400, bodySize, SANS);
          for (let i = 0; i < config.lines.length; i++) {
            const opacity = interpolate(
              frame,
              [
                config.start + config.lineStagger * (i + 1),
                config.start + config.lineStagger * (i + 1) + 10,
              ],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            if (opacity <= 0) {
              continue;
            }
            ctx.fillStyle = withAlpha(panel.body, opacity * 0.9);
            ctx.fillText(
              config.lines[i],
              layout.barX + padX,
              top + padY + headingBlock + lineHeight * (i + 0.5),
            );
          }
          ctx.restore();
        }

        if (sparkleIn > 0) {
          ctx.save();
          ctx.globalAlpha = sparkleIn;
          ctx.translate(sparkleCx, sparkleCy);
          ctx.scale(sparkleScale, sparkleScale);
          ctx.translate(-sparkleCx, -sparkleCy);
          drawSparkle(ctx, sparkleCx, sparkleCy, sparkleR, panel.sparkle);
          ctx.restore();
        }
      }}
    />
  );
};
