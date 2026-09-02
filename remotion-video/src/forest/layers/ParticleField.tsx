import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { LayerCanvas } from "../useLayerCanvas";
import { cameraDrift, DRIFT } from "../drift";
import {
  buildParticleSprites,
  buildParticles,
  drawParticle,
  particleAt,
} from "../particles";
import type { Palette, ParticleSettings } from "../variants";

/**
 * The airborne particles — rising embers or falling snow, depending only on
 * `settings.direction`.
 *
 * This is the one layer that blooms. The particles are drawn once, then a
 * half-resolution blurred copy of the same canvas is composited back over
 * itself with 'lighter'. Bloom is scoped to this layer and the ground glow;
 * trees and fog never touch it.
 */
export const ParticleField: React.FC<{
  settings: ParticleSettings;
  palette: Palette;
  seedPrefix: string;
  width: number;
  height: number;
}> = ({ settings, palette, seedPrefix, width, height }) => {
  const frame = useCurrentFrame();

  const sprites = useMemo(
    () => buildParticleSprites(palette, settings.coreHardness, settings.spriteAspect),
    [palette, settings.coreHardness, settings.spriteAspect],
  );

  // The travel span overshoots the frame at both ends so particles are already
  // fully faded by the time they reach the edge of the visible area.
  const field = useMemo(
    () =>
      buildParticles({
        seed: `${seedPrefix}-air`,
        count: settings.count,
        width,
        spanTop: -height * 0.14,
        spanHeight: height * 1.28,
        settings,
      }),
    [seedPrefix, settings, width, height],
  );

  const bloom = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.round(width / 2);
    c.height = Math.round(height / 2);
    return c;
  }, [width, height]);

  const drift = cameraDrift(frame, DRIFT.particles);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.translate(drift.x, drift.y);
    ctx.globalCompositeOperation = settings.blend;
    for (const spec of field.particles) {
      drawParticle(ctx, sprites, particleAt(spec, field, settings, frame));
    }
    ctx.restore();

    applyBloom(ctx, bloom, width, height, settings.bloomRadius, settings.bloomStrength);
  };

  return <LayerCanvas width={width} height={height} draw={draw} />;
};

/**
 * Additive bloom: downsample what has been drawn, blur it, add it back.
 * Working at half resolution halves the blur radius for the same visual
 * result and is roughly four times cheaper at 4K.
 */
export const applyBloom = (
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  width: number,
  height: number,
  radius: number,
  strength: number,
) => {
  const bctx = buffer.getContext("2d");
  if (!bctx) return;
  bctx.clearRect(0, 0, buffer.width, buffer.height);
  bctx.drawImage(ctx.canvas, 0, 0, buffer.width, buffer.height);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength;
  ctx.filter = `blur(${radius / 2}px)`;
  ctx.drawImage(buffer, 0, 0, width, height);
  ctx.filter = "none";
  ctx.restore();
};
