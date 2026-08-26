import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  BG_BASE,
  DRIFT_LEAN,
  DURATION_IN_FRAMES,
  HEIGHT,
  MOTION_BLUR_MIN_Z,
  MOTION_BLUR_SAMPLES,
  MOTION_BLUR_SPAN,
  MOTION_BLUR_WEIGHTS,
  WIDTH,
} from "./constants";
import {
  generateIcons,
  swayOffset,
  tiltSway,
  wrapPosition,
  type Icon,
} from "./icons";
import { buildIconSprite, type Sprite } from "./sprite";
import { buildGrainTiles, drawBackground, drawGrain } from "./background";

type Drawable = { icon: Icon; sprite: Sprite };

// The backing store already sits at the composition's full 3840x2160, which is
// more device pixels than any display the preview is scaled into, so a ratio
// above 1 would only cost memory. Read the real ratio, then cap it.
const getPixelRatio = () => {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 1);
};

export const ChatBubblesV2: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generated once, seeded. Regenerating per frame would make the whole field
  // flicker, and re-rasterising the sprites would make the render crawl.
  const drawables = useMemo<Drawable[]>(() => {
    const items: Drawable[] = [];
    for (const icon of generateIcons()) {
      const sprite = buildIconSprite(icon);
      if (sprite) items.push({ icon, sprite });
    }
    // Back to front, so bubbles and badges interleave by depth rather than one
    // kind always sitting over the other.
    return items.sort((a, b) => a.icon.z - b.icon.z);
  }, []);

  const grainTiles = useMemo(buildGrainTiles, []);
  const pixelRatio = useMemo(getPixelRatio, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground(ctx, frame);

    for (const item of drawables) drawIcon(ctx, frame, item.icon, item.sprite);

    ctx.globalAlpha = 1;
    drawGrain(ctx, frame, grainTiles);
  }, [frame, drawables, grainTiles, pixelRatio]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BASE }}>
      <canvas
        ref={canvasRef}
        width={WIDTH * pixelRatio}
        height={HEIGHT * pixelRatio}
        style={{ width: WIDTH, height: HEIGHT, display: "block" }}
      />
    </AbsoluteFill>
  );
};

const drawIcon = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  icon: Icon,
  sprite: Sprite,
) => {
  const { u, span, x, y } = wrapPosition(
    frame,
    icon.cycles,
    icon.phase,
    icon.cycleX,
    icon.halfExtent,
  );
  const drawX =
    x +
    u * span * DRIFT_LEAN +
    swayOffset(frame, icon.swayAmplitude, icon.swayPeriod, icon.swayPhase);
  const rotation = tiltSway(frame, icon.tiltSwayPeriod, icon.tiltSwayPhase);

  const blit = (offsetX: number, offsetY: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(drawX + offsetX, y + offsetY);
    ctx.rotate(rotation);
    ctx.transform(icon.tiltScaleX, icon.tiltSkewY, icon.tiltSkewX, 1, 0, 0);
    ctx.drawImage(sprite.canvas, -sprite.anchorX, -sprite.anchorY);
    ctx.restore();
  };

  if (icon.z < MOTION_BLUR_MIN_Z) {
    blit(0, 0, icon.opacity);
    return;
  }

  // One frame of travel along the drift vector, smeared backwards. Only the
  // two-cycle tier moves fast enough at 30fps to need it.
  const travelY = ((icon.cycles * span) / DURATION_IN_FRAMES) * MOTION_BLUR_SPAN;
  const travelX = travelY * DRIFT_LEAN;

  for (let i = 0; i < MOTION_BLUR_SAMPLES; i++) {
    const k = i / (MOTION_BLUR_SAMPLES - 1);
    blit(-travelX * k, travelY * k, icon.opacity * MOTION_BLUR_WEIGHTS[i]);
  }
};
