import { useLayoutEffect } from "react";
import { READOUT_FONT, useFontReady } from "../font";
import { onPlane, rgba, useScene } from "../scene";

/**
 * A filled bar in the palette's accent hue carrying small illegible label
 * text — the only saturated non-glyph colour in frame. It gets its own
 * buffer so it can bloom moderately without dragging the readouts with it.
 */
export const AccentBar: React.FC<{ index: number }> = ({ index }) => {
  const { buffers, palette, layout, drift } = useScene();
  const fontReady = useFontReady();
  const bar = layout.accentBars[index];

  useLayoutEffect(() => {
    if (!fontReady) return;
    onPlane(buffers.accent, drift, (ctx) => {
      // The bar itself: a solid slab with a brighter leading block.
      const gradient = ctx.createLinearGradient(bar.x, bar.y, bar.x + bar.width, bar.y);
      gradient.addColorStop(0, rgba(palette.accent, 0.95));
      gradient.addColorStop(0.62, rgba(palette.accent, 0.68));
      gradient.addColorStop(1, rgba(palette.accent, 0.16));
      ctx.fillStyle = gradient;
      ctx.fillRect(bar.x, bar.y, bar.width, bar.height);

      ctx.fillStyle = rgba(palette.accent, 1);
      ctx.fillRect(bar.x, bar.y, bar.height * 1.8, bar.height);

      // Label text, sized to be read as a texture rather than as words.
      ctx.font = `500 ${bar.height * 0.5}px ${READOUT_FONT}, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(palette.readoutWhite, 0.75);
      ctx.fillText(bar.label, bar.x + bar.height * 2.3, bar.y + bar.height * 0.54);

      // A short companion bar, offset below, the way HUD chrome pairs up.
      ctx.fillStyle = rgba(palette.accent, 0.5);
      ctx.fillRect(bar.x + bar.width * 0.06, bar.y + bar.height * 1.5, bar.width * 0.28, bar.height * 0.3);
    });
  });

  return null;
};
