import { mulberry32 } from "../lib/random";

/**
 * Tracking-line events inside one 600-frame (20s) period: one every 2-4s.
 * Each either rolls down part of the frame or holds still for a few frames.
 */
export type TrackingEvent = {
  start: number;
  length: number;
  y0: number; // 0..1 from top
  y1: number;
  strength: number;
};

const rand = mulberry32(0x7ac1);
export const TRACKING_EVENTS: TrackingEvent[] = (() => {
  const out: TrackingEvent[] = [];
  let t = 18 + Math.floor(rand() * 20);
  while (t < 580) {
    const hold = rand() < 0.4;
    const length = hold ? 4 + Math.floor(rand() * 6) : 10 + Math.floor(rand() * 16);
    const y0 = 0.05 + rand() * 0.5;
    const y1 = hold ? y0 : y0 + 0.12 + rand() * 0.35;
    if (t + length >= 598) break;
    out.push({ start: t, length, y0, y1, strength: 0.55 + rand() * 0.45 });
    t += length + 50 + Math.floor(rand() * 40);
  }
  return out;
})();

/** [y (0..1), strength] of the active tracking line at a frame (period 600). */
export const trackingAt = (frame: number): [number, number] => {
  const f = ((frame % 600) + 600) % 600;
  for (const e of TRACKING_EVENTS) {
    if (f >= e.start && f < e.start + e.length) {
      const p = (f - e.start) / Math.max(1, e.length - 1);
      return [e.y0 + (e.y1 - e.y0) * p, e.strength];
    }
  }
  return [-1, 0];
};
