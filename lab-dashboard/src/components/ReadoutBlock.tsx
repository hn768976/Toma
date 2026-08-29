import React, { useMemo } from "react";
import { interpolate } from "remotion";
import { DURATION_IN_FRAMES, FONT, READOUT_BLOCKS } from "../layout";
import { SANS } from "../fonts";
import type { FrameState } from "../lib/frame";
import {
  bloomText,
  drawTabular,
  resetCtx,
  setFont,
  tabularWidth,
  withAlpha,
} from "../lib/canvas";
import { buildSteps, stepAt } from "../lib/schedule";
import { rndSigned } from "../lib/rand";

/** Frames a readout stays bright after it steps. */
const FLASH_FRAMES = 3;

/**
 * A large number in the readout red over a two-or-three character unit label,
 * with a tiny annotation between them. One block per waveform panel.
 */
export const ReadoutBlock: React.FC<{ state: FrameState; index: number }> = ({
  state,
  index,
}) => {
  const { ctx, cfg, frame, instability } = state;
  const p = cfg.palette;
  const b = cfg.readout;
  const rect = READOUT_BLOCKS[index];

  // The step schedule is seeded and rebuilt only if the variant changes.
  const steps = useMemo(
    () =>
      buildSteps(`ro-${index}`, (t) => [
        b.updateGapStart[0] + (b.updateGapEnd[0] - b.updateGapStart[0]) * t,
        b.updateGapStart[1] + (b.updateGapEnd[1] - b.updateGapStart[1]) * t,
      ]),
    [b, index],
  );

  const { index: step, since } = stepAt(steps, frame);
  const [lo, hi] = b.bands[index];
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2;

  let value: number;
  if (b.mode === "normal") {
    // Drift inside a narrow band. Periodic in the step count, so the value at
    // step 0 is the value the loop returns to.
    const phase = (step / steps.length) * Math.PI * 2;
    value = mid + half * (0.62 * Math.sin(phase * 3) + 0.38 * rndSigned(`ro-v-${index}-${step}`));
  } else {
    // Climb steadily out of the normal band, with the jitter growing too.
    const t = steps[step] / DURATION_IN_FRAMES;
    const target = interpolate(t, [0, 1], [mid, b.climbTo[index]]);
    value = target + half * (0.5 + t * 1.6) * rndSigned(`ro-v-${index}-${step}`);
  }
  const shown = Math.max(0, Math.round(value));

  const alarm = shown > b.alarmAbove[index];
  const spiked = state.alert?.target === index;
  // Bright for three frames after a step; once past the alarm threshold the
  // readout stops settling and flashes continuously instead.
  const flashing =
    (step > 0 && since < FLASH_FRAMES) || (alarm && frame % 12 < 6) || spiked;
  const level = flashing ? 1 : 0.82;

  resetCtx(ctx);
  const x = rect.x + 34;
  const numY = rect.y + rect.h * 0.36;

  setFont(ctx, { family: SANS, size: FONT.readoutValue, weight: 600 }, 0);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = flashing
    ? withAlpha(cfg.palette.tracePale, 1)
    : withAlpha(p.readoutValue, level);
  const digits = String(spiked ? shown + 9 : shown);
  bloomText(
    ctx,
    () => drawTabular(ctx, digits, x, numY, "left"),
    withAlpha(p.readoutValue, 0.9 * level),
    interpolate(instability, [0, 1], [26, 46]),
  );

  // The tiny "mc/p"-style annotation between number and unit.
  setFont(ctx, { family: SANS, size: FONT.readoutNote, weight: 500 }, 1);
  ctx.fillStyle = withAlpha(p.text, 0.85);
  ctx.fillText(cfg.labels.readoutAnnotation, x, numY + 62);

  // The unit label, in the readout green, set right of and below the number.
  setFont(ctx, { family: SANS, size: FONT.readoutUnit, weight: 500 }, 2);
  const unit = cfg.labels.readoutUnits[index];
  ctx.fillStyle = withAlpha(p.readoutUnit, level);
  bloomText(
    ctx,
    () => ctx.fillText(unit, x + tabularWidth(ctx, 1) * 0.9, numY + 158),
    withAlpha(p.readoutUnit, 0.55 * level),
    18,
  );

  return null;
};
