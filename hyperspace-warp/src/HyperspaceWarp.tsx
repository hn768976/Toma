import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTES, PaletteName } from "./palette";
import { WarpMode, speedNorm } from "./speed";
import { buildParticles, drawField } from "./field";
import {
  applyAnamorphicFlare,
  applyBloom,
  applyGrain,
  applyVignette,
} from "./post";

export type HyperspaceWarpProps = {
  /** Colour ramp. */
  palette: PaletteName;
  /** "arc" = calm -> warp -> calm, "loop" = constant peak, seamless. */
  mode: WarpMode;
  /** Seed for the particle population. Same seed = same field, always. */
  seed: number;
};

/** Offscreen scene buffer, cached per size across frames. */
let sceneCanvas: HTMLCanvasElement | null = null;
const getSceneCanvas = (w: number, h: number) => {
  if (!sceneCanvas || sceneCanvas.width !== w || sceneCanvas.height !== h) {
    sceneCanvas = document.createElement("canvas");
    sceneCanvas.width = w;
    sceneCanvas.height = h;
  }
  return sceneCanvas;
};

export const HyperspaceWarp: React.FC<HyperspaceWarpProps> = ({
  palette,
  mode,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Built once per seed. No Math.random() and no Date.now() anywhere below.
  const particles = useMemo(() => buildParticles(seed), [seed]);
  const pal = PALETTES[palette];

  // useLayoutEffect, not useEffect: it runs synchronously after commit and
  // before paint, so the canvas is finished by the time Remotion screenshots.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const scene = getSceneCanvas(width, height);
    const sctx = scene.getContext("2d", { alpha: false })!;

    const sn = speedNorm(frame, mode);

    // 1. Field, additively, on pure black.
    sctx.globalCompositeOperation = "source-over";
    sctx.globalAlpha = 1;
    sctx.filter = "none";
    sctx.fillStyle = "#000000";
    sctx.fillRect(0, 0, width, height);
    drawField(sctx, { frame, width, height, fps, mode, palette: pal, particles });

    // 2. Anamorphic flare goes in before the bloom so it picks up the glow.
    applyAnamorphicFlare(sctx, width, height, pal, sn);

    // 3. Composite scene + bloom onto the visible canvas.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(scene, 0, 0);
    applyBloom(ctx, scene, width, height);

    // 4. Lens/sensor finish.
    applyVignette(ctx, width, height);
    applyGrain(ctx, width, height, frame);
  }, [frame, width, height, fps, mode, pal, particles]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block", backgroundColor: "#000000" }}
    />
  );
};
