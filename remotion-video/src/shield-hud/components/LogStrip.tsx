import { useLayoutEffect } from "react";
import { random } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import { READOUT_FONT, useFontReady } from "../font";
import { onPlane, rgba, useScene } from "../scene";

/** One new row every six frames — 55 rows over the loop, so it closes. */
const FRAMES_PER_ROW = 6;
const ROW_COUNT = DURATION_IN_FRAMES / FRAMES_PER_ROW;
const GLYPHS = "0123456789ABCDEF:/.-";

const logLine = (index: number, seed: string) => {
  const length = 22 + Math.floor(random(`${seed}-log-len-${index}`) * 18);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += GLYPHS[Math.floor(random(`${seed}-log-${index}-${i}`) * GLYPHS.length)];
  }
  return out;
};

/**
 * A scrolling log along the bottom of the plane: short illegible rows
 * appearing at the foot and pushing older rows up out of the strip.
 */
export const LogStrip: React.FC = () => {
  const { buffers, palette, layout, drift, frame, seed } = useScene();
  const fontReady = useFontReady();
  const strip = layout.logStrip;

  useLayoutEffect(() => {
    if (!fontReady) return;
    const loopFrame = frame % DURATION_IN_FRAMES;
    const newest = Math.floor(loopFrame / FRAMES_PER_ROW);
    const slide = ((loopFrame % FRAMES_PER_ROW) / FRAMES_PER_ROW) * strip.rowHeight;
    const visible = Math.ceil(strip.height / strip.rowHeight) + 1;

    onPlane(buffers.near, drift, (ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(strip.x, strip.y, strip.width, strip.height);
      ctx.clip();

      ctx.font = `400 ${strip.rowHeight * 0.62}px ${READOUT_FONT}, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      for (let i = 0; i < visible; i++) {
        const rowIndex = ((newest - i) % ROW_COUNT + ROW_COUNT) % ROW_COUNT;
        const y = strip.y + strip.height - strip.rowHeight * 0.5 - i * strip.rowHeight - slide;
        // Newest rows are brightest; older rows fade as they climb.
        const fade = Math.max(0, 1 - i / visible);
        ctx.fillStyle = rgba(i === 0 ? palette.readoutWhite : palette.readoutDim, 0.28 + fade * 0.55);
        ctx.fillText(logLine(rowIndex, seed), strip.x + 26, y);

        // A leading status pip on some rows.
        if (rowIndex % 3 === 0) {
          ctx.fillStyle = rgba(palette.tickPale, 0.4 + fade * 0.4);
          ctx.fillRect(strip.x, y - strip.rowHeight * 0.22, 14, strip.rowHeight * 0.44);
        }
      }
      ctx.restore();

      // The strip's own frame.
      ctx.strokeStyle = rgba(palette.tickPale, 0.3);
      ctx.lineWidth = 2;
      ctx.strokeRect(strip.x, strip.y, strip.width, strip.height);
    });
  });

  return null;
};
