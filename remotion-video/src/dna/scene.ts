import { useVideoConfig } from "remotion";
import { HD_WIDTH } from "./constants";

export type VersionProps = Record<string, never>;

/**
 * Everything in a version is authored against a 1920x1080 frame; this returns
 * the multiplier to apply to any pixel-denominated value so the same scene
 * renders identically at 4K.
 */
export const useStage = () => {
  const { width, height, fps, durationInFrames } = useVideoConfig();
  return {
    width,
    height,
    fps,
    durationInFrames,
    resolutionScale: width / HD_WIDTH,
  };
};

/** Linear interpolation helper that stays readable inside camera rigs. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 0→1 ease used for the opening and closing settle on every version. */
export const smooth = (t: number) => t * t * (3 - 2 * t);

export const degrees = (d: number) => (d * Math.PI) / 180;
