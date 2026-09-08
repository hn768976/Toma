import { DURATION_IN_FRAMES } from "../constants";
import type { Instrument, PriceModel } from "./instruments";

export const FLASH_FRAMES = 4;

export type Quote = {
  /** Percentage change against the row's reference level, bounded to +/-3%. */
  pct: number;
  price: number;
  up: boolean;
  /** 1 on the frame a new value lands, falling to 0 over FLASH_FRAMES. */
  flash: number;
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Pure function of the frame - no state, no accumulation - so Remotion can
 * render frames out of order across threads and still get the same board.
 *
 * Everything the row shows is derived from a single value, `pct`. A price that
 * moved while its percentage sat still is the tell that makes boards like this
 * look fake, so there is only one number here to be inconsistent with.
 */
export const quoteAt = (
  instrument: Instrument,
  model: PriceModel,
  frame: number,
): Quote => {
  const { tickPeriod, tickPhase, bias, waves } = model;
  const ticksPerLoop = DURATION_IN_FRAMES / tickPeriod;

  const local = mod(frame - tickPhase, DURATION_IN_FRAMES);
  const tick = Math.floor(local / tickPeriod);
  const framesSinceTick = local % tickPeriod;

  let pct = bias;
  for (const w of waves) {
    pct += w.amp * Math.sin((Math.PI * 2 * w.cycles * tick) / ticksPerLoop + w.phase);
  }

  const price = instrument.prevClose * (1 + pct / 100);
  const flash =
    framesSinceTick < FLASH_FRAMES ? 1 - framesSinceTick / FLASH_FRAMES : 0;

  return { pct, price, up: pct >= 0, flash };
};

/** Grouped thousands, fixed decimals - laid out in a tabular-figure face. */
export const formatPrice = (value: number, decimals: number): string => {
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, fracPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracPart ? `${grouped}.${fracPart}` : grouped;
};

export const formatPct = (pct: number): string =>
  `${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(2)}%`;
