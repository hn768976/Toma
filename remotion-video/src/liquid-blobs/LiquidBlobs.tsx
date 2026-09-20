import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { LiquidBlobsScene, type SuperSample } from "./scene";
import { variantIdSchema, variants } from "./variants";

export const liquidBlobsSchema = z.object({
  variant: variantIdSchema,
  /**
   * Side length of the per-pixel sample grid. The blob silhouettes are drawn
   * inside the fragment shader, so hardware antialiasing cannot reach them —
   * this is the only control over edge quality. 2 is the sensible default; 3
   * is for a final pass on hardware that can afford it.
   */
  superSample: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Fusion radius of the smooth-minimum. Larger gives fatter liquid necks. */
  blendRadius: z.number().min(0.05).max(2),
  /**
   * Backend to draw with. "auto" prefers WebGPU and falls back to WebGL2 and
   * then WebGL; the others pin a backend, still falling back if it fails.
   */
  renderer: z.enum(["auto", "webgpu", "webgl2", "webgl"]),
  /** Draws the active backend into the corner. Never enable for a delivery. */
  debugOverlay: z.boolean(),
});

export type LiquidBlobsProps = z.infer<typeof liquidBlobsSchema>;

export const liquidBlobsDefaults: LiquidBlobsProps = {
  variant: "v1-blue",
  superSample: 2,
  blendRadius: 0.62,
  renderer: "auto",
  debugOverlay: false,
};

export const LiquidBlobs: React.FC<LiquidBlobsProps> = ({
  variant,
  superSample,
  blendRadius,
  renderer,
  debugOverlay,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LiquidBlobsScene | null>(null);
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const [backendNote, setBackendNote] = useState("starting up");
  const [error, setError] = useState<string | null>(null);

  // One handle for the whole component. Remotion seeks the same page for
  // every frame, so the scene is built once and only the uniforms change.
  const [handle] = useState(() =>
    delayRender("liquid-blobs: first frame", {
      timeoutInMilliseconds: 240_000,
    }),
  );
  const settled = useRef(false);

  const settle = useCallback(() => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    continueRender(handle);
  }, [handle]);

  useEffect(() => {
    let cancelled = false;
    const perFrame = delayRender(`liquid-blobs: frame ${frame}`, {
      timeoutInMilliseconds: 240_000,
    });

    (async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        if (!sceneRef.current) {
          sceneRef.current = await LiquidBlobsScene.create({
            canvas,
            variant: variants[variant],
            width,
            height,
            superSample: superSample as SuperSample,
            blendRadius,
            rendererPreference: renderer,
          });
          if (cancelled) {
            sceneRef.current.dispose();
            sceneRef.current = null;
            return;
          }
          setBackendNote(sceneRef.current.created.note);
        }

        const scene = sceneRef.current;
        const size = scene.size;
        if (size.width !== width || size.height !== height) {
          scene.resize(width, height);
        }
        scene.setVariant(variants[variant]);
        scene.setBlendRadius(blendRadius);

        // The motion is periodic in the loop length, so dividing by
        // durationInFrames is what makes the last frame hand back to the
        // first without a seam.
        await scene.renderAt(frame / durationInFrames);
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        continueRender(perFrame);
        settle();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    frame,
    durationInFrames,
    width,
    height,
    variant,
    superSample,
    blendRadius,
    renderer,
    settle,
  ]);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <AbsoluteFill
      style={{ backgroundColor: variants[variant].backgroundBottom }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {debugOverlay ? (
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 24,
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: Math.round(height / 60),
          }}
        >
          {error ? `ERROR ${error}` : backendNote} · frame {frame}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
