import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { LayerCanvas } from "./useLayerCanvas";
import { buildEdgeProfile, edgeAt } from "./noiseEdge";
import { cameraDrift, loopT } from "./loop";
import { clamp, lerp, rndBool, rndRange, wrap } from "./random";
import type { SvgSpriteSet } from "./useSvgSprites";

/**
 * Places ONE source SVG many times across a frame, with a seeded flip, scale,
 * shear, rotation, squash and depth per instance, and blurs the whole result
 * once. Stack several of these at different depths and you have a silhouette
 * field: a treeline, a skyline, a crowd, a mountain range, a reed bed.
 *
 * Two things make this work rather than look like wallpaper:
 *
 *  - The whole band is blurred ONCE, on the way out of its own offscreen
 *    buffer. Blurring per instance means one blur pass per instance per frame,
 *    which is unusable at 4K for any interesting count.
 *
 *  - Scale comes from a golden-ratio low-discrepancy sequence over the
 *    instance index, not a plain random draw. A random draw regularly places
 *    two same-size instances side by side, and two same-size instances of one
 *    silhouette — one of them flipped — read instantly as a mirrored stamp.
 *    Spreading scale across neighbours is the single most effective defence
 *    against the repetition showing.
 *
 * Palette-agnostic: colour enters only through the pre-tinted sprite set and
 * the optional `ridgeColor`.
 */
export type SilhouetteBand = {
  count: number;
  /** Instance height at scale 1.0, as a fraction of frame height. */
  baseHeightFrac: number;
  scaleMin: number;
  scaleMax: number;
  /** Exponent on the scale distribution; > 1 biases toward small instances. */
  scaleBias: number;
  /** Where the instances stand, as a fraction of frame height. */
  baseYFrac: number;
  baseYJitter: number;
  /** Blur radius in composition pixels, applied ONCE to the whole band. */
  blur: number;
  opacityMin: number;
  opacityMax: number;
  /** Slice of the sprite set's 0..1 depth ramp this band occupies. */
  depthMin: number;
  depthMax: number;
  /** Backing-store scale for this band's canvas; 1 = full composition size. */
  resolution: number;
  shearDeg: number;
  rotateDeg: number;
  squashMin: number;
  squashMax: number;
  /**
   * Confines instances to the left and right edges instead of spreading them.
   * Useful for a very large, very out-of-focus foreground band: four huge
   * instances spread evenly wall the frame off, whereas four pressed against
   * the edges frame it.
   */
  edgeHugging?: boolean;
  /**
   * An irregular ground ridge filled from `yFrac` down to the bottom of the
   * band, hiding the flat cut where the source artwork ends and giving the
   * band its own ground line. Omit for a band whose bases are already off
   * the bottom of the frame.
   */
  ridge?: { yFrac: number; wobbleFrac: number } | null;
};

export type SilhouetteInstance = {
  x: number;
  y: number;
  height: number;
  flip: boolean;
  shear: number;
  rotate: number;
  squash: number;
  opacity: number;
  tint: number;
};

/**
 * Generates one band's placement. Pure and deterministic — call it from a
 * useMemo, never per frame.
 */
export const buildSilhouetteBand = (
  band: SilhouetteBand,
  width: number,
  height: number,
  tintSteps: number,
  seed: string,
): SilhouetteInstance[] => {
  // Horizontal placement is stratified — one instance per equal slice of an
  // over-wide range, jittered inside its slice — rather than uniformly random,
  // which avoids the clumps and gaps a plain spread produces at these counts.
  // The range overhangs both edges so instances are genuinely cropped by them.
  const spanStart = -0.12 * width;
  const spanEnd = 1.12 * width;
  const slice = (spanEnd - spanStart) / band.count;

  const instances = new Array(band.count).fill(0).map((_, i) => {
    const s = `${seed}-${i}`;
    const scaleT = wrap(i * 0.6180339887 + rndRange(`${s}-scale`, 0, 0.22), 1);
    const scale = lerp(
      band.scaleMin,
      band.scaleMax,
      Math.pow(scaleT, band.scaleBias),
    );
    const squash = rndRange(`${s}-squash`, band.squashMin, band.squashMax);
    // Depth tracks size: the biggest instances read as the nearest ones, so
    // they get the front of the tint ramp and the most opacity.
    const depthLocal = clamp(
      1 - (scale - band.scaleMin) / (band.scaleMax - band.scaleMin),
      0,
      1,
    );
    const depth = lerp(band.depthMin, band.depthMax, depthLocal);

    return {
      x: band.edgeHugging
        ? width *
          (i % 2 === 0
            ? rndRange(`${s}-x`, -0.1, 0.13)
            : rndRange(`${s}-x`, 0.87, 1.1))
        : spanStart + slice * (i + rndRange(`${s}-x`, 0.05, 0.95)),
      y:
        height *
        (band.baseYFrac + rndRange(`${s}-y`, -1, 1) * band.baseYJitter),
      height: height * band.baseHeightFrac * scale * squash,
      flip: rndBool(`${s}-flip`),
      shear: (rndRange(`${s}-shear`, -1, 1) * band.shearDeg * Math.PI) / 180,
      rotate: (rndRange(`${s}-rot`, -1, 1) * band.rotateDeg * Math.PI) / 180,
      squash,
      opacity: lerp(band.opacityMax, band.opacityMin, depthLocal),
      tint: clamp(Math.round(depth * (tintSteps - 1)), 0, tintSteps - 1),
    };
  });

  // Smallest (most distant) first, so the largest sit on top.
  return instances.sort((a, b) => a.height - b.height);
};

