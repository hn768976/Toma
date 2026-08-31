import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { hexToRgb, mixRgb, rgba, type Rgb } from "./color";
import {
  GLOW_BUCKETS,
  STRAND_SEGMENTS,
  buildStrands,
  strandPoints,
  type Strand,
} from "./geometry";
import { useCanvasLayer } from "./hooks";
import { HEIGHT, WIDTH, ambientDrift, nodeY, type Flow } from "./layout";
import { clamp, smoothstep } from "./math";
import type { VariantConfig } from "./variants";

/** The glow pass is drawn in three chunks of falling alpha so it fades out. */
const GLOW_CHUNKS = [
  { from: 0, to: 0.5, alpha: 1 },
  { from: 0.5, to: 0.8, alpha: 0.55 },
  { from: 0.8, to: 1, alpha: 0.24 },
] as const;
const GLOW_BLUR = 14;
const GLOW_ALPHA = 0.12;
/** Where the strand colour has finished desaturating to the pale mid tone. */
const PALE_AT = 0.45;
/** How much of the curve the fade-out is spread over. */
const FADE_LENGTH = 0.12;

const strandColour = (
  hue: Rgb,
  pale: Rgb,
  white: Rgb,
  t: number,
): Rgb =>
  t < PALE_AT
    ? mixRgb(hue, pale, t / PALE_AT)
    : mixRgb(pale, white, (t - PALE_AT) / (1 - PALE_AT));

/**
 * A travelling brightness peak running from the node outward. The pulse
 * period divides 600, so the peak is back where it started at frame 600.
 */
const pulseAt = (strand: Strand, frame: number, t: number): number => {
  const head = ((frame % 600) / strand.pulsePeriod + strand.pulsePhase) % 1;
  let d = t - head;
  if (d > 0.5) {
    d -= 1;
  } else if (d < -0.5) {
    d += 1;
  }
  return 1 + strand.pulseGain * Math.exp(-((d / 0.13) ** 2));
};

export const StrandFan: React.FC<{
  readonly config: VariantConfig;
  readonly flow: Flow;
}> = ({ config, flow }) => {
  const frame = useCurrentFrame();

  // Geometry is generated once. Per frame we only move the control points.
  const strands = useMemo(() => buildStrands(config), [config]);

  // Strand indices grouped by node and alpha bucket, for the batched glow.
  const buckets = useMemo(() => {
    const grid: number[][][] = config.sources.map(() =>
      Array.from({ length: GLOW_BUCKETS }, () => [] as number[]),
    );
    strands.forEach((s, i) => {
      grid[s.nodeIndex][s.bucket].push(i);
    });
    return grid;
  }, [strands, config]);

  const samples = useMemo(
    () => new Float64Array(strands.length * (STRAND_SEGMENTS + 1) * 2),
    [strands],
  );
  const scratch = useMemo(
    () => new Float64Array((STRAND_SEGMENTS + 1) * 2),
    [],
  );

  const ref = useCanvasLayer(WIDTH, HEIGHT, (ctx) => {
    const drift = ambientDrift(frame);
    ctx.translate(drift.dx, drift.dy);

    const stride = (STRAND_SEGMENTS + 1) * 2;
    const hues = config.palette.nodeHues.map(hexToRgb);
    const pale = hexToRgb(config.palette.strandPale);
    const white = hexToRgb(config.palette.strandWhite);

    for (let i = 0; i < strands.length; i++) {
      const s = strands[i];
      strandPoints(s, nodeY(config, s.nodeIndex), flow, frame, scratch);
      samples.set(scratch, i * stride);
    }

    const indexOf = (t: number) =>
      Math.max(0, Math.min(STRAND_SEGMENTS, Math.round(t * STRAND_SEGMENTS)));

    // Pass one: a wide, low-alpha glow, batched per node and alpha bucket so
    // the expensive blurred rasterisation happens a handful of times.
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let n = 0; n < buckets.length; n++) {
      const glowRgb = mixRgb(hues[n], pale, 0.4);
      ctx.shadowColor = rgba(glowRgb, 1);
      ctx.shadowBlur = GLOW_BLUR;
      for (let b = 0; b < GLOW_BUCKETS; b++) {
        const group = buckets[n][b];
        if (group.length === 0) {
          continue;
        }
        let widthSum = 0;
        let alphaSum = 0;
        for (const gi of group) {
          widthSum += strands[gi].width;
          alphaSum += strands[gi].alpha;
        }
        ctx.lineWidth = (widthSum / group.length) * 2.4;
        const bucketAlpha = (alphaSum / group.length) * GLOW_ALPHA;

        for (const chunk of GLOW_CHUNKS) {
          ctx.beginPath();
          for (const gi of group) {
            const s = strands[gi];
            const base = gi * stride;
            const from = indexOf(chunk.from * s.glowEnd);
            const to = indexOf(chunk.to * s.glowEnd);
            if (to <= from) {
              continue;
            }
            ctx.moveTo(samples[base + from * 2], samples[base + from * 2 + 1]);
            for (let p = from + 1; p <= to; p++) {
              ctx.lineTo(samples[base + p * 2], samples[base + p * 2 + 1]);
            }
          }
          ctx.strokeStyle = rgba(glowRgb, bucketAlpha * chunk.alpha);
          ctx.stroke();
        }
      }
    }
    ctx.shadowBlur = 0;

    // Pass two: the sharp core, one short stroke per segment so colour,
    // pulse brightness and the fade-out can all vary along the curve.
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < strands.length; i++) {
      const s = strands[i];
      const base = i * stride;
      ctx.lineWidth = s.width;
      for (let seg = 0; seg < STRAND_SEGMENTS; seg++) {
        const t = (seg + 0.5) / STRAND_SEGMENTS;
        // Opacity falls to zero over the last third: no strand ever just stops.
        const fade = (1 - smoothstep(s.fadeStart, s.fadeStart + FADE_LENGTH, t)) ** 1.7;
        if (fade <= 0.002) {
          break;
        }
        const alpha = clamp(s.alpha * fade * pulseAt(s, frame, t), 0, 1);
        if (alpha < 0.012) {
          continue;
        }
        ctx.strokeStyle = rgba(strandColour(hues[s.nodeIndex], pale, white, t), alpha);
        ctx.beginPath();
        ctx.moveTo(samples[base + seg * 2], samples[base + seg * 2 + 1]);
        ctx.lineTo(samples[base + (seg + 1) * 2], samples[base + (seg + 1) * 2 + 1]);
        ctx.stroke();
      }
    }
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        mixBlendMode: "screen",
      }}
    />
  );
};
