import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Mark, spriteFor } from "./Mark";
import type { SpriteRegistry, SpriteSpec } from "./Mark";
import { cellX, cellY, FRAME_H, FRAME_W } from "./grid";
import { buildPaperTexture } from "./texture";
import { flickerFactor, markOpacity } from "./timing";
import type { Variant } from "./types";

const RAD = Math.PI / 180;

/**
 * Walks the variant's mark array and composites it onto the frame canvas.
 * Sprites are built once by the <Mark> children below; per frame this only
 * computes each mark's current opacity and blits it with a transform.
 */
export const MarkField: React.FC<{
  variant: Variant;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  frame: number;
  fps: number;
  durationInFrames: number;
}> = ({ variant, canvasRef, frame, fps, durationInFrames }) => {
  const registry: SpriteRegistry = useRef<Record<string, HTMLCanvasElement>>({});

  const { sprites, placements } = useMemo(() => {
    const byKey = new Map<string, SpriteSpec>();
    const placed = variant.field.map((spec) => {
      const sprite = spriteFor(spec, variant.palette, variant.pitch);
      if (!byKey.has(sprite.key)) byKey.set(sprite.key, sprite);
      return {
        spec,
        key: sprite.key,
        x: cellX(variant.pitch, spec.gx),
        y: cellY(variant.pitch, spec.gy),
      };
    });
    return { sprites: [...byKey.values()], placements: placed };
  }, [variant]);

  const paper = useMemo(
    () => (variant.paper ? buildPaperTexture(480, 270) : null),
    [variant.paper],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = variant.palette.bg;
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);

    // Paper mottling sits under the marks and never moves.
    if (paper && variant.paper) {
      ctx.globalAlpha = variant.paper.alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(paper, 0, 0, FRAME_W, FRAME_H);
      ctx.globalAlpha = 1;
    }

    for (const p of placements) {
      const base = markOpacity(p.spec, frame);
      if (base <= 0.001) continue;
      const dip = p.spec.flicker
        ? flickerFactor(
            p.spec.id,
            frame,
            fps,
            variant.flicker ?? variant.inkVariation,
          )
        : 1;
      const sprite = registry.current[p.key];
      if (!sprite) continue;

      const spin = p.spec.spin
        ? (p.spec.spin * 360 * frame) / durationInFrames
        : 0;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, base * dip));
      ctx.translate(p.x, p.y);
      if (p.spec.rot || spin) ctx.rotate((p.spec.rot + spin) * RAD);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    }
  });

  return (
    <>
      {sprites.map((sprite) => (
        <Mark
          key={sprite.key}
          sprite={sprite}
          palette={variant.palette}
          stroke={variant.stroke}
          registry={registry}
        />
      ))}
    </>
  );
};
