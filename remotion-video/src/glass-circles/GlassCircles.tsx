import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { createEngine, type GlassEngine } from "./engine";
import { VARIANTS } from "./variants";

export const glassCirclesSchema = z.object({
  /**
   * v1/v2 are the three-disc sheet-glass rig (dark blue / bright sky blue);
   * v3/v4 are the sphere-field rig (violet / near-black with crimson).
   */
  variant: z.enum(["v1", "v2", "v3", "v4"]),
  /** Use WebGPU when the browser exposes it; WebGL2 is the automatic fallback. */
  preferWebGPU: z.boolean(),
  /** MSAA samples on the scene pass, where the backend honours them. */
  samples: z.number().int().min(1).max(8),
  /**
   * Renders at this multiple of the output size and filters back down.
   * FXAA already handles the rim stepping, so 1 is the default; 2 sharpens
   * the result further and is worth it on a GPU, at 4x the fragment cost.
   */
  supersample: z.number().min(1).max(2),
  /** Overlays the active graphics backend; for checking renders, not delivery. */
  showBackend: z.boolean(),
});

export type GlassCirclesProps = z.infer<typeof glassCirclesSchema>;

export const glassCirclesDefaults: GlassCirclesProps = {
  variant: "v2",
  preferWebGPU: true,
  samples: 4,
  supersample: 1,
  showBackend: false,
};

const RENDER_TIMEOUT = 600000;

export const GlassCircles: React.FC<GlassCirclesProps> = ({
  variant,
  preferWebGPU,
  samples,
  supersample,
  showBackend,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enginePromiseRef = useRef<Promise<GlassEngine> | null>(null);
  // Renders are chained so a frame never starts before the previous one has
  // finished on the shared renderer.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [backend, setBackend] = useState<string | null>(null);

  // Loop position. Frame `durationInFrames` would land back on 0, which is what
  // makes the clip seamless.
  const cycle = frame / durationInFrames;
  // Read by the engine's warm-up, which happens inside the first frame's own
  // effect and so needs that frame's loop position.
  const cycleRef = useRef(cycle);
  cycleRef.current = cycle;

  const getEngine = useCallback((): Promise<GlassEngine> => {
    if (!enginePromiseRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) {
        return Promise.reject(new Error("Output canvas was not mounted"));
      }
      canvas.width = width;
      canvas.height = height;
      enginePromiseRef.current = createEngine({
        target: canvas,
        width,
        height,
        variant: VARIANTS[variant],
        preferWebGPU,
        samples,
        supersample,
        initialCycle: cycleRef.current,
      });
    }
    return enginePromiseRef.current;
  }, [width, height, variant, preferWebGPU, samples, supersample]);

  // Created during render rather than in the effect, so the handle exists the
  // moment the frame changes and Remotion never screenshots a stale canvas.
  const handle = useMemo(
    () =>
      delayRender(`glass-circles-${variant}-frame-${frame}`, {
        timeoutInMilliseconds: RENDER_TIMEOUT,
      }),
    [variant, frame],
  );

  useEffect(() => {
    queueRef.current = queueRef.current
      .then(async () => {
        const engine = await getEngine();
        setBackend(engine.backend);
        await engine.renderFrame(cycle);
      })
      .then(
        () => continueRender(handle),
        (error: Error) => cancelRender(error),
      );
  }, [handle, cycle, getEngine]);

  useEffect(() => {
    const pending = enginePromiseRef.current;
    return () => {
      if (pending) {
        pending.then((engine) => engine.dispose()).catch(() => undefined);
      }
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: VARIANTS[variant].clearColor }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {showBackend ? (
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 24,
            padding: "8px 16px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: Math.round(height / 45),
          }}
        >
          {`backend: ${backend ?? "pending"} | ${width}x${height} | frame ${frame}`}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
