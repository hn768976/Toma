import React, { useCallback, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createRenderer,
  type Backend,
  type RendererHandle,
  type ToneMappingMode,
} from "./renderer";
import { loadNodeMaterials } from "./materials";

export type SceneContext = {
  useNodeMaterials: boolean;
  backend: Backend;
  width: number;
  height: number;
  aspect: number;
};

export type SceneApi = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Must be a pure function of `progress` — Remotion renders frames out of order. */
  update: (progress: number, frame: number) => void;
  resize?: (width: number, height: number) => void;
  dispose: () => void;
};

export type ThreeStageProps = {
  build: (ctx: SceneContext) => SceneApi;
  exposure: number;
  /** CSS background painted behind the canvas, so letterboxed edges match. */
  background: string;
  /**
   * ACES for the high-dynamic-range piece on black; none for the white one,
   * where a filmic curve would pull the paper-white cyclorama down to grey.
   */
  toneMapping?: ToneMappingMode;
  /**
   * Supersampling factor. The drawing buffer is rendered this much larger
   * than the composition and let the browser box-filter it back down on
   * composite. MSAA under SwiftShader does not survive the long, nearly
   * horizontal silhouettes these pieces are full of; brute-force SSAA does.
   */
  supersample?: number;
};

/**
 * Hosts an imperative three.js scene inside a Remotion composition.
 *
 * Deliberately not react-three-fiber: `WebGPURenderer` needs an awaited
 * `init()` and an awaited `renderAsync()` per frame, and Remotion needs every
 * frame to be a pure function of the frame number with a `delayRender` handle
 * held open until the pixels exist. Driving three directly makes both of those
 * explicit instead of fighting a reconciler's scheduling.
 */
export const ThreeStage: React.FC<ThreeStageProps> = ({
  build,
  exposure,
  background,
  toneMapping = "aces",
  supersample = 1,
}) => {
  const frame = useCurrentFrame();
  const { width: outWidth, height: outHeight, durationInFrames } = useVideoConfig();

  // Cap the drawing buffer so a 4K composition does not try to allocate an
  // 8K one; at 4K the native resolution already resolves these edges.
  const scale = Math.max(1, Math.min(supersample, 3840 / outWidth));
  const width = Math.round(outWidth * scale);
  const height = Math.round(outHeight * scale);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RendererHandle | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const initRef = useRef<Promise<void> | null>(null);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // A handle is opened synchronously during the render pass for every new
  // frame, so there is never a window in which Remotion believes the page is
  // idle while the GPU work is still outstanding.
  const pendingRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number>(-1);
  if (lastFrameRef.current !== frame) {
    lastFrameRef.current = frame;
    pendingRef.current.push(delayRender(`three.js frame ${frame}`));
  }

  const ensureInitialised = useCallback(async () => {
    if (initRef.current) {
      return initRef.current;
    }
    initRef.current = (async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("canvas missing");
      }
      await loadNodeMaterials().catch(() => undefined);
      // In Studio and the Player we take the WebGPU path; during a CLI render
      // the headless GPU stack cannot present a WebGPU swap chain, so we go
      // straight to three's WebGL2 backend (same node-material code path).
      const renderer = await createRenderer(canvas, {
        exposure,
        toneMapping,
        allowWebGPU: !getRemotionEnvironment().isRendering,
      });
      rendererRef.current = renderer;
      renderer.setSize(width, height);
      sizeRef.current = { width, height };
      sceneRef.current = build({
        useNodeMaterials: renderer.useNodeMaterials,
        backend: renderer.backend,
        width,
        height,
        aspect: width / height,
      });
      console.log(`[glass] rendering on backend: ${renderer.backend}`);
    })();
    return initRef.current;
  }, [build, exposure, toneMapping, width, height]);

  useLayoutEffect(() => {
    let cancelled = false;
    const flush = () => {
      const handles = pendingRef.current;
      pendingRef.current = [];
      for (const handle of handles) {
        continueRender(handle);
      }
    };

    (async () => {
      try {
        await ensureInitialised();
        if (cancelled) {
          return;
        }
        const renderer = rendererRef.current;
        const api = sceneRef.current;
        if (!renderer || !api) {
          return;
        }
        if (sizeRef.current.width !== width || sizeRef.current.height !== height) {
          renderer.setSize(width, height);
          api.resize?.(width, height);
          sizeRef.current = { width, height };
        }
        // `durationInFrames` is the loop period: progress hits 1.0 exactly one
        // frame past the end, so frame 0 and the wrap-around frame coincide.
        api.update(frame / durationInFrames, frame);
        await renderer.render(api.scene, api.camera);
      } catch (err) {
          console.error("[glass] render failed", err);
      } finally {
        flush();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [frame, width, height, durationInFrames, ensureInitialised]);

  useLayoutEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      rendererRef.current?.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      initRef.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
