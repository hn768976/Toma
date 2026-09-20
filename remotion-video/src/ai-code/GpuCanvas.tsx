import React, { useCallback, useEffect, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";

type Props<S> = {
  /** Backing-store size in device pixels. */
  readonly width: number;
  readonly height: number;
  /** Builds the GPU state once, when the page boots. */
  readonly create: (
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ) => Promise<S>;
  /** Advances that state to `frame` and draws it. Must be a pure function
   * of the frame number — Remotion renders frames out of order across
   * workers, so anything time- or accumulation-based would drift. */
  readonly draw: (state: S, frame: number) => Promise<void> | void;
  readonly dispose?: (state: S) => void;
  readonly label: string;
  readonly style?: React.CSSProperties;
};

/**
 * Hosts a GPU-backed canvas inside a Remotion composition.
 *
 * Both the one-time context setup and every per-frame draw are wrapped in
 * delayRender()/continueRender(), so Remotion never screenshots a canvas
 * that is still blank or still showing the previous frame.
 */
export const GpuCanvas = <S,>({
  width,
  height,
  create,
  draw,
  dispose,
  label,
  style,
}: Props<S>) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<S | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createRef = useRef(create);
  const drawRef = useRef(draw);
  const disposeRef = useRef(dispose);
  createRef.current = create;
  drawRef.current = draw;
  disposeRef.current = dispose;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const handle = delayRender(`${label}: creating GPU context`);
    let cancelled = false;

    createRef.current(canvas, width, height).then(
      (state) => {
        if (cancelled) {
          disposeRef.current?.(state);
          return;
        }
        stateRef.current = state;
        setReady(true);
        continueRender(handle);
      },
      (err: Error) => {
        setError(err);
        continueRender(handle);
      },
    );

    return () => {
      cancelled = true;
      if (stateRef.current) {
        disposeRef.current?.(stateRef.current);
        stateRef.current = null;
      }
    };
    // Re-creating on resize is intentionally not supported: a composition
    // has a fixed size, and tearing down a GPU context mid-render is
    // exactly the kind of work Remotion should never wait on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      return;
    }
    const handle = delayRender(`${label}: drawing frame ${frame}`);
    Promise.resolve(drawRef.current(state, frame)).then(
      () => continueRender(handle),
      (err: Error) => {
        setError(err);
        continueRender(handle);
      },
    );
  }, [frame, ready, label]);

  const setCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  if (error) {
    throw error;
  }

  return (
    <canvas
      ref={setCanvas}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        ...style,
      }}
    />
  );
};
