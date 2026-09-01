import React from "react";
import { Easing, interpolate } from "remotion";
import { CanvasLayer, roundedRectPath } from "./CanvasLayer";
import { drawMagnifier } from "./MagnifierIcon";
import { fontString, SANS } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import { BAR_SHADOW_ALPHA } from "../variants";
import type { AutocompleteConfig, Palette, Timing } from "../variants";

/**
 * The v3 extra: a suggestion panel attached under the bar.
 *
 * The part of each suggestion that matches what has been typed is set in the
 * normal weight and the rest in bold — that weight split is how a real search
 * field shows you the completion rather than the query, and it is the detail
 * that makes the whole thing read as a search field instead of a caption.
 */
export const Autocomplete: React.FC<{
  layout: Layout;
  palette: Palette;
  config: AutocompleteConfig;
  timing: Timing;
  frame: number;
  /** Frame at which roughly half the term has been typed. */
  openFrame: number;
  /** How many characters are currently typed — the matched prefix length. */
  typedLength: number;
}> = ({ layout, palette, config, timing, frame, openFrame, typedLength }) => {
  const rows = config.suggestions.length;
  const fullHeight = layout.panelPadY * 2 + layout.rowH * rows;

  const grow = interpolate(frame, [openFrame, openFrame + config.openFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  // This variant always deletes, so the panel always has a frame to close on.
  const closeFrame = timing.deletion === null ? Infinity : timing.deletion.start;
  const shrink = interpolate(
    frame,
    [closeFrame, closeFrame + config.closeFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      // Fast off the mark, so the panel is clearly going away the moment the
      // first character is deleted.
      easing: Easing.out(Easing.cubic),
    },
  );
  const height = fullHeight * grow * shrink;

  const top = layout.barY + layout.barH + layout.panelGap;
  const radius = layout.barH * 0.3;
  const highlighted =
    Math.floor((frame - openFrame) / config.highlightFrames) % rows;

  const textColor = palette.suggestText ?? palette.text;
  const hoverColor = palette.suggestHover ?? palette.barFill;

  return (
    <CanvasLayer
      x={layout.layerX}
      y={Math.round(top - layout.barH * 0.2)}
      width={layout.layerW}
      height={Math.ceil(fullHeight + layout.barH * 1.4)}
      draw={(ctx) => {
        if (height < 1) {
          return;
        }
        const path = () =>
          roundedRectPath(ctx, layout.barX, top, layout.barW, height, radius);

        ctx.save();
        ctx.shadowColor = withAlpha(palette.barGlow, BAR_SHADOW_ALPHA);
        ctx.shadowOffsetX = layout.barH * 0.09;
        ctx.shadowOffsetY = layout.barH * 0.17;
        ctx.shadowBlur = layout.barH * 0.55;
        ctx.fillStyle = palette.barFill;
        path();
        ctx.fill();
        ctx.restore();

        ctx.save();
        path();
        ctx.clip();

        const fontSize = layout.barH * 0.3;
        const iconR = layout.barH * 0.13;
        const iconCx = layout.barX + layout.barH * 0.58;
        const textX = layout.barX + layout.barH * 1.05;

        for (let i = 0; i < rows; i++) {
          const rowTop = top + layout.panelPadY + layout.rowH * i;
          const rowMid = rowTop + layout.rowH / 2;
          const opacity = interpolate(
            frame,
            [
              openFrame + config.rowStagger * i,
              openFrame + config.rowStagger * i + config.openFrames * 0.7,
            ],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          if (opacity <= 0) {
            continue;
          }

          if (i === highlighted) {
            ctx.fillStyle = withAlpha(hoverColor, opacity);
            roundedRectPath(
              ctx,
              layout.barX + layout.barH * 0.12,
              rowTop,
              layout.barW - layout.barH * 0.24,
              layout.rowH,
              layout.barH * 0.14,
            );
            ctx.fill();
          }

          drawMagnifier(
            ctx,
            iconCx,
            rowMid,
            iconR,
            Math.max(2, layout.barH * 0.032),
            withAlpha(palette.label, opacity),
          );

          const suggestion = config.suggestions[i];
          const split = Math.min(typedLength, suggestion.length);
          const matched = suggestion.slice(0, split);
          const completion = suggestion.slice(split);

          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillStyle = withAlpha(textColor, opacity);
          ctx.font = fontString(400, fontSize, SANS);
          ctx.fillText(matched, textX, rowMid);
          const matchedWidth = ctx.measureText(matched).width;
          ctx.font = fontString(700, fontSize, SANS);
          ctx.fillText(completion, textX + matchedWidth, rowMid);
        }
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = palette.barBorder;
        ctx.lineWidth = layout.borderWidth * 0.8;
        path();
        ctx.stroke();
        ctx.restore();
      }}
    />
  );
};
