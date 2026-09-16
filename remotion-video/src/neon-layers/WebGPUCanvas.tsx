import { useCallback, useEffect, useRef } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";

/**
 * Drives a three.js WebGPU scene from Remotion's frame clock.
 *
 * Remotion screenshots the page once every `delayRender()` handle has been
 * released, so every frame opens a handle during the React render pass (which
 * Remotion triggers synchronously when it seeks) and only releases it after the
 * GPU has reported the submitted work as done. Without that the screenshot can
 * race ahead of the swap chain and capture the previous frame.
 */
export type SceneHandle<TScene> = {
  scene: TScene;
  /** Draw `frame`. Resolves once the GPU has finished the submitted work. */
  draw: (frame: number) => Promise<void>;
  dispose: () => void;
};

export type WebGPUCanvasProps<TScene> = {
  width: number;
  height: number;
  /** Called once per canvas. Receives the canvas already sized in device px. */
  init: (canvas: HTMLCanvasElement) => Promise<SceneHandle<TScene>>;
  timeoutInMilliseconds?: number;
};

export function WebGPUCanvas<TScene>({
  width,
  height,
  init,
  timeoutInMilliseconds = 300_000,
}: WebGPUCanvasProps<TScene>) {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Promise<SceneHandle<TScene>> | null>(null);
  const handleRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<number>(-1);

  // Opened during render — not in an effect — so that the handle is registered
  // before Remotion checks whether the frame is ready to be captured.
  if (pendingFrameRef.current !== frame) {
    pendingFrameRef.current = frame;
    handleRef.current = delayRender(`WebGPU frame ${frame}`, {
      timeoutInMilliseconds,
    });
  }

  const release = useCallback(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (!sceneRef.current) {
      sceneRef.current = init(canvas);
    }
    sceneRef.current
      .then(async (handle) => {
        if (cancelled) {
          return;
        }
        await handle.draw(frame);
        if (!cancelled) {
          release();
        }
      })
      .catch((err) => {
        // Surface the real error instead of letting the render time out.
        release();
        throw err;
      });
    return () => {
      cancelled = true;
    };
  }, [frame, init, release]);

  useEffect(() => {
    return () => {
      const pending = sceneRef.current;
      sceneRef.current = null;
      pending?.then((handle) => handle.dispose()).catch(() => undefined);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
