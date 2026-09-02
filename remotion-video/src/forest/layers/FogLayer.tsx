import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { LayerCanvas } from "../useLayerCanvas";
import { loopSin, loopT } from "../constants";
import { cameraDrift, DRIFT } from "../drift";
import { hexToRgb, mixRgb, rgbToCss, withAlpha } from "../color";
import { rndInt, rndRange, wrap } from "../rand";
import type { FogSettings, Palette } from "../variants";

/**
 * Drifting volumetric haze: broad, soft, wider-than-tall blobs composited with
 * 'lighter' at very low alpha and then blurred until no blob edge survives.
 *
 * Two instances of this layer are stacked at different depths — one behind the
 * mid trees, one in front of them and behind the near ones. That interleaving
 * is what creates the sense of depth; the blur alone would just look soft.
 *
 * Everything here is soft gradient, so it is computed at 1/8 resolution and
 * upscaled. The blur radius scales with it, so the result is identical to
 * blurring at 4K and roughly a quarter of the cost.
 */
export const FogLayer: React.FC<{
  depth: "back" | "front";
  fog: FogSettings;
  palette: Palette;
  seedPrefix: string;
  /** Fraction of the total blob budget this layer carries. */
  share: number;
  /** Draw the angled light shaft into this layer. */
  shaft?: boolean;
}> = ({ depth, fog, palette, seedPrefix, share, shaft = false }) => {
  const frame = useCurrentFrame();
  const W = 480;
  const H = 270;
  const scale = 1 / 8;

  const blobs = useMemo(
    () => buildBlobs(`${seedPrefix}-fog-${depth}`, Math.round(fog.blobCount * share)),
    [seedPrefix, depth, fog.blobCount, share],
  );

  const buffer = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  }, []);

  const drift = cameraDrift(frame, depth === "back" ? DRIFT.fogBack : DRIFT.fogFront);
  const t = loopT(frame);

  const pale = hexToRgb(palette.fogPale);
  const warmTarget = hexToRgb(palette.groundGlow);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const bctx = buffer.getContext("2d");
    if (!bctx) return;
    bctx.save();
    bctx.clearRect(0, 0, W, H);
    bctx.globalCompositeOperation = "lighter";

    for (const blob of blobs) {
      // Continuous sideways travel. The blob advances a whole number of frame
      // widths over 240 frames and wraps, so at frame 240 it is exactly back
      // where it started and the fog tiles seamlessly in time.
      const travel = blob.speed * t;
      const bob = loopSin(t, blob.bobCycles, blob.bobPhase) * blob.bobAmp;

      // Drawn three times across a 3x-wide wrap so a blob leaving the right
      // edge is already re-entering on the left.
      const baseX = wrap(blob.x + travel, 1) * W;
      for (const offset of [-W, 0, W]) {
        const cx = baseX + offset;
        if (cx < -blob.rx * W - W * 0.1 || cx > W + blob.rx * W + W * 0.1) continue;
        const cy = (blob.y + bob) * H;
        const rx = blob.rx * W;
        const ry = blob.ry * H;

        const grad = bctx.createRadialGradient(cx, cy, 0, cx, cy, 1);
        // Lower strata pick up a warm cast from the ground glow.
        const warm = fog.warmCast * Math.max(0, (blob.y - 0.42) / 0.5);
        const tint = mixRgb(pale, warmTarget, warm);
        grad.addColorStop(0, rgbToCss(tint, blob.alpha));
        grad.addColorStop(0.55, rgbToCss(tint, blob.alpha * 0.42));
        grad.addColorStop(1, rgbToCss(tint, 0));

        bctx.save();
        bctx.translate(cx, cy);
        bctx.scale(rx, ry);
        bctx.translate(-cx, -cy);
        bctx.fillStyle = grad;
        bctx.beginPath();
        bctx.arc(cx, cy, 1, 0, Math.PI * 2);
        bctx.fill();
        bctx.restore();
      }
    }

    if (shaft) drawShaft(bctx, W, H, palette, fog, t);
    bctx.restore();

    ctx.globalAlpha = fog.opacity;
    ctx.filter = `blur(${fog.blur * scale}px)`;
    ctx.translate(drift.x * scale, drift.y * scale);
    ctx.drawImage(buffer, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };

  return <LayerCanvas width={W} height={H} draw={draw} />;
};

/** One brighter shaft of light angling down from the upper area. */
const drawShaft = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: Palette,
  fog: FogSettings,
  t: number,
) => {
  // Breathes very slightly over the loop; closes exactly at frame 240.
  const breathe = 0.82 + 0.18 * loopSin(t, 1);
  const grad = ctx.createLinearGradient(w * 0.52, 0, w * 0.86, h * 0.9);
  grad.addColorStop(0, withAlpha(palette.fogBright, fog.shaftOpacity * breathe));
  grad.addColorStop(0.55, withAlpha(palette.fogBright, fog.shaftOpacity * 0.45 * breathe));
  grad.addColorStop(1, withAlpha(palette.fogBright, 0));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(w * 0.4, -h * 0.05);
  ctx.lineTo(w * 0.62, -h * 0.05);
  ctx.lineTo(w * 1.02, h * 0.92);
  ctx.lineTo(w * 0.66, h * 0.92);
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
  /** Whole frame-widths travelled over one 240-frame loop. */
  speed: number;
  bobAmp: number;
  bobCycles: number;
  bobPhase: number;
};

/**
 * Blobs are clustered into three horizontal strata rather than scattered, so
 * the fog reads as banded haze at particular heights instead of an even mist.
 */
const STRATA = [0.44, 0.58, 0.72];

const buildBlobs = (seed: string, count: number): FogBlob[] =>
  new Array(count).fill(0).map((_, i) => {
    const s = `${seed}-${i}`;
    const stratum = STRATA[i % STRATA.length];
    return {
      x: rndRange(`${s}-x`, 0, 1),
      y: stratum + rndRange(`${s}-y`, -0.06, 0.06),
      // Much wider than tall — this is what makes them read as bands.
      rx: rndRange(`${s}-rx`, 0.24, 0.5),
      ry: rndRange(`${s}-ry`, 0.045, 0.105),
      alpha: rndRange(`${s}-a`, 0.08, 0.24),
      speed: rndInt(`${s}-speed`, 1, 2) * (rndRange(`${s}-dir`, 0, 1) < 0.25 ? -1 : 1),
      bobAmp: rndRange(`${s}-bobamp`, 0.004, 0.018),
      bobCycles: rndInt(`${s}-bobcyc`, 1, 3),
      bobPhase: rndRange(`${s}-bobph`, 0, Math.PI * 2),
    };
  });
