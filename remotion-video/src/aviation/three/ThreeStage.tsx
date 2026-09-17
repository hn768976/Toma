import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { NoToneMapping, RenderTarget, SRGBColorSpace, WebGPURenderer } from "three/webgpu";
import type { QualityProfile } from "../config";

/** Everything a shot needs in order to build itself. */
export type StageContext = {
  readonly renderer: WebGPURenderer;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationInFrames: number;
  readonly quality: QualityProfile;
  /** True when three fell back to its WebGL2 backend rather than a WebGPU device. */
  readonly isWebGL: boolean;
};

/**
 * A built shot.
 *
 * `update` must be a pure function of the frame number — no accumulated state,
 * no wall-clock time — or the render will not match the studio preview and
 * frame ranges rendered in separate processes will not line up.
 */
export type Stage = {
  update(frame: number): void;
  /**
   * Draws the frame into `target` (null means the canvas). Implementations must
   * call `renderer.setRenderTarget(target)` immediately before rendering: three
   * clears the active target at the end of every render, so setting it once
   * from outside would not survive.
   */
  draw(target: RenderTarget | null): Promise<void>;
  dispose(): void;
};

export type StageFactory = (ctx: StageContext) => Promise<Stage>;

/**
 * How rendered pixels reach the page.
 *
 * - `readback` (the default) builds the renderer with no canvas at all, draws
 *   into an offscreen target, reads the pixels back and blits them into a 2D
 *   canvas.
 * - `canvas` lets the renderer present to its own canvas instead.
 *
 * Readback is the default because headless Chrome on a software adapter hands
 * out a perfectly good WebGPU *device* while being unable to allocate the
 * shared image that backs a canvas swap chain — and attaching such a canvas
 * poisons the renderer, so even draws aimed at an offscreen target silently
 * produce nothing. Probing for this is worse than paying for it: spinning up a
 * scratch renderer to test the canvas consumes the adapter, and the real
 * renderer then falls back to WebGL2, which is the outcome the probe existed to
 * avoid. One GPU-to-CPU copy per frame is a small price next to the screenshot
 * Remotion takes anyway, and it behaves identically on every machine.
 */
export type Presentation = "canvas" | "readback";

const TIMEOUT = 900_000;

/**
 * Drives a three.js WebGPU scene from Remotion's frame clock.
 *
 * The delicate part is the handshake. `renderAsync` only queues work, while
 * Remotion screenshots the page as soon as no `delayRender` handle is
 * outstanding. So a handle is opened during the *render phase* — the same
 * synchronous tick in which the new frame number arrives — and closed only once
 * that frame's pixels are demonstrably on the page. Opening it from an effect
 * would leave a window in which Remotion could capture the previous frame.
 */
