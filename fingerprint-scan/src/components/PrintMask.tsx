/**
 * <PrintMask> — the fingerprint at rest.
 *
 * Draws the ridges in the palette's ridge colour through the alpha mask built
 * from the source bitmap. The source image's own black is never shown. In
 * "acquire" the resting brightness is 0, so this layer contributes nothing until
 * the scan reveals it; in "verify" the print is already here at frame 0.
 */
import React, { useEffect, useMemo, useRef } from "react";
import { PRINT_HEIGHT, PRINT_WIDTH, PRINT_X, PRINT_Y } from "../layout";
import { tintMask } from "../shared/bitmapMask";
import type { PrintMask as Mask } from "../lib/mask";
import { bloomPass } from "../shared/post";
import type { Palette } from "../variants";

export const PrintMask: React.FC<{
  mask: Mask;
  palette: Palette;
  /** 0..1 ridge brightness. */
  brightness: number;
}> = ({ mask, palette, brightness }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const tinted = useMemo(() => tintMask(mask, palette.ridge), [mask, palette.ridge]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PRINT_WIDTH, PRINT_HEIGHT);
    if (brightness <= 0.001) return;

    ctx.globalAlpha = Math.min(1, brightness);
    ctx.drawImage(tinted, 0, 0);
    ctx.globalAlpha = 1;

    // The resting print carries a soft halo of its own, well short of the
    // scan line's bloom.
    bloomPass(ctx, ref.current!, [{ radius: 26, alpha: 0.18 * brightness }]);
  });

  return (
    <canvas
      ref={ref}
      width={PRINT_WIDTH}
      height={PRINT_HEIGHT}
      style={{
        position: "absolute",
        left: PRINT_X,
        top: PRINT_Y,
        width: PRINT_WIDTH,
        height: PRINT_HEIGHT,
      }}
    />
  );
};