export const SvgSilhouetteField: React.FC<{
  sprites: SvgSpriteSet;
  band: SilhouetteBand;
  /** Stable seed. Same seed + same band = same layout, every render. */
  seed: string;
  /** Horizontal drift amplitude in composition pixels. Larger = nearer. */
  driftAmount?: number;
  /** Fill for the ground ridge; ignored when the band has no ridge. */
  ridgeColor?: string;
  /**
   * Seed for the ridge shape alone. Defaults to `${seed}-ridge`; override it
   * to reshape a band's ground line without moving any of its instances.
   */
  ridgeSeed?: string;
  /**
   * Frames in one loop. Defaults to the composition's own duration, which is
   * the usual case; set it when the loop is shorter than the composition —
   * a 120-frame cycle played twice in a 240-frame comp, or a composition
   * given one extra frame so that frame N can be compared against frame 0.
   */
  loopFrames?: number;
}> = ({
  sprites,
  band,
  seed,
  driftAmount = 0,
  ridgeColor,
  ridgeSeed,
  loopFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const res = band.resolution;
  const bufferW = Math.max(1, Math.round(width * res));
  const bufferH = Math.max(1, Math.round(height * res));

  const instances = useMemo(
    () => buildSilhouetteBand(band, width, height, sprites.steps.length, seed),
    [band, width, height, sprites.steps.length, seed],
  );
  const ridgeKey = ridgeSeed ?? `${seed}-ridge`;
  const ridgeProfile = useMemo(() => buildEdgeProfile(ridgeKey), [ridgeKey]);

  // The band's single offscreen buffer, allocated once and reused each frame.
  const buffer = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = bufferW;
    canvas.height = bufferH;
    return canvas;
  }, [bufferW, bufferH]);

  const drift = cameraDrift(loopT(frame, loopFrames ?? durationInFrames), driftAmount);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const bctx = buffer.getContext("2d");
    if (!bctx) return;

    bctx.save();
    bctx.clearRect(0, 0, bufferW, bufferH);
    bctx.scale(res, res);
    bctx.translate(drift.x, drift.y);

    for (const item of instances) {
      const w = (item.height * sprites.aspect) / item.squash;
      bctx.save();
      bctx.globalAlpha = item.opacity;
      bctx.translate(item.x, item.y);
      bctx.rotate(item.rotate);
      // A horizontal shear about the base: the instance leans, its base stays
      // planted. Shear + flip + a wide scale range is what stops one source
      // silhouette from reading as a repeated stamp.
      bctx.transform(1, 0, Math.tan(item.shear), 1, 0, 0);
      if (item.flip) bctx.scale(-1, 1);
      bctx.drawImage(sprites.steps[item.tint], -w / 2, -item.height, w, item.height);
      bctx.restore();
    }

    if (band.ridge && ridgeColor) {
      const ridgeY = height * band.ridge.yFrac;
      const wobble = height * band.ridge.wobbleFrac;
      bctx.beginPath();
      bctx.moveTo(-width * 0.2, height * 1.3);
      const steps = 96;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        bctx.lineTo(
          -width * 0.2 + u * width * 1.4,
          ridgeY + edgeAt(ridgeProfile, u) * wobble,
        );
      }
      bctx.lineTo(width * 1.2, height * 1.3);
      bctx.closePath();
      bctx.fillStyle = ridgeColor;
      bctx.fill();
    }
    bctx.restore();

    // The one and only blur for this band. The radius scales with the buffer
    // resolution, so a half-resolution band still reads as its full-size blur.
    if (band.blur > 0) ctx.filter = `blur(${band.blur * res}px)`;
    ctx.drawImage(buffer, 0, 0);
    ctx.filter = "none";
  };

  return <LayerCanvas width={bufferW} height={bufferH} draw={draw} />;
};
