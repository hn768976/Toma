import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  BG_PALE,
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
  generateBubbles,
  generateSpecks,
  swayOffset,
  tiltSway,
  wrapPosition,
  type Bubble,
  type Speck,
} from "./bubbles";
import { buildBubbleSprite, buildSpeckSprite, type Sprite } from "./sprite";
import {
  buildGrainTiles,
  drawBackgroundGradient,
  drawGrain,
  drawHighlight,
  drawVignette,
} from "./background";

type Drawable =
  | { kind: "bubble"; z: number; bubble: Bubble; sprite: Sprite }
  | { kind: "speck"; z: number; speck: Speck; sprite: Sprite };

// The backing store already sits at the composition's full 3840x2160, which is
// more device pixels than any display the preview is scaled into, so a ratio
// above 1 would only cost memory. Read the real ratio, then cap it.
const getPixelRatio = () => {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 1);
};

export const ChatBubbles: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generated once, seeded. Regenerating per frame would make the whole field
  // flicker, and re-rasterising the sprites would make the render crawl.
  const drawables = useMemo<Drawable[]>(() => {
    const items: Drawable[] = [];

    for (const bubble of generateBubbles()) {
      const sprite = buildBubbleSprite(bubble);
      if (sprite) items.push({ kind: "bubble", z: bubble.z, bubble, sprite });
    }
    for (const speck of generateSpecks()) {
      const sprite = buildSpeckSprite(speck);
      if (sprite) items.push({ kind: "speck", z: speck.z, speck, sprite });
    }

    // Back to front, so specks sit scattered among the bubbles by depth.
    return items.sort((a, b) => a.z - b.z);
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
    drawBackgroundGradient(ctx, frame);

    for (const item of drawables) {
      if (item.kind === "speck") {
        drawSpeck(ctx, frame, item.speck, item.sprite);
      } else {
        drawBubble(ctx, frame, item.bubble, item.sprite);
      }
    }

    ctx.globalAlpha = 1;
    drawHighlight(ctx, frame);
    drawVignette(ctx);
    drawGrain(ctx, frame, grainTiles);
  }, [frame, drawables, grainTiles, pixelRatio]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_PALE }}>
      <canvas
        ref={canvasRef}
        width={WIDTH * pixelRatio}
        height={HEIGHT * pixelRatio}
        style={{ width: WIDTH, height: HEIGHT, display: "block" }}
      />
    </AbsoluteFill>
  );
};

const drawSpeck = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  speck: Speck,
  sprite: Sprite,
) => {
  const { u, span, x, y } = wrapPosition(
    frame,
    speck.cycles,
    speck.phase,
    speck.cycleX,
    speck.halfExtent,
  );
  const drawX =
    x +
    u * span * DRIFT_LEAN +
    swayOffset(frame, speck.swayAmplitude, speck.swayPeriod, speck.swayPhase);

  ctx.globalAlpha = speck.opacity;
  ctx.drawImage(sprite.canvas, drawX - sprite.anchorX, y - sprite.anchorY);
};

const drawBubble = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  bubble: Bubble,
  sprite: Sprite,
) => {
  const { u, span, x, y } = wrapPosition(
    frame,
    bubble.cycles,
    bubble.phase,
    bubble.cycleX,
    bubble.halfExtent,
  );
  const drawX =
    x +
    u * span * DRIFT_LEAN +
    swayOffset(frame, bubble.swayAmplitude, bubble.swayPeriod, bubble.swayPhase);
  const rotation = tiltSway(frame, bubble.tiltSwayPeriod, bubble.tiltSwayPhase);

  const blit = (offsetX: number, offsetY: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(drawX + offsetX, y + offsetY);
    ctx.rotate(rotation);
    // Fixed pseudo-3D tilt: squash x and skew, so the bubble reads as turned
    // slightly away from camera.
    ctx.transform(bubble.tiltScaleX, bubble.tiltSkewY, bubble.tiltSkewX, 1, 0, 0);
    ctx.drawImage(sprite.canvas, -sprite.anchorX, -sprite.anchorY);
    ctx.restore();
  };

  if (bubble.z < MOTION_BLUR_MIN_Z) {
    blit(0, 0, bubble.opacity);
    return;
  }

  // One frame of travel along the drift vector, smeared backwards. Without
  // this the fast near bubbles strobe at 30fps.
  const travelY = ((bubble.cycles * span) / DURATION_IN_FRAMES) * MOTION_BLUR_SPAN;
  const travelX = travelY * DRIFT_LEAN;

  for (let i = 0; i < MOTION_BLUR_SAMPLES; i++) {
    const k = i / (MOTION_BLUR_SAMPLES - 1);
    blit(-travelX * k, travelY * k, bubble.opacity * MOTION_BLUR_WEIGHTS[i]);
  }
};