export const ThreeStage: React.FC<{
  readonly factory: StageFactory;
  readonly quality: QualityProfile;
  /**
   * Forces three's WebGL2 backend. Scenes are authored against the WebGPU
   * renderer either way — TSL compiles to both — so this only changes which
   * device executes them.
   */
  readonly forceWebGL?: boolean;
  readonly presentation?: Presentation;
}> = ({ factory, quality, forceWebGL = false, presentation = "readback" }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blitRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const stageRef = useRef<Stage | null>(null);
  const targetRef = useRef<RenderTarget | null>(null);
  const imageRef = useRef<ImageData | null>(null);
  const flipRef = useRef(false);
  const disposedRef = useRef(false);

  const frameHandleRef = useRef<number | null>(null);
  const lastOpenedForRef = useRef<number | null>(null);
  if (lastOpenedForRef.current !== frame) {
    lastOpenedForRef.current = frame;
    frameHandleRef.current = delayRender(`three-stage frame ${frame}`, {
      timeoutInMilliseconds: TIMEOUT,
    });
  }

  const [initHandle] = useState(() =>
    delayRender("three-stage init", { timeoutInMilliseconds: TIMEOUT }),
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const closeFrameHandle = useCallback(() => {
    if (frameHandleRef.current !== null) {
      continueRender(frameHandleRef.current);
      frameHandleRef.current = null;
    }
  }, []);

  // ---- Build once -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const blit = blitRef.current;
    if (!canvas || !blit) return;

    (async () => {
      const renderer = new WebGPURenderer(
        presentation === "canvas"
          ? { canvas, antialias: true, alpha: false, forceWebGL }
          : { antialias: true, alpha: false, forceWebGL },
      );
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      // Tone mapping and the colour-space transform are applied explicitly at
      // the end of each shot's post chain, so the renderer itself stays neutral.
      renderer.toneMapping = NoToneMapping;
      renderer.outputColorSpace = SRGBColorSpace;
      await renderer.init();
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;

      const isWebGL = !(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend;

      if (presentation === "readback") {
        const target = new RenderTarget(width, height, { depthBuffer: true });
        // Rendering into a target skips the renderer's output transform, so the
        // target's own texture has to declare sRGB for the bytes we read back
        // to be display-ready.
        target.texture.colorSpace = SRGBColorSpace;
        targetRef.current = target;
        // WebGPU's copyTextureToBuffer hands back rows top-down; WebGL's
        // readPixels hands them back bottom-up.
        flipRef.current = isWebGL;

        blit.width = width;
        blit.height = height;
        canvas.style.display = "none";
        blit.style.display = "block";
        const ctx = blit.getContext("2d");
        if (ctx) imageRef.current = ctx.createImageData(width, height);
      }

      const stage = await factory({
        renderer,
        width,
        height,
        fps,
        durationInFrames,
        quality,
        isWebGL,
      });
      if (cancelled) {
        stage.dispose();
        renderer.dispose();
        return;
      }
      stageRef.current = stage;
      setReady(true);
      continueRender(initHandle);
    })().catch((err: unknown) => {
      // Surface the failure rather than hanging until Remotion's timeout.
      setError(err instanceof Error ? err : new Error(String(err)));
      continueRender(initHandle);
      closeFrameHandle();
    });

    return () => {
      cancelled = true;
      disposedRef.current = true;
      stageRef.current?.dispose();
      stageRef.current = null;
      targetRef.current?.dispose();
      targetRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
    // The factory is stable per composition; rebuilding per frame would be
    // catastrophic, so `frame` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Draw every frame -----------------------------------------------------
  useLayoutEffect(() => {
    if (error) {
      closeFrameHandle();
      return;
    }
    if (!ready) return;
    const stage = stageRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!stage || !renderer || !canvas) return;

    let cancelled = false;
    (async () => {
      stage.update(frame);
      const target = targetRef.current;
      await stage.draw(target);
      if (cancelled || disposedRef.current) return;

      if (target) {
        const raw = (await renderer.readRenderTargetPixelsAsync(
          target,
          0,
          0,
          width,
          height,
        )) as unknown as Uint8Array;
        if (cancelled || disposedRef.current) return;
        const image = imageRef.current;
        const ctx = blitRef.current?.getContext("2d");
        if (image && ctx) {
          const stride = width * 4;
          if (flipRef.current) {
            for (let y = 0; y < height; y++) {
              image.data.set(
                raw.subarray((height - 1 - y) * stride, (height - y) * stride),
                y * stride,
              );
            }
          } else {
            image.data.set(raw);
          }
          ctx.putImageData(image, 0, 0);
        }
      } else {
        // Reading the canvas back blocks until the device has finished the
        // frame; without it `renderAsync` can resolve with work still queued
        // and Remotion captures a half-drawn buffer.
        const bitmap = await createImageBitmap(canvas);
        bitmap.close();
      }
      if (cancelled) return;
      closeFrameHandle();
    })().catch((err: unknown) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      closeFrameHandle();
    });

    return () => {
      cancelled = true;
    };
  }, [frame, ready, error, closeFrameHandle, width, height]);

  // A leaked handle stalls the entire render, so make unmount unconditional.
  useEffect(() => closeFrameHandle, [closeFrameHandle]);

  if (error) throw error;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <canvas
        ref={blitRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "none" }}
      />
    </>
  );
};
