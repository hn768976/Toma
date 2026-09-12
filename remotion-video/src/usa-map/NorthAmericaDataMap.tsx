// North America big-data map — a tilted, dot-matrix continent lit by city
// hotspots, with a slow push-in over exactly 10s at 30fps.

import { useEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  CENTER_X_FACTOR,
  CENTER_Y_FACTOR,
  DIST_END,
  DIST_START,
  DRIFT_X,
  DRIFT_Y,
  FOCAL_FACTOR,
  PITCH_DEG,
  ROLL_DEG,
  TARGET_X,
  TARGET_Y,
  YAW_DEG,
  BASE_HEIGHT,
} from "./constants";
import { Camera } from "./camera";
import { drawScene } from "./draw";
import { THEMES } from "./themes";

export const northAmericaDataMapSchema = z.object({
  theme: z.enum(["signal", "cyan"]),
  /** 1 = 1080p, 2 = 4K. Scales every authored dimension. */
  resolutionScale: z.number().min(0.25).max(4),
});

export type NorthAmericaDataMapProps = z.infer<typeof northAmericaDataMapSchema>;

export const northAmericaDataMapDefaults: NorthAmericaDataMapProps = {
  theme: "signal",
  resolutionScale: 1,
};

const RAD = Math.PI / 180;

/** Smooth, non-linear ease so the push-in never feels mechanical. */
const easeInOut = (t: number) => t * t * (3 - 2 * t);

export const NorthAmericaDataMap: React.FC<NorthAmericaDataMapProps> = ({
  theme,
  resolutionScale,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const t = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
    const e = easeInOut(t);
    // Independent, slower cycle for the drift so the move never resolves into
    // a single obvious direction.
    const drift = Math.sin(t * Math.PI * 0.82);

    const camera: Camera = {
      pitch: (PITCH_DEG + e * 1.4) * RAD,
      yaw: YAW_DEG * RAD,
      roll: ROLL_DEG * RAD,
      dist: DIST_START + (DIST_END - DIST_START) * e,
      focal: FOCAL_FACTOR * BASE_HEIGHT * resolutionScale,
      targetX: TARGET_X + DRIFT_X * drift,
      targetY: TARGET_Y - DRIFT_Y * e,
      centerX: width * CENTER_X_FACTOR,
      centerY: height * CENTER_Y_FACTOR,
    };

    drawScene({
      ctx,
      width,
      height,
      res: resolutionScale,
      frame,
      durationInFrames,
      theme: THEMES[theme],
      camera,
    });
  }, [frame, width, height, durationInFrames, theme, resolutionScale]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
