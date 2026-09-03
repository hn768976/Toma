import React, { useMemo } from "react";
import { Canvas2D } from "./lib/Canvas2D";
import { rgba } from "./lib/color";
import { cssFont, fontSizeForCapHeight } from "./fonts";
import { bloomPasses, makeBloomScratch } from "./lib/postFx";
import { applyTilt, DEFAULT_TILT, type Tilt } from "./lib/tilt";

export type WordMarkProps = {
  width: number;
  height: number;
  word: string;
  fontFamily: string;
  fontWeight: number;
  capHeight: number;
  left: number;
  baseline: number;
  palette: { word: string; core: string };
  /** 0-3. The only motion in the word. */
  dotsVisible: number;
  scale: number;
  tilt?: Tilt;
  blend?: React.CSSProperties["mixBlendMode"];
};

/** How many frames one full cycle of the trailing dots takes. */
export const DOT_CYCLE_FRAMES = 30;

/** 0 -> 1 -> 2 -> 3 -> clear, once every `DOT_CYCLE_FRAMES`. */
export const dotsVisibleAt = (frame: number): number =>
  Math.min(3, Math.floor((frame % DOT_CYCLE_FRAMES) / (DOT_CYCLE_FRAMES / 4)));

export const WordMark: React.FC<WordMarkProps> = ({
  width,
  height,
  word,
  fontFamily,
  fontWeight,
  capHeight,
  left,
  baseline,
  palette,
  dotsVisible,
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
        const size = fontSizeForCapHeight(ctx, fontFamily, fontWeight, capHeight);
        const font = cssFont(fontWeight, size, fontFamily);

        ctx.save();
        applyTilt(ctx, width, height, tilt);
        ctx.globalCompositeOperation = "lighter";
        ctx.font = font;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";

        // Flush the word's *ink* to `left`, not its text origin. The
        // first glyph's left side bearing would otherwise indent the
        // word a few pixels relative to the bar's hard left edge, which
        // is exactly the misalignment a shared edge is meant to avoid.
        const metrics = ctx.measureText(word);
        const originX = left + metrics.actualBoundingBoxLeft;
        const wordWidth = metrics.width;
        const dotRadius = capHeight * 0.085;
        const dotGap = dotRadius * 3.4;
        const dotStart = originX + wordWidth + dotGap * 0.9;

        const paintGlyphs = (dx: number, dy: number) => {
          ctx.fillText(word, originX + dx, baseline + dy);
          for (let i = 0; i < dotsVisible; i++) {
            ctx.beginPath();
            ctx.arc(
              dotStart + i * dotGap + dx,
              baseline - dotRadius + dy,
              dotRadius,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        };

        // Chromatic fringe: one channel pushed each way. Subtle enough
        // to read as lens dispersion rather than as an effect.
        const fringe = 4 * scale;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "rgb(255, 40, 90)";
        paintGlyphs(-fringe, 0);
        ctx.fillStyle = "rgb(40, 190, 255)";
        paintGlyphs(fringe, 0);
        ctx.restore();

        // Filled letterforms in the palette hue. Drawn source-over,
        // not additively: stacking the body on itself sums every
        // channel past the hue and lands on white, which is exactly
        // what a neon word should not do. The halo comes from the
        // bloom below rather than from a giant shadowBlur.
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.word;
        ctx.shadowBlur = 10 * scale;
        ctx.shadowColor = rgba(palette.word, 1);
        paintGlyphs(0, 0);

        // A touch of the core colour so the letterforms read as hot
        // rather than flat, without losing the hue.
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = palette.core;
        ctx.shadowBlur = 0;
        ctx.shadowColor = "rgba(0, 0, 0, 0)";
        paintGlyphs(0, 0);

        ctx.restore();

        bloomPasses(
          ctx,
          bloom,
          [
            { blur: 2.5, amount: 0.8 },
            { blur: 12, amount: 1 },
          ],
          true,
        );
      }}
    />
  );
};
