import { useLayoutEffect } from "react";
import { continueRender, delayRender } from "remotion";
import { fontsReady } from "./fonts";

/**
 * Run a canvas drawing pass once per React render, after the notation
 * typeface is ready.
 *
 * Every pass in the composition awaits the same promise, and promise
 * callbacks fire in the order they were attached — which is React's layout
 * effect order, children before parents. That gives the passes a deterministic
 * sequence (clear → glyphs → composite) without a single piece of component
 * state, so a frame stays a pure function of its frame number.
 */
export const useCanvasPass = (draw: () => void) => {
  useLayoutEffect(() => {
    let cancelled = false;
    void fontsReady.then(() => {
      if (!cancelled) draw();
    });
    return () => {
      cancelled = true;
    };
  });
};

/**
 * The final pass of a frame. Attached last, and holds a delayRender() so the
 * frame is never captured before every earlier pass has painted.
 */
export const useFinalCanvasPass = (draw: () => void) => {
  useLayoutEffect(() => {
    let cancelled = false;
    const handle = delayRender("Compositing the formula field");
    void fontsReady
      .then(() => {
        if (!cancelled) draw();
      })
      .catch((err) => {
        console.error(err);
      })
      .then(() => {
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  });
};
