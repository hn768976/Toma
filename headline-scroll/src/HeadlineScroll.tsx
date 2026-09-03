/**
 * The piece. A block of invented article cards scrolls steadily along the
 * variant's axis at constant speed, tiled so the last frame hands off exactly
 * to the first, with one recurring keyword held in focus while everything
 * around it softens.
 *
 * Every pixel is a pure function of `useCurrentFrame()`: no Date.now(), no
 * requestAnimationFrame, no CSS animation, no animated state. The only state
 * here tracks font loading, which is gated by delayRender().
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { FocusPass } from "./components/FocusPass";
import { fontsReady } from "./fonts";
import { context2d } from "./vendor/canvas2d";
import { buildScene, type Scene } from "./scene";
import { VARIANTS, type VariantName } from "./variants";

export type HeadlineScrollProps = {
  variant: VariantName;
};

const GRAIN_ALPHA = 0.03;
/** Tile copies drawn each frame; anything off-frame is culled immediately. */
const TILE_INDICES = [-1, 0, 1, 2];

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  scene: Scene | null,
  variantName: VariantName,
  frame: number,
  durationInFrames: number,
  width: number,
  height: number,
): void => {
  const v = VARIANTS[variantName];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = v.palette.background;
  ctx.fillRect(0, 0, width, height);

  if (scene) {
    const vertical = v.axis === "vertical";
    // Constant speed, no easing: one whole block per loop, so frame 0 and
    // frame `durationInFrames` are the same picture.
    const travelled = (frame / durationInFrames) * scene.blockLength;

    for (const tile of TILE_INDICES) {
      for (const card of scene.cards) {
        const main = card.mainCentre + tile * scene.blockLength - travelled;
        const centreX = vertical ? card.crossCentre : main;
        const centreY = vertical ? main : card.crossCentre;
        const cw = card.composed.canvas.width;
        const ch = card.composed.canvas.height;
        const x = centreX - cw / 2;
        const y = centreY - ch / 2;
        if (x > width || y > height || x + cw < 0 || y + ch < 0) continue;
        ctx.drawImage(card.composed.canvas, x, y);
      }
    }
  }

  FocusPass(ctx, {
    frame,
    loopLength: durationInFrames,
    width,
    height,
    grainAlpha: GRAIN_ALPHA,
    vignetteColor: v.palette.vignette,
    vignetteStrength: v.vignetteStrength,
  });
};

export const HeadlineScroll: React.FC<HeadlineScrollProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [handle] = useState(() => delayRender("Loading headline typefaces"));
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fontsReady
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setFontsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cards are laid out once the faces are ready — never per frame.
  const scene = useMemo(
    () => (fontsLoaded ? buildScene(variant, width, height, durationInFrames) : null),
    [fontsLoaded, variant, width, height, durationInFrames],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFrame(context2d(canvas), scene, variant, frame, durationInFrames, width, height);
  });

  useEffect(() => {
    if (scene) continueRender(handle);
  }, [scene, handle]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
