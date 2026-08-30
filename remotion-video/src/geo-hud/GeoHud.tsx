import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, WIDTH } from "./constants";
import { createDashboardRenderer } from "./dashboard";
import { useHudFonts } from "./fonts";
import { useWorld } from "./map/geo";
import type { Ctx2D } from "./paint";
import { VARIANTS, type VariantName } from "./variants";

/**
 * v1 / v2: the dashboard drawn straight onto the composition's own canvas.
 *
 * The canvas backing store is always 3840x2160 regardless of the render scale,
 * so `--scale=0.5` produces a downsampled 1080p preview of the real 4K frame
 * rather than a smaller drawing.
 */
export const GeoHud: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useWorld();
  const fonts = useHudFonts();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const v = VARIANTS[variant];

  const renderer = useMemo(
    () =>
      world && fonts
        ? createDashboardRenderer({ variant: v, world, fonts, fps })
        : null,
    [world, fonts, v, fps],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderer) return;
    const ctx = canvas.getContext("2d") as Ctx2D | null;
    if (!ctx) return;
    renderer.render(ctx, frame);
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        backgroundColor: v.palette.background,
      }}
    />
  );
};
