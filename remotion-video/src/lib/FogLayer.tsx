import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { LayerCanvas } from "./useLayerCanvas";
import { cameraDrift, loopSin, loopT } from "./loop";
import { hexToRgb, mixRgb, rgbToCss, withAlpha } from "./color";
import { clamp, rndInt, rndRange, wrap } from "./random";

/**
 * Drifting volumetric haze: broad, wider-than-tall blobs composited with
 * 'lighter' at very low alpha and then blurred until no blob edge survives.
 *
 * Two notes on getting depth out of it:
 *
 *  - Stack two or more instances at different points in the layer order —
 *    one behind the mid-ground, one in front of it — rather than putting all
 *    the haze in one layer. Interleaving the fog between the depth bands is
 *    what creates the sense of depth; blur alone just looks soft.
 *
 *  - Blobs are clustered into horizontal strata, not scattered, so the result
 *    reads as banded haze at particular heights rather than an even mist.
 *
 * All of it is soft gradient, so the whole layer is computed into a small
 * backing store (1/8 of the composition is plenty) and upscaled. The blur
 * radius scales with it, so the result matches blurring at full size at a
 * fraction of the cost.
 *
 * Motion closes exactly at the end of the loop: each blob advances a whole
 * number of frame widths and wraps.
 */
export type FogShaft = {
  color: string;
  opacity: number;
  /** Left and right edge of the shaft at the top, as fractions of width. */
  topLeft: number;
  topRight: number;
  /** ...and at the bottom. The offset between them is the angle. */
  bottomLeft: number;
  bottomRight: number;
  /**
   * Where the brightness falls off along, as fractions of width. Defaults to
   * the shaft's own centre line, which is usually what you want; set it
   * explicitly when the light should fade across the shaft rather than down
   * it.
   */
  gradientTop?: number;
  gradientBottom?: number;
};

export const FogLayer: React.FC<{
  seed: string;
  blobCount: number;
  /** Heights of the horizontal strata blobs cluster into, 0..1. */
  strata: number[];
  /** Base haze colour, as a hex string. */
  color: string;
  /** Colour the lowest strata are mixed toward, and by how much (0..1). */
  tintColor?: string;
  tintAmount?: number;
  /**
   * Where the tint ramp starts and how far it takes to reach full strength,
   * as fractions of frame height. Widen or raise these to make the haze read
   * as lit from below by something on the ground rather than ambiently.
   */
  tintFrom?: number;
  tintSpan?: number;
  /** Master opacity for the whole layer. */
  opacity: number;
  /** Blur radius in composition pixels. */
  blur: number;
  /** Backing-store size. 1/8 of the composition is a good default. */
  bufferWidth?: number;
  bufferHeight?: number;
  driftAmount?: number;
  shaft?: FogShaft | null;
  /**
   * Frames in one loop. Defaults to the composition's own duration, which is
   * the usual case; set it when the loop is shorter than the composition —
   * a 120-frame cycle played twice in a 240-frame comp, or a composition
   * given one extra frame so that frame N can be compared against frame 0.
   */
  loopFrames?: number;
}> = ({
  seed,
  blobCount,
  strata,
  color,
  tintColor,
  tintAmount = 0,
  tintFrom = 0.42,
  tintSpan = 0.5,
  opacity,
  blur,
  bufferWidth,
  bufferHeight,
  driftAmount = 0,
  shaft = null,
  loopFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const W = bufferWidth ?? Math.max(1, Math.round(width / 8));
  const H = bufferHeight ?? Math.max(1, Math.round(height / 8));
  const scale = W / width;

  const blobs = useMemo(
    () => buildBlobs(seed, blobCount, strata),
    [seed, blobCount, strata],
  );

  const buffer = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }, [W, H]);

  const t = loopT(frame, loopFrames ?? durationInFrames);
  const drift = cameraDrift(t, driftAmount);
  const base = hexToRgb(color);
  const target = hexToRgb(tintColor ?? color);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const bctx = buffer.getContext("2d");
    if (!bctx) return;
    bctx.save();
    bctx.clearRect(0, 0, W, H);
    bctx.globalCompositeOperation = "lighter";

    for (const blob of blobs) {
      const bob = loopSin(t, blob.bobCycles, blob.bobPhase) * blob.bobAmp;
      const baseX = wrap(blob.x + blob.speed * t, 1) * W;

      // Drawn across a 3x-wide wrap, so a blob leaving the right edge is
      // already re-entering on the left.
      for (const offset of [-W, 0, W]) {
        const cx = baseX + offset;
        if (cx < -blob.rx * W - W * 0.1 || cx > W + blob.rx * W + W * 0.1) continue;
        const cy = (blob.y + bob) * H;
        const grad = bctx.createRadialGradient(cx, cy, 0, cx, cy, 1);
        const warm = tintAmount * clamp((blob.y - tintFrom) / tintSpan, 0, 1);
        const tint = mixRgb(base, target, warm);
        grad.addColorStop(0, rgbToCss(tint, blob.alpha));
        grad.addColorStop(0.55, rgbToCss(tint, blob.alpha * 0.42));
        grad.addColorStop(1, rgbToCss(tint, 0));

        bctx.save();
        bctx.translate(cx, cy);
        bctx.scale(blob.rx * W, blob.ry * H);
        bctx.translate(-cx, -cy);
        bctx.fillStyle = grad;
        bctx.beginPath();
        bctx.arc(cx, cy, 1, 0, Math.PI * 2);
        bctx.fill();
        bctx.restore();
      }
    }

    if (shaft) drawShaft(bctx, W, H, shaft, t);
    bctx.restore();

    ctx.globalAlpha = opacity;
    ctx.filter = `blur(${blur * scale}px)`;
    ctx.translate(drift.x * scale, drift.y * scale);
    ctx.drawImage(buffer, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };

  return <LayerCanvas width={W} height={H} draw={draw} />;
};

