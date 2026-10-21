import { useVideoConfig } from "remotion";

/**
 * Size of the drawing buffer for a full-frame canvas.
 *
 * Compositions are defined at 3840x2160. When rendered with `--scale`, Remotion
 * sets the device scale factor, so we draw at the output resolution instead of
 * drawing 4K and letting the browser downsample. `k` converts 4K units to
 * backing pixels (1 at 4K, 1/3 at 720p).
 */
export const useBacking = () => {
  const { width, height } = useVideoConfig();
  const dpr =
    typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  return { bw, bh, k: bw / 3840, width, height };
};
