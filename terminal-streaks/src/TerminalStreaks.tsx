import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontReady } from "./load-fonts";
import { getLayout } from "./streaks/motion";
import type { Variant } from "./streaks/palette";
import { drawFrame } from "./streaks/render";

export type TerminalStreaksProps = {
  variant: Variant;
};

/**
 * Backing-store resolution relative to the composition. Remotion's --scale
 * sets the page's device pixel ratio, so a --scale=0.5 preview draws a
 * 1920x1080 canvas and a --scale=1 master draws the full 3840x2160 one: the
 * canvas is always exactly the output resolution, never supersampled. Every
 * size in the piece is a fraction of the canvas, so the two match.
 */
const pixelRatio = () =>
  typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 1);

export const TerminalStreaks: React.FC<TerminalStreaksProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const ratio = pixelRatio();
  const layout = useMemo(
    () => getLayout(Math.round(width * ratio), Math.round(height * ratio)),
    [width, height, ratio],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const handle = delayRender(`Drawing streaks frame ${frame}`);
    let cancelled = false;

    fontReady.then(() => {
      if (!cancelled) {
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) drawFrame(ctx, frame, durationInFrames, variant, layout);
      }
      continueRender(handle);
    });

    return () => {
      cancelled = true;
    };
  }, [frame, durationInFrames, variant, layout]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={ref}
        width={layout.width}
        height={layout.height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
