import { useMemo } from "react";
import { createCanvas, ctx2d, useCanvasPaint } from "../lib/canvas";
import type { PaintGate } from "../lib/canvas";
import { renderChromeWord } from "../lib/ChromeText";
import type { ChromePalette, ChromeWordSource } from "../lib/ChromeText";

export type ReflectionBedProps = {
  source: ChromeWordSource;
  palette: ChromePalette;
  width: number;
  height: number;
  centerX: number;
  /** Centre of the word box in frame coordinates, matching <ChromeText>. */
  centerY: number;
  sweep: number;
  gate?: PaintGate;
};

/** Everything below is blurred anyway, so half resolution is free. */
const SCALE = 0.5;

/**
 * A soft vertically-mirrored copy of the word beneath it, heavily blurred, at
 * low opacity, fading out downward.
 *
 * This is what grounds the text — without a reflection the word floats in the
 * black with nothing to sit on.
 */
export const ReflectionBed: React.FC<ReflectionBedProps> = ({
  source,
  palette,
  width,
  height,
  centerX,
  centerY,
  sweep,
  gate,
}) => {
  const scratch = useMemo<{ face?: HTMLCanvasElement; bed?: HTMLCanvasElement }>(
    () => ({}),
    [],
  );

  const ref = useCanvasPaint(
    (ctx) => {
      const word = source();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.clearRect(0, 0, width, height);

      if (!scratch.face) {
        scratch.face = createCanvas(word.boxWidth, word.boxHeight);
        scratch.bed = createCanvas(word.boxWidth * SCALE, word.boxHeight * SCALE);
      }
      const bed = scratch.bed as HTMLCanvasElement;

      // The same chrome face, so the reflection carries the same travelling
      // highlight and the same horizon as the word above it.
      const face = renderChromeWord(scratch.face, word, palette, { sweep });

      const bctx = ctx2d(bed);
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = "source-over";
      bctx.globalAlpha = 1;
      bctx.filter = "none";
      bctx.clearRect(0, 0, bed.width, bed.height);
      // Flip vertically about the bed's own centre.
      bctx.translate(0, bed.height);
      bctx.scale(1, -1);
      bctx.drawImage(face, 0, 0, bed.width, bed.height);
      bctx.setTransform(1, 0, 0, 1, 0, 0);

      // Fade out downward. After the flip, "down" in the frame is the top of
      // the bed canvas, so the gradient runs from opaque at the bottom edge.
      const fade = bctx.createLinearGradient(0, bed.height, 0, 0);
      fade.addColorStop(0, "rgba(0, 0, 0, 1)");
      fade.addColorStop(0.35, "rgba(0, 0, 0, 0.55)");
      fade.addColorStop(1, "rgba(0, 0, 0, 0)");
      bctx.globalCompositeOperation = "destination-in";
      bctx.fillStyle = fade;
      bctx.fillRect(0, 0, bed.width, bed.height);

      // The mirror hinges on the baseline: the top of the drawn bed sits where
      // the baseline is, offset by the padding the word box carries.
      const dw = word.boxWidth;
      const dh = word.boxHeight;
      const x = Math.round(centerX - dw / 2);
      const frameBaseline = centerY - dh / 2 + word.baselineY;
      const y = Math.round(frameBaseline - (dh - word.baselineY));

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.26;
      ctx.filter = `blur(${Math.round(word.capHeight * 0.07)}px)`;
      ctx.drawImage(bed, x, y, dw, dh);
      ctx.globalAlpha = 0.16;
      ctx.filter = `blur(${Math.round(word.capHeight * 0.22)}px)`;
      ctx.drawImage(bed, x, y, dw, dh);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
    [source, palette, width, height, centerX, centerY, sweep],
    gate,
  );

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
