import { random } from "remotion";
import {
  DURATION,
  FRAMES_PER_CANDLE,
  N_CANDLES,
  N_CELLS,
  SERIES_W,
} from "./config";

/**
 * Every function here is a pure function of the frame number with period
 * DURATION, so f(0) === f(DURATION) and the composition loops seamlessly.
 */

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Board px the series has travelled left. Exactly one series width per loop. */
export const scrollPx = (frame: number) =>
  ((frame % DURATION) / DURATION) * SERIES_W;

/** Whole-frame brightness breathe, +/-4% on a period that divides DURATION. */
export const breathe = (frame: number) =>
  1 + 0.04 * Math.sin((2 * Math.PI * (frame % DURATION)) / 500);

/**
 * The newest candle, and how far through its formation it is.
 * `globalIdx` advances by exactly N_CANDLES per loop, so both wrap cleanly.
 */
export const leadCandle = (frame: number) => {
  const globalIdx = (frame % DURATION) / FRAMES_PER_CANDLE;
  const index = Math.floor(globalIdx) % N_CANDLES;
  return { index, phase: globalIdx - Math.floor(globalIdx) };
};

/**
 * Drift applied to the forming candle's close, in units of the candle's own
 * open->close move. It starts as a doji, wobbles (which can flip it green to
 * red and back), and settles onto the true close as the scroll locks it in.
 */
export const formingClose = (
  open: number,
  close: number,
  phase: number,
  index: number,
) => {
  const settle = smoothstep(0, 1, phase);
  const wobbleAmp = (0.55 + random(`wob-amp-${index}`) * 0.85) * (1 - phase);
  const p1 = random(`wob-p1-${index}`) * Math.PI * 2;
  const p2 = random(`wob-p2-${index}`) * Math.PI * 2;
  // Slow enough to read as a price ticking around at 60fps rather than as
  // per-frame noise.
  const wobble =
    Math.sin(phase * Math.PI * 3 + p1) * 0.65 +
    Math.sin(phase * Math.PI * 6 + p2) * 0.35;
  const span = close - open;
  const scale = Math.abs(span) < 1e-6 ? 1 : Math.abs(span);
  return open + span * settle + wobble * wobbleAmp * scale;
};

// ── Ladder flash schedule ──────────────────────────────────────────────────

type Flash = { cell: number; start: number };

/**
 * Pre-rolled flash times. Gaps average ~560 frames per cell across 28 cells,
 * which lands around 3 flashes per second over the whole ladder.
 */
export const buildFlashes = (): Flash[] => {
  const out: Flash[] = [];
  for (let c = 0; c < N_CELLS; c++) {
    let t = random(`flash-off-${c}`) * 560;
    let k = 0;
    while (t < DURATION) {
      out.push({ cell: c, start: t });
      t += 300 + random(`flash-gap-${c}-${k}`) * 520;
      k++;
    }
  }
  return out;
};

/** Flash envelope: snap to full over 2 frames, hold to 3, ease out over 12. */
const envelope = (dt: number) => {
  if (dt < -0.5 || dt > 15) return 0;
  if (dt < 2) return clamp01((dt + 0.5) / 2.5);
  if (dt <= 3) return 1;
  const t = (dt - 3) / 12;
  return (1 - t) * (1 - t);
};

/**
 * Per-cell flash intensity in [0, 1]. Flashes are tested against both this
 * loop and the previous one so a flash started near frame 1000 carries its
 * tail across the seam.
 */
export const flashIntensity = (
  flashes: Flash[],
  cell: number,
  frame: number,
) => {
  const f = frame % DURATION;
  let v = 0;
  for (let i = 0; i < flashes.length; i++) {
    const fl = flashes[i];
    if (fl.cell !== cell) continue;
    v = Math.max(
      v,
      envelope(f - fl.start),
      envelope(f - (fl.start - DURATION)),
    );
  }
  return v;
};
