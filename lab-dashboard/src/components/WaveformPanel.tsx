import React, { useMemo } from "react";
import { interpolate } from "remotion";
import { DURATION_IN_FRAMES, FONT, WAVE_PANELS, wavePlot } from "../layout";
import { MONO } from "../fonts";
import type { FrameState } from "../lib/frame";
import {
  Ctx,
  bloomStroke,
  clipRect,
  resetCtx,
  setFont,
  withAlpha,
} from "../lib/canvas";
import { SIGNAL_WIDTHS, composeSpikeTrace } from "../lib/signals";
import { pad, rndInt } from "../lib/rand";

const TRACE_W = 3;
/** Axis numbers per signal period. The trace and the numbers therefore roll
 *  over together, exactly once, across the 600 frames. */
const TICKS_PER_PERIOD = 24;
const TICKS = 9;

/** Axis numbers travel left with the trace: position j inherits what j+1 had. */
const drawTicks = (
  ctx: Ctx,
  state: FrameState,
  plot: { x: number; y: number; w: number; h: number },
  base: number,
  modulo: number,
  index: number,
): void => {
  const p = state.cfg.palette;
  setFont(ctx, { family: MONO, size: FONT.axisTick, weight: 500 }, 1);
  ctx.textAlign = "center";
  ctx.fillStyle = withAlpha(p.tracePale, 0.85);
  for (let j = 0; j < TICKS; j++) {
    const x = plot.x + 42 + (j * (plot.w - 84)) / (TICKS - 1);
    const top = rndInt(`tk-t-${index}-${(base + j) % modulo}`, 4, 96);
    const bot = rndInt(`tk-b-${index}-${(base + j) % modulo}`, 4, 96);
    ctx.textBaseline = "top";
    ctx.fillText(pad(top, 2), x, plot.y + 12);
    ctx.textBaseline = "bottom";
    ctx.fillText(pad(bot, 2), x, plot.y + plot.h - 12);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
};

/** The tiny two-line marker that floats inside the plot, as on real kit. */
const drawMarker = (
  ctx: Ctx,
  state: FrameState,
  plot: { x: number; y: number; w: number; h: number },
  index: number,
): void => {
  const p = state.cfg.palette;
  const epoch = Math.floor(state.frame / 100);
  const x = plot.x + plot.w * 0.62;
  const y = plot.y + plot.h - 96;
  ctx.fillStyle = withAlpha(p.text, 0.5);
  setFont(ctx, { family: MONO, size: FONT.tiny }, 0);
  for (let i = 0; i < 3; i++) {
    const n = rndInt(`mk-${index}-${epoch}-${i}`, 100, 999);
    ctx.fillRect(x, y + i * 13, 8 + (n % 7) * 4, 5);
    ctx.fillText(pad(n, 3), x + 46, y + i * 13 + 6);
  }
};

export const WaveformPanel: React.FC<{ state: FrameState; index: number }> = ({
  state,
  index,
}) => {
  const { ctx, cfg, frame, instability, signals } = state;
  const p = cfg.palette;
  const rect = WAVE_PANELS[index];
  const plot = wavePlot(rect);

  const period = SIGNAL_WIDTHS[index];

  // Scratch buffer for panel 3's per-frame recomposition. Allocated once.
  const scratch = useMemo(() => new Float32Array(period), [period]);

  // Exactly one period per loop, so frame 600 lands back on frame 0 and no
  // panel repeats itself on the way there.
  const scrolled = (frame / DURATION_IN_FRAMES) * period;
  const iOff = Math.floor(scrolled);

  const cy = plot.y + plot.h / 2;
  const maxH = plot.h / 2 - 52;
  const hot = state.alert?.target === index;
  const traceColor = hot ? p.tracePale : p.trace;
  const bloom = hot ? 1.7 : 1;

  resetCtx(ctx);
  ctx.save();
  clipRect(ctx, plot);

  if (index === 0) {
    /* Smooth, large-amplitude oscillation. Gain climbs with instability until
       the rounded peaks flatten against the panel bounds. */
    const gain = interpolate(instability, [0, 0.4167, 1], [1, 1.163, 2.7], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const amp = maxH * 0.94 * gain;
    const y = signals.smooth.y;
    const path = () => {
      ctx.beginPath();
      for (let x = 0; x <= plot.w; x++) {
        const v = y[(iOff + x) % period] * amp;
        const py = cy - Math.max(-maxH, Math.min(maxH, v));
        if (x === 0) ctx.moveTo(plot.x, py);
        else ctx.lineTo(plot.x + x, py);
      }
    };
    bloomStroke(ctx, path, traceColor, TRACE_W, bloom);
  } else if (index === 1) {
    /* Dense high-frequency noise drawn as a band of hairs. The band widens
       with instability until it fills the panel and the baseline is gone. */
    const spread = interpolate(instability, [0, 1], [0.52, 1.25], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const { band, jitter, weight } = signals.noise;
    const hairs = (widthMul: number, alphaMul: number, additive: boolean) => {
      ctx.save();
      if (additive) ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineWidth = TRACE_W * widthMul * 0.8;
      for (let bucket = 0; bucket < 3; bucket++) {
        ctx.strokeStyle = withAlpha(traceColor, (0.3 + bucket * 0.3) * alphaMul);
        ctx.beginPath();
        for (let x = 0; x < plot.w; x += 1) {
          const i = (iOff + x) % period;
          if (Math.floor(weight[i] * 3) !== bucket) continue;
          // Gaps between hairs are what stop the band reading as a solid mass.
          if (weight[i] < 0.34 && (i & 1) === 0) continue;
          const half = band[i] * maxH * spread;
          const mid = cy + jitter[i] * maxH * spread * 0.8;
          const px = plot.x + x + 0.5;
          ctx.moveTo(px, Math.max(plot.y, mid - half));
          ctx.lineTo(px, Math.min(plot.y + plot.h, mid + half));
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    hairs(4.5, 0.05 * bloom, true);
    hairs(1, 1, false);
  } else {
    /* Medium frequency, mostly calm, punctuated by irregular spikes. As
       instability climbs the spikes get denser and more violent until the
       panel is mostly spikes with brief calm stretches. */
    const density = interpolate(instability, [0, 0.55, 1], [0.32, 0.66, 1.05], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const gain = interpolate(instability, [0, 1], [0.72, 2.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    composeSpikeTrace(signals.spike, scratch, density, gain);
    const amp = maxH * 0.95;
    const path = () => {
      ctx.beginPath();
      for (let x = 0; x <= plot.w; x++) {
        const v = scratch[(iOff + x) % period] * amp;
        const py = cy - Math.max(-maxH, Math.min(maxH, v));
        if (x === 0) ctx.moveTo(plot.x, py);
        else ctx.lineTo(plot.x + x, py);
      }
    };
    bloomStroke(ctx, path, traceColor, TRACE_W, bloom);
  }

  ctx.restore();

  resetCtx(ctx);
  const tickStep = period / TICKS_PER_PERIOD;
  drawTicks(
    ctx,
    state,
    plot,
    Math.floor(scrolled / tickStep),
    TICKS_PER_PERIOD,
    index,
  );
  drawMarker(ctx, state, plot, index);

  return null;
};
