import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/google-fonts/RobotoMono";

const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const FALLBACK = "monospace";

/**
 * Blocks the render until the monospace face is available, so the backdrop
 * bands and node labels rasterise with the same metrics on every machine.
 */
export const useMonoFont = (): string => {
  const [handle] = useState(() => delayRender("Loading monospace font"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    waitUntilDone()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
        continueRender(handle);
      })
      .catch(() => {
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return ready ? `'${fontFamily}', ${FALLBACK}` : FALLBACK;
};

/**
 * A canvas layer that redraws itself exactly once per React render — which,
 * in Remotion, means once per frame. No requestAnimationFrame anywhere.
 */
export const useCanvasLayer = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    drawRef.current(ctx);
    ctx.restore();
  });

  return ref;
};
