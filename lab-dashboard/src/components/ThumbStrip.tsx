import React, { useMemo } from "react";
import { DURATION_IN_FRAMES, FONT, STRIP_H, THUMB_PANEL } from "../layout";
import { MONO } from "../fonts";
import type { FrameState } from "../lib/frame";
import { resetCtx, setFont, strokeRect, withAlpha } from "../lib/canvas";
import { LOOPING_PERIODS, epochAt } from "../lib/schedule";
import { pad, rnd, rndInt, rndPick } from "../lib/rand";

const ROWS = 4;
const BOX_W = 168;
const BOX_H = 176;
/** Samples down each thumbnail's squiggle. */
const SAMPLES = 90;

/**
 * The upper-left panel: a vertical list of small waveform thumbnails, each
 * with three lines of tiny label text beside it. The squiggles are seeded
 * once and drawn vertically, so they read as sequence traces rather than as
 * miniatures of the centre panels.
 */
export const ThumbStrip: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg, frame } = state;
  const p = cfg.palette;
  const r = THUMB_PANEL;

  // One fixed squiggle per row, generated once.
  const squiggles = useMemo(
    () =>
      Array.from({ length: ROWS }, (_, i) => {
        const parts = [1, 2, 3, 5].map((k, j) => ({
          k,
          amp: rnd(`th-${i}-a${j}`) * 0.9 + 0.15,
          phase: rnd(`th-${i}-p${j}`) * Math.PI * 2,
        }));
        return Array.from({ length: SAMPLES }, (_, s) => {
          const t = s / (SAMPLES - 1);
          let v = 0;
          for (const q of parts) v += q.amp * Math.sin(q.k * t * Math.PI * 4 + q.phase);
          return v / 2.2;
        });
      }),
    [],
  );

  resetCtx(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y + STRIP_H, r.w, r.h - STRIP_H);
  ctx.clip();

  const top = r.y + STRIP_H + 26;
  const rowH = (r.h - STRIP_H - 96) / ROWS;

  for (let i = 0; i < ROWS; i++) {
    const bx = r.x + 90;
    const by = top + i * rowH;
    const box = { x: bx, y: by, w: BOX_W, h: BOX_H };
    strokeRect(ctx, box, withAlpha(p.panelBorder, 0.85), 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.strokeStyle = withAlpha(p.tracePale, 0.9);
    ctx.lineWidth = 2.6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const cxm = box.x + box.w / 2;
    squiggles[i].forEach((v, s) => {
      const y = box.y + 10 + (s / (SAMPLES - 1)) * (box.h - 20);
      const x = cxm + v * (box.w / 2 - 14);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Three lines of tiny text in four columns beside each thumbnail.
    const tx = bx + BOX_W + 34;
    setFont(ctx, { family: MONO, size: FONT.thumb }, 0.3);
    ctx.textBaseline = "top";
    for (let line = 0; line < 3; line++) {
      const period = LOOPING_PERIODS[(i * 3 + line) % LOOPING_PERIODS.length];
      const epoch = epochAt(frame, period, (i * 53 + line * 29) % period);
      const k = `th-${i}-${line}-${epoch}`;
      const y = by + 14 + line * 52;
      ctx.fillStyle = withAlpha(p.text, 0.9);
      ctx.fillText(`${rndInt(`${k}-n`, 10, 99)}.${rndInt(`${k}-m`, 10, 99)}`, tx, y);
      ctx.fillStyle = withAlpha(p.text, 0.8);
      ctx.fillText(rndPick(`${k}-c`, cfg.labels.codePool).slice(0, 13), tx + 68, y);
      ctx.fillText(
        `${rndPick(`${k}-mo`, cfg.labels.monthPool)} ${pad(rndInt(`${k}-d`, 1, 28), 2)} 19${rndInt(`${k}-y`, 78, 98)}`,
        tx + 232,
        y,
      );
      ctx.fillStyle = withAlpha(p.trace, 0.85);
      ctx.fillText(rndPick(`${k}-p`, cfg.labels.namePool).slice(0, 15), tx + 392, y);
    }
  }

  // The slider that sits under the list, its marker sweeping once per loop.
  const sy = r.y + r.h - 42;
  ctx.strokeStyle = withAlpha(p.panelBorder, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r.x + 40, sy);
  ctx.lineTo(r.x + r.w - 40, sy);
  ctx.stroke();
  const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
  const mx = r.x + 40 + t * (r.w - 80);
  ctx.fillStyle = withAlpha(p.tracePale, 0.95);
  ctx.beginPath();
  ctx.moveTo(mx - 22, sy);
  ctx.lineTo(mx - 6, sy - 12);
  ctx.lineTo(mx - 6, sy + 12);
  ctx.closePath();
  ctx.moveTo(mx + 22, sy);
  ctx.lineTo(mx + 6, sy - 12);
  ctx.lineTo(mx + 6, sy + 12);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.textBaseline = "alphabetic";
  return null;
};
