/**
 * Pure timing signals for the alert takeover.
 *
 * Every value here is a function of the frame alone — Remotion renders
 * frames out of order across threads, so nothing may accumulate state.
 */
import { interpolate } from "remotion";
import { BEATS, type Accent } from "./theme";
import { rngFor } from "./random";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 before the background reacts, 1 once the accent has fully arrived. */
export const alertProgress = (frame: number): number =>
  interpolate(
    frame,
    [BEATS.backgroundPickup, BEATS.backgroundPickup + 24],
    [0, 1],
    CLAMP,
  );

/**
 * How hard one background panel is tinted by the accent on this frame.
 * Roughly 60% of panels participate; those that do flash on a seeded
 * period and then settle to a steady tint through the hold.
 */
export const panelAlert = (
  frame: number,
  key: string,
  accent: Accent,
): number => {
  const progress = alertProgress(frame);
  if (progress <= 0) return 0;

  const rand = rngFor(`alert:${key}`);
  if (rand() > 0.6) return 0;

  const phase = rand();
  const period = 8 + Math.floor(rand() * 12);
  const local = frame - BEATS.backgroundPickup;
  const cycle = (local / period + phase) % 1;
  const flash = cycle < 0.35 ? 1 : 0.2;
  const settle = interpolate(
    frame,
    [BEATS.backgroundPickup, BEATS.hold],
    [1, 0.3],
    CLAMP,
  );

  return progress * accent.intensity * (0.3 + 0.7 * flash * settle);
};

/** Whether a single code line has flipped to the accent colour yet. */
export const lineAlert = (
  frame: number,
  key: string,
  accent: Accent,
): number => {
  const rand = rngFor(`line:${key}`);
  if (rand() > 0.22 * (0.5 + accent.intensity)) return 0;
  const delay = Math.floor(rand() * 46);
  return interpolate(
    frame,
    [BEATS.backgroundPickup + delay, BEATS.backgroundPickup + delay + 4],
    [0, 1],
    CLAMP,
  );
};

/**
 * The alarm wash: a wide soft band that crosses the frame. Breach runs it
 * twice and hard; granted runs one soft pass. Returns the band's centre as
 * a 0..1 position plus its strength, or null when no wash is running.
 */
export const alarmWash = (
  frame: number,
  accent: Accent,
): { position: number; strength: number } | null => {
  const DURATION = 42;
  const GAP = 4;
  for (let i = 0; i < accent.washes; i++) {
    const start = BEATS.backgroundPickup + i * (DURATION + GAP);
    if (frame < start || frame > start + DURATION) continue;
    const t = (frame - start) / DURATION;
    const strength =
      Math.sin(Math.PI * t) * (accent.intensity === 1 ? 1 : 0.55);
    return { position: -0.25 + t * 1.5, strength };
  }
  return null;
};

/** Slow ambient breathing of the accent once the clip is holding. */
export const ambientPulse = (frame: number, accent: Accent): number => {
  const progress = alertProgress(frame);
  if (progress <= 0) return 0;
  const wave = 0.5 + 0.5 * Math.sin((frame - BEATS.backgroundPickup) / 11);
  return progress * accent.intensity * (0.25 + 0.75 * wave);
};
