/**
 * The cascade. Owns the one 3840x2160 canvas and blits the dialog sprite once
 * per spawned dialog, in spawn order, so later dialogs land on top of earlier
 * ones and the pile builds visibly.
 *
 * Every value on screen is a pure function of useCurrentFrame(): the dialog
 * list is precomputed from seeded randomness, the pop-in comes from spring(),
 * and the canvas is fully repainted from scratch on each React render. There
 * is no requestAnimationFrame, no CSS animation, no Date.now(), and no
 * component state, so seeking straight to frame 437 produces exactly the same
 * image as playing up to it.
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { HEIGHT, VARIANTS, WIDTH, type VariantName } from "../config";
import { buildDialogs, type DialogInstance } from "../dialogs";
import { fontsReady, onFontsReady } from "../fonts";
import { drawGrain } from "../grain";
import { getDialogSprite, invalidateDialogSprites } from "./Dialog";

interface PaintArgs {
  variant: VariantName;
  dialogs: DialogInstance[];
  frame: number;
  fps: number;
}

const paint = (ctx: CanvasRenderingContext2D, { variant, dialogs, frame, fps }: PaintArgs) => {
  const { palette, spawnDurationInFrames, spawnFromScale, grainAlpha } = VARIANTS[variant];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sprite = getDialogSprite(variant);
  const halfW = sprite.width / 2;
  const halfH = sprite.height / 2;

  for (let i = 0; i < dialogs.length; i++) {
    const d = dialogs[i];
    // The schedule is in spawn order, so the first unspawned dialog ends it.
    if (d.spawnFrame > frame) {
      break;
    }

    const age = frame - d.spawnFrame;
    let scale = 1;
    if (age < spawnDurationInFrames) {
      // Quick, stiff, mechanical. A graceful entrance would be wrong here.
      const progress = spring({
        frame: age,
        fps,
        config: { damping: 200, stiffness: 420, mass: 0.35 },
        durationInFrames: spawnDurationInFrames,
      });
      scale = spawnFromScale + (1 - spawnFromScale) * progress;
    }

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);
    if (scale !== 1) {
      ctx.scale(scale, scale);
    }
    ctx.drawImage(sprite.canvas, -halfW, -halfH);
    ctx.restore();
  }

  drawGrain(ctx, frame, palette.grain, grainAlpha);
};

export const SpawnLayer: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The full cascade — position, rotation and spawn frame for every dialog —
  // resolved once per variant from seeded randomness.
  const dialogs = useMemo(() => buildDialogs(variant), [variant]);

  // The one dialog sprite that gets blitted hundreds of times. Rebuilt if it
  // was first drawn before the webfont arrived.
  const fontStamp = fontsReady();
  useMemo(() => getDialogSprite(variant), [variant, fontStamp]);

  const args = useRef<PaintArgs>({ variant, dialogs, frame, fps });
  args.current = { variant, dialogs, frame, fps };

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      paint(ctx, args.current);
    }
  }, []);

  // Once per React render — which is once per frame — and never on a timer.
  useEffect(draw);

  // If the webfont lands after the first paint, drop the sprite and repaint.
  // delayRender() is still held at that point, so no frame has been captured.
  useEffect(
    () =>
      onFontsReady(() => {
        invalidateDialogSprites();
        draw();
      }),
    [draw],
  );

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
