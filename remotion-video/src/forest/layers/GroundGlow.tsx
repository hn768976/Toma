import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { LayerCanvas } from "../../lib/useLayerCanvas";
import { cameraDrift, loopCos } from "../../lib/loop";
import { DURATION_IN_FRAMES, loopT } from "../constants";
import { DRIFT } from "../drift";
import { buildEdgeProfile, edgeAt } from "../../lib/noiseEdge";
import {
  buildParticleSprites,
  buildParticles,
  drawParticle,
  particleAt,
} from "../../lib/ParticleDriftField";
import { applyBloom } from "../../lib/bloom";
import { mixHex, withAlpha } from "../../lib/color";
import type { GroundSettings, Palette, ParticleSettings } from "../variants";

/**
 * The band along the base of the frame that tells you what kind of forest this
 * is: an "emberBed" of deep red glow with a dense cluster of sparks in it, or
 * a "snowBed" of pale settled accumulation with an irregular upper edge.
 *
 * Both are the same layer with different settings — including the bed
 * particles, which run through the same particle system as the airborne ones,
 * just over a span confined to the band.
 *
 * This layer blooms; the trees and fog beneath it do not.
 */
export const GroundGlow: React.FC<{
  ground: GroundSettings;
  particleSettings: ParticleSettings;
  palette: Palette;
  seedPrefix: string;
}> = ({ ground, particleSettings, palette, seedPrefix }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const W = Math.round(width / 2);
  const H = Math.round(height / 2);
  const scale = 0.5;

  const bandTop = height * (1 - ground.bandFrac);
  const edge = useMemo(() => buildEdgeProfile(`${seedPrefix}-bed-edge`, 5), [seedPrefix]);

  const sprites = useMemo(
    () =>
      buildParticleSprites(
        [palette.particleHot, palette.particleMid, palette.particleCool],
        particleSettings.coreHardness,
        particleSettings.spriteAspect,
      ),
    [palette, particleSettings.coreHardness, particleSettings.spriteAspect],
  );

  // Denser and smaller than the airborne field, and confined to the band.
  const bed = useMemo(
    () =>
      buildParticles({
        seed: `${seedPrefix}-bed`,
        count: ground.bedCount,
        width,
        spanTop: bandTop - height * 0.02,
        spanHeight: height * (ground.bandFrac + 0.02),
        behaviour: particleSettings,
        sizeScale: ground.bedSizeMax / particleSettings.sizeMax,
        loopFrames: DURATION_IN_FRAMES,
      }),
    [seedPrefix, ground, particleSettings, width, height, bandTop],
  );

  const bloom = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = Math.round(W / 2);
    c.height = Math.round(H / 2);
    return c;
  }, [W, H]);

  const t = loopT(frame);
  // A slow, closed pulse — the bed breathes once over the 8-second loop.
  const pulse = 1 - ground.pulseDepth * 0.5 * (1 - loopCos(t, 1));
  const drift = cameraDrift(t, DRIFT.ground);

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(drift.x, drift.y);

    if (ground.treatment === "emberBed") drawEmberBed(ctx);
    else drawSnowBed(ctx);

    ctx.globalCompositeOperation = particleSettings.blend;
    for (const spec of bed.particles) {
      drawParticle(ctx, sprites, particleAt(spec, bed, particleSettings, t));
    }
    ctx.restore();

    applyBloom(ctx, bloom, W, H, ground.bloomRadius * scale, ground.bloomStrength);
  };

  /**
   * Deep red light pooling on the ground, brightest at the very bottom edge
   * and gone by the top of the band. This is what says the forest burned
   * rather than simply being dark.
   */
  const drawEmberBed = (ctx: CanvasRenderingContext2D) => {
    // Charred ground first, so the additive glow that follows sits on top of
    // it rather than being dulled by it.
    const soil = ctx.createLinearGradient(0, height * 1.02, 0, bandTop);
    soil.addColorStop(0, withAlpha(palette.groundDark, 0.6));
    soil.addColorStop(1, withAlpha(palette.groundDark, 0));
    ctx.fillStyle = soil;
    ctx.fillRect(-width * 0.2, bandTop, width * 1.4, height * 1.3 - bandTop);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // A continuous band along the base, brightest at the very bottom edge and
    // gone by the top of the band. It fades to zero alpha well inside its own
    // rect, so there is no straight edge anywhere.
    const band = ctx.createLinearGradient(0, height, 0, bandTop);
    band.addColorStop(0, withAlpha(palette.groundGlow, 0.5 * pulse));
    band.addColorStop(0.35, withAlpha(palette.groundGlow, 0.24 * pulse));
    band.addColorStop(0.72, withAlpha(palette.groundGlow, 0.07 * pulse));
    band.addColorStop(1, withAlpha(palette.groundGlow, 0));
    ctx.fillStyle = band;
    ctx.fillRect(-width * 0.2, bandTop, width * 1.4, height * 1.3 - bandTop);

    // Overlapping pools on top of it, so the line of coals is unevenly lit
    // rather than a uniform strip. They are kept wide and low-contrast enough
    // to merge into the band instead of reading as separate blobs.
    const pools: [number, number, number][] = [
      [0.08, 1.02, 0.15],
      [0.24, 1.0, 0.12],
      [0.38, 1.03, 0.16],
      [0.52, 1.0, 0.11],
      [0.63, 1.02, 0.14],
      [0.78, 1.0, 0.13],
      [0.93, 1.02, 0.15],
    ];
    for (const [cx, cy, r] of pools) {
      const pool = ctx.createRadialGradient(
        width * cx,
        height * cy,
        0,
        width * cx,
        height * cy,
        width * r,
      );
      pool.addColorStop(0, withAlpha(palette.groundGlow, 0.34 * pulse));
      pool.addColorStop(0.5, withAlpha(palette.groundGlow, 0.13 * pulse));
      pool.addColorStop(1, withAlpha(palette.groundGlow, 0));
      ctx.fillStyle = pool;
      ctx.fillRect(-width * 0.2, 0, width * 1.4, height * 1.3);
    }

    // The hottest coals, right along the bottom edge.
    for (const [cx, r] of [
      [0.22, 0.055],
      [0.44, 0.04],
      [0.71, 0.05],
      [0.89, 0.038],
    ] as const) {
      const hot = ctx.createRadialGradient(
        width * cx,
        height * 1.015,
        0,
        width * cx,
        height * 1.015,
        width * r,
      );
      hot.addColorStop(0, mixHex(palette.groundGlow, palette.particleMid, 0.6, 0.28 * pulse));
      hot.addColorStop(1, withAlpha(palette.groundGlow, 0));
      ctx.fillStyle = hot;
      ctx.fillRect(-width * 0.2, 0, width * 1.4, height * 1.3);
    }
    ctx.restore();
  };

  /**
   * Snow settled unevenly around the trunks. The upper boundary is a seeded
   * sum-of-sines at two scales — broad drifts with finer lumps riding on them
   * — because a straight boundary reads as a gradient wash rather than as
   * accumulation, however bright it is.
   */
  const drawSnowBed = (ctx: CanvasRenderingContext2D) => {
    const wobble = height * ground.edgeIrregularity;
    const edgeY = (u: number) =>
      bandTop + edgeAt(edge, u) * wobble + edgeAt(edge, u * 3.1) * wobble * 0.42;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-width * 0.2, height * 1.3);
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      ctx.lineTo(-width * 0.2 + u * width * 1.4, edgeY(u));
    }
    ctx.lineTo(width * 1.2, height * 1.3);
    ctx.closePath();
    ctx.clip();

    const grad = ctx.createLinearGradient(0, height, 0, bandTop - wobble * 2);
    grad.addColorStop(0, mixHex(palette.groundGlow, palette.particleMid, 0.55, 0.95 * pulse));
    grad.addColorStop(0.45, withAlpha(palette.groundGlow, 0.62 * pulse));
    grad.addColorStop(1, withAlpha(palette.groundDark, 0.28 * pulse));
    ctx.fillStyle = grad;
    ctx.fillRect(-width * 0.2, bandTop - wobble * 3, width * 1.4, height * 1.3);

    // Brighter crests on the drifts, so the accumulation has form rather than
    // being one flat sheet. Each sits just under the edge it belongs to.
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const u = (i + 0.5) / 7;
      const cx = -width * 0.2 + u * width * 1.4;
      const cy = edgeY(u) + wobble * 1.2;
      const r = width * 0.11;
      const crest = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      crest.addColorStop(0, mixHex(palette.groundGlow, palette.particleMid, 0.7, 0.2 * pulse));
      crest.addColorStop(1, withAlpha(palette.groundGlow, 0));
      ctx.fillStyle = crest;
      ctx.fillRect(-width * 0.2, bandTop - wobble * 3, width * 1.4, height * 1.3);
    }
    ctx.restore();

    // A soft halo hugging the irregular edge, so the boundary is a settling of
    // snow into haze rather than a cut line.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = `blur(${height * 0.02}px)`;
    ctx.beginPath();
    ctx.moveTo(-width * 0.2, height * 1.3);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      ctx.lineTo(-width * 0.2 + u * width * 1.4, edgeY(u) - height * 0.012);
    }
    ctx.lineTo(width * 1.2, height * 1.3);
    ctx.closePath();
    ctx.fillStyle = withAlpha(palette.groundGlow, 0.16 * pulse);
    ctx.fill();
    ctx.restore();
  };

  return <LayerCanvas width={W} height={H} draw={draw} />;
};
