/**
 * Version 1 — "flat". The dashboard, frontal, at 4K.
 *
 * This component does almost nothing: the dashboard paints itself into its own
 * offscreen buffer (`useDashboardBuffer`) and this blits that buffer to the
 * composition canvas 1:1. Version 2 takes the identical buffer and uploads it as
 * a texture instead.
 */

import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { VARIANTS, type VariantName } from "./variants";
import { useDashboardBuffer } from "./dashboard/useDashboardBuffer";

export type AnalyticsProps = { variant: VariantName };

export const Analytics: React.FC<AnalyticsProps> = ({ variant }) => {
  const config = VARIANTS[variant] ?? VARIANTS.flat;
  const buffer = useDashboardBuffer(config);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const screenRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const ctx = screen.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buffer, 0, 0, screen.width, screen.height);
  }, [buffer, frame, width, height]);

  return (
    <AbsoluteFill>
      <canvas
        ref={screenRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
