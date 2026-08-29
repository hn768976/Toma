import React, { useMemo } from "react";
import { interpolate } from "remotion";
import { DURATION_IN_FRAMES, FONT, SPECTRUM, STRIP_H } from "../layout";
import { MONO } from "../fonts";
import type { FrameState } from "../lib/frame";
import { resetCtx, setFont, withAlpha } from "../lib/canvas";
import { pad, rnd, rndInt } from "../lib/rand";

/** One period of the spectrum, in pixels. Scrolls twice per loop. */
const SPEC_WIDTH = 2000;
const CYCLES = 2;

/**
 * A dense, high-frequency jagged line — noticeably rougher than any of the
 * three centre waveforms, which is what keeps the bottom row reading as a
 * different instrument rather than a fourth channel.
 */
export const SpectrumTrace: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg, frame, instability } = state;
  const p = cfg.palette;
  const r = SPECTRUM;

  const data = useMemo(() => {
    const out = new Float32Array(SPEC_WIDTH);
    for (let i = 0; i < SPEC_WIDTH; i++) {
      // A slow periodic envelope times per-sample noise: a ragged skyline.
      const env =
        0.62 +
        0.16 * Math.sin((Math.PI * 2 * 3 * i) / SPEC_WIDTH) +
        0.12 * Math.sin((Math.PI * 2 * 7 * i) / SPEC_WIDTH + 1.7) +
        0.08 * Math.sin((Math.PI * 2 * 13 * i) / SPEC_WIDTH + 0.4);
      // Signed, so the trace is a connected jagged line rather than a band.
      const n = rnd(`sp-${i}`) * 2 - 1;
      out[i] = Math.max(0.05, env) * Math.sign(n) * Math.abs(n) ** 0.7;
    }
    return out;
  }, []);

  resetCtx(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 4, r.y + STRIP_H + 4, r.w - 8, r.h - STRIP_H - 8);
  ctx.clip();

  const plotY = r.y + STRIP_H + 30;
  const plotH = r.h - STRIP_H - 78;
  const cy = plotY + plotH / 2;
  const half = plotH / 2;
  const off = Math.floor(
    ((frame / DURATION_IN_FRAMES) * SPEC_WIDTH * CYCLES) % SPEC_WIDTH,
  );
  const gain = interpolate(instability, [0, 1], [1, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const w = r.w - 60;
  const x0 = r.x + 30;
  const path = () => {
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const v = data[(off + x) % SPEC_WIDTH] * half * gain;
      const py = cy - Math.max(-half, Math.min(half, v));
      if (x === 0) ctx.moveTo(x0, py);
      else ctx.lineTo(x0 + x, py);
    }
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withAlpha(p.trace, 0.06);
  ctx.lineWidth = 8;
  path();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = withAlpha(p.trace, 0.95);
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  path();
  ctx.stroke();

  setFont(ctx, { family: MONO, size: FONT.tiny }, 0.4);
  ctx.textBaseline = "top";
  ctx.fillStyle = withAlpha(p.text, 0.75);
  const epoch = Math.floor(frame / 100);
  ctx.fillText(
    `${cfg.labels.spectrumTag} 1 : ${pad(rndInt(`sp-t-${epoch}`, 10, 99), 2)}/${pad(rndInt(`sp-u-${epoch}`, 10, 99), 2)}`,
    r.x + 26,
    r.y + r.h - 34,
  );
  ctx.textAlign = "right";
  ctx.fillText(
    `${cfg.labels.matrixTag} - ${pad(rndInt(`sp-v-${epoch}`, 10, 99), 2)}/${pad(rndInt(`sp-w-${epoch}`, 10, 99), 2)}`,
    r.x + r.w - 26,
    r.y + STRIP_H + 10,
  );
  ctx.textAlign = "left";

  ctx.restore();
  ctx.textBaseline = "alphabetic";
  return null;
};
