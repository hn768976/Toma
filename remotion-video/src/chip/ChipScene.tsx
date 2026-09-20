import { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { VARIANTS, type VariantId } from "./config";
import { createBackend, type Backend } from "./gfx/backend";
import { bakeAll, type BakedTextures } from "./gfx/bake";
import { buildScene, type SceneParts } from "./scene/build";
import { updateScene } from "./scene/animate";
import { createOverlay, type Overlay } from "./post/overlay";

export const chipSceneSchema = z.object({
  variant: z.enum(["v1", "v2", "v3"]),
  /**
   * Backend preference. "auto" uses WebGPU when it is genuinely available and
   * falls back to WebGL2/WebGL; the explicit values pin one backend, which is
   * useful for A/B checks and for GPU machines that can render on WebGPU.
   */
  tier: z.enum(["auto", "webgpu", "webgl2", "webgl"]),
  /** Texture detail multiplier. 1 suits 1080p, 2 suits 4K. */
  detail: z.number().min(0.5).max(2),
});

export type ChipSceneProps = z.infer<typeof chipSceneSchema>;

type Rig = {
  backend: Backend;
  tex: BakedTextures;
  parts: SceneParts;
  overlay: Overlay;
};

export const ChipScene: React.FC<ChipSceneProps> = ({ variant, tier, detail }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cfg = VARIANTS[variant as VariantId];

  const threeRef = useRef<HTMLCanvasElement>(null);
  const pixiRef = useRef<HTMLCanvasElement>(null);
  const rig = useRef<Rig | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender(`chip-init-${variant}`));

  // ---- one-time construction ------------------------------------------
  useEffect(() => {
    let disposed = false;
    (async () => {
      const backend = await createBackend({
        canvas: threeRef.current!,
        pixiCanvas: pixiRef.current!,
        width,
        height,
        preference: tier,
        // The porcelain variant blows out under ACES, so it gets the neutral
        // tonemapper; the dark variants keep the filmic highlight rolloff.
        toneMapping:
          variant === "v2" ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping,
        exposure: variant === "v2" ? 1.05 : 1.45,
      });

      const boardSize = Math.round(2048 * detail);
      const lidSize = Math.round(768 * detail);
      const tex = bakeAll(backend.pixi, {
        boardSize,
        lidSize,
        seed: 9173 + variant.charCodeAt(1) * 131,
        density: cfg.traceDensity,
        label: cfg.chipLabel,
      });

      const parts = buildScene(cfg, tex, width / height, backend.three);
      const overlay = createOverlay(backend.pixi, backend.canvas, width, height);

      if (disposed) {
        overlay.destroy();
        parts.dispose();
        tex.dispose();
        backend.dispose();
        return;
      }
      rig.current = { backend, tex, parts, overlay };
      setReady(true);
      continueRender(initHandle);
    })();
    return () => {
      disposed = true;
      const r = rig.current;
      if (r) {
        r.overlay.destroy();
        r.parts.dispose();
        r.tex.dispose();
        r.backend.dispose();
        rig.current = null;
      }
    };
    // Rebuilding on every prop change is intentional: these are composition
    // level settings, not per-frame state.
  }, [variant, tier, detail, width, height, cfg, initHandle]);

  // ---- per-frame draw --------------------------------------------------
  const drawFrame = useCallback(
    async (f: number) => {
      const r = rig.current;
      if (!r) return;
      const state = updateScene(r.parts, cfg, f);
      await r.backend.render(r.parts.scene, r.parts.camera);
      r.overlay.draw({
        frame: f,
        // Blend the measured chip position with the variant's intended focus
        // height so the band never swings wildly during the descent.
        focusY: state.focusY * 0.8 + cfg.focusY * 0.2,
        bloomStrength: cfg.palette.bloomStrength * (1 + state.flash * 1.6),
        bloomThreshold: cfg.palette.bloomThreshold,
        vignette: cfg.palette.vignette,
        grain: cfg.palette.grain,
        dofStrength: cfg.dofStrength,
        focusTightness: cfg.focusTightness,
      });
    },
    [cfg],
  );

  useEffect(() => {
    if (!ready) return;
    // Remotion may advance the frame before an async render resolves, so each
    // frame takes its own handle and releases it when that frame is on screen.
    const h = delayRender(`chip-frame-${frame}`);
    let cancelled = false;
    drawFrame(frame)
      .catch((e) => {
        console.error("[chip] frame render failed", e);
      })
      .finally(() => {
        if (!cancelled) continueRender(h);
      });
    return () => {
      cancelled = true;
      continueRender(h);
    };
  }, [frame, ready, drawFrame]);

  return (
    <AbsoluteFill style={{ backgroundColor: cfg.palette.background }}>
      {/* The three.js canvas is the render source for the Pixi post pass and
          is never shown directly. */}
      <canvas
        ref={threeRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, opacity: 0 }}
      />
      <canvas
        ref={pixiRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
