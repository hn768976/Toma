import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { fontsReady } from "./fonts";
import { applyGrain, GrainOptions } from "./grain";

/**
 * Draws one frame. `w`/`h` are the canvas backing size in device pixels;
 * everything is laid out as fractions of them so 720p previews and 4K renders
 * are the same picture. Must be a pure function of `frame`.
 */
export type DrawFn<P> = (ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, props: P) => void;

export function CanvasLook<P>({ draw, props, grain }: { draw: DrawFn<P>; props: P; grain: GrainOptions }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  // Backing store matches the output pixels (render --scale → devicePixelRatio),
  // never larger than the composition size.
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const W = Math.round(width * dpr);
  const H = Math.round(height * dpr);

  useLayoutEffect(() => {
    const handle = delayRender(`Canvas frame ${frame}`);
    let live = true;
    fontsReady.then(() => {
      const c = ref.current;
      if (live && c) {
        const ctx = c.getContext("2d", { willReadFrequently: true, alpha: false })!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        draw(ctx, W, H, frame, props);
        applyGrain(ctx, W, H, frame, grain);
      }
      continueRender(handle);
    });
    return () => {
      live = false;
    };
  }, [frame, W, H, draw, props, grain]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={ref} width={W} height={H} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
}
