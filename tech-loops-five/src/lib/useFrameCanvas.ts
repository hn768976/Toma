import { useLayoutEffect } from "react";
import { continueRender, delayRender, getRemotionEnvironment } from "remotion";
import { fontsReady } from "./fonts";

/**
 * Canvas backing-store scale. While rendering, Remotion sets the browser's
 * devicePixelRatio to the --scale value (0.5 for 1080p, 1 for 4K,
 * 1.5625 for 6000px stills), so canvases are drawn at exactly the output
 * resolution. In the Studio we cap it to keep scrubbing fast.
 */
export const canvasScale = () => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return getRemotionEnvironment().isRendering ? dpr : Math.min(dpr, 0.5);
};

/**
 * Runs an imperative draw for the current frame, after fonts are ready,
 * holding the frame capture with delayRender until it has finished.
 * `draw` must be a pure function of the frame (and static data).
 */
export const useFrameCanvas = (draw: () => void, deps: unknown[]) => {
  useLayoutEffect(() => {
    const handle = delayRender("Drawing canvas frame");
    let done = false;
    let cancelled = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    fontsReady.then(() => {
      if (!cancelled) draw();
      finish();
    }, finish);
    return () => {
      cancelled = true;
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
