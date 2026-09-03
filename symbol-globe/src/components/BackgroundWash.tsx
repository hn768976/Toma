/**
 * The soft wash behind everything.
 *
 * Three broad radial blooms drift on independent closed paths at whole-cycle
 * frequencies, plus a fixed vertical lift. Together they keep the background
 * from reading as a flat field without ever becoming a subject of their own.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { closedDrift } from "../lib/seededRandom";
import { withAlpha } from "../lib/color";
import { useStageLayer } from "../stage/CanvasStage";
import type { Palette } from "../variants";

const BLOOMS = [
  { seed: "wash-a", x: 0.3, y: 0.34, radius: 0.78, alpha: 0.2 },
  { seed: "wash-b", x: 0.74, y: 0.62, radius: 0.66, alpha: 0.14 },
  { seed: "wash-c", x: 0.52, y: 0.16, radius: 0.52, alpha: 0.09 },
];

export type BackgroundWashProps = {
  palette: Palette;
  /**
   * Frames in one full loop. Passed explicitly rather than read from the
   * composition so the same component can be rendered past the end of its loop
   * (frame 450 of a 450-frame cycle) to prove the loop actually closes.
   */
  loopLength: number;
  z: number;
};

export const BackgroundWash: React.FC<BackgroundWashProps> = ({
  palette,
  loopLength,
  z,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const draw = (ctx: CanvasRenderingContext2D) => {
    const t = frame / loopLength;
    ctx.globalCompositeOperation = "lighter";
    for (const bloom of BLOOMS) {
      // Amplitudes are a fraction of the frame, so the wash drifts at a
      // visibly different rate from everything else in the piece.
      const offset = closedDrift(bloom.seed, t, width * 0.06, height * 0.05, 2);
      const cx = bloom.x * width + offset.x;
      const cy = bloom.y * height + offset.y;
      const r = bloom.radius * height;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, withAlpha(palette.backgroundWash, bloom.alpha));
      gradient.addColorStop(
        0.55,
        withAlpha(palette.backgroundWash, bloom.alpha * 0.3),
      );
      gradient.addColorStop(1, withAlpha(palette.backgroundWash, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  };

  useStageLayer({ id: "background-wash", z, draw });
  return null;
};
