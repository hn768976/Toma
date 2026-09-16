import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { createCellScene, type CellScene } from "./scene";
import { createRenderer, type Backend, type RendererHandle } from "./renderer";
import { THEMES, type ThemeId } from "./themes";

export const cellDivisionSchema = z.object({
  theme: z.enum(["mono", "blue", "violet"]),
  /** Reseeding gives a different colony with identical timing and look. */
  seed: z.number().int(),
  /** "auto" prefers WebGPU and falls back to WebGL2 if it is not usable. */
  backend: z.enum(["auto", "webgpu", "webgl2"]),
});

export type CellDivisionProps = z.infer<typeof cellDivisionSchema>;

export const cellDivisionDefaults: CellDivisionProps = {
  theme: "mono",
  seed: 20260916,
  backend: "auto",
};

type Ctx = { scene: CellScene; handle: RendererHandle };

export const CellDivision: React.FC<CellDivisionProps> = ({
  theme,
  seed,
  backend,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<Promise<Ctx> | null>(null);
  const [activeBackend, setActiveBackend] = useState<Backend | null>(null);

  // Building the scene compiles shaders, so it is keyed on the props that
  // genuinely invalidate it -- and on nothing else, so scrubbing the
  // timeline in the Studio does not recompile on every frame.
  const key = `${theme}:${seed}:${backend}:${width}x${height}`;
  const keyRef = useRef(key);
  if (keyRef.current !== key) {
    keyRef.current = key;
    ctxRef.current = null;
  }

  const getCtx = useCallback((): Promise<Ctx> => {
    if (ctxRef.current) return ctxRef.current;
    const promise = (async (): Promise<Ctx> => {
      const container = containerRef.current;
      if (!container) throw new Error("Canvas container is not mounted yet.");
      container.replaceChildren();
      const handle = await createRenderer(container, width, height, backend);
      const scene = createCellScene(THEMES[theme as ThemeId], seed);
      scene.setSize(width, height);
      return { scene, handle };
    })();
    ctxRef.current = promise;
    return promise;
  }, [theme, seed, backend, width, height]);

  useEffect(() => {
    const delay = delayRender(`Rendering cell-division frame ${frame}`);
    let cancelled = false;

    (async () => {
      try {
        const ctx = await getCtx();
        if (cancelled) return;
        setActiveBackend(ctx.handle.backend);
        ctx.scene.setFrame(frame);
        await ctx.handle.renderer.renderAsync(ctx.scene.scene, ctx.scene.camera);
        if (!cancelled) continueRender(delay);
      } catch (err) {
        cancelRender(err as Error);
      }
    })();

    return () => {
      cancelled = true;
      continueRender(delay);
    };
  }, [frame, getCtx]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {/* Studio-only readout of which backend actually came up. Remotion
          sets NODE_ENV to production when rendering, so it is never burnt
          into a delivered frame. */}
      {process.env.NODE_ENV !== "production" && activeBackend ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 12,
            font: "500 14px ui-monospace, monospace",
            color: theme === "mono" ? "#55555b" : "#9fd0ff",
            opacity: 0.75,
          }}
        >
          backend: {activeBackend}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