/** One brighter shaft of light angling through the haze. */
const drawShaft = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shaft: FogShaft,
  t: number,
) => {
  // Breathes very slightly over the loop, and closes exactly at the end of it.
  const breathe = 0.82 + 0.18 * loopSin(t, 1);
  const gradTop = shaft.gradientTop ?? (shaft.topLeft + shaft.topRight) / 2;
  const gradBottom =
    shaft.gradientBottom ?? (shaft.bottomLeft + shaft.bottomRight) / 2;
  const grad = ctx.createLinearGradient(w * gradTop, 0, w * gradBottom, h * 0.9);
  grad.addColorStop(0, withAlpha(shaft.color, shaft.opacity * breathe));
  grad.addColorStop(0.55, withAlpha(shaft.color, shaft.opacity * 0.45 * breathe));
  grad.addColorStop(1, withAlpha(shaft.color, 0));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(w * shaft.topLeft, -h * 0.05);
  ctx.lineTo(w * shaft.topRight, -h * 0.05);
  ctx.lineTo(w * shaft.bottomRight, h * 0.92);
  ctx.lineTo(w * shaft.bottomLeft, h * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

type FogBlob = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
  /** Whole frame-widths travelled over one loop; negative drifts left. */
  speed: number;
  bobAmp: number;
  bobCycles: number;
  bobPhase: number;
};

const buildBlobs = (
  seed: string,
  count: number,
  strata: number[],
): FogBlob[] =>
  new Array(count).fill(0).map((_, i) => {
    const s = `${seed}-${i}`;
    const stratum = strata[i % strata.length];
    return {
      x: rndRange(`${s}-x`, 0, 1),
      y: stratum + rndRange(`${s}-y`, -0.06, 0.06),
      // Much wider than tall — this is what makes them read as bands.
      rx: rndRange(`${s}-rx`, 0.24, 0.5),
      ry: rndRange(`${s}-ry`, 0.045, 0.105),
      alpha: rndRange(`${s}-a`, 0.08, 0.24),
      speed:
        rndInt(`${s}-speed`, 1, 2) * (rndRange(`${s}-dir`, 0, 1) < 0.25 ? -1 : 1),
      bobAmp: rndRange(`${s}-bobamp`, 0.004, 0.018),
      bobCycles: rndInt(`${s}-bobcyc`, 1, 3),
      bobPhase: rndRange(`${s}-bobph`, 0, Math.PI * 2),
    };
  });
