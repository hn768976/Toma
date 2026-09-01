import { useCallback, useRef } from "react";

export type CanvasHandle = {
  ctx: CanvasRenderingContext2D;
  /** Ref callback: attaches the canvas to its wrapper. */
  mount: (el: HTMLDivElement | null) => void;
};

/**
 * A canvas created eagerly, before first paint, so that layers can draw during
 * render rather than from an effect. Drawing during render keeps the whole
 * frame a pure function of `useCurrentFrame()`: there is no rAF, no timer and
 * no component state anywhere in the piece.
 *
 * The backing store is always the real 3840×2160; CSS only stretches it to fit
 * whatever the preview happens to be scaled to.
 */
export const useCanvas = (width: number, height: number): CanvasHandle => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  if (ref.current === null) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ref.current = canvas;
  }

  const mount = useCallback((el: HTMLDivElement | null) => {
    const canvas = ref.current;
    if (el && canvas && canvas.parentElement !== el) {
      el.appendChild(canvas);
    }
  }, []);

  const ctx = ref.current.getContext("2d") as CanvasRenderingContext2D;
  return { ctx, mount };
};

/**
 * Guards a draw so it happens exactly once per frame even if React renders the
 * component twice (StrictMode does, in the Studio).
 */
export const useFrameGuard = () => {
  const last = useRef<string>("");
  return (key: string): boolean => {
    if (last.current === key) return false;
    last.current = key;
    return true;
  };
};
