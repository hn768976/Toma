import { random } from "remotion";
import type { FlickerConfig, GlitchConfig, MarkSpec } from "./types";

/**
 * A mark's base opacity at a frame. Fades are fast and the hold is long:
 * everything here is a pure function of the frame number.
 */
export const markOpacity = (spec: MarkSpec, frame: number): number => {
  if (frame < spec.in) return 0;
  const rising = Math.min(1, (frame - spec.in) / spec.inDur);
  if (frame < spec.out) return rising;
  const falling = 1 - (frame - spec.out) / spec.outDur;
  return Math.max(0, Math.min(rising, falling));
};

/**
 * Seeded, irregular drop to a lower opacity for a couple of frames.
 * Each mark gets at most one event per second; the schedule is derived from
 * the frame number alone, so scrubbing backwards reproduces it exactly.
 */
export const flickerFactor = (
  id: string,
  frame: number,
  fps: number,
  cfg: FlickerConfig | null,
): number => {
  if (!cfg) return 1;
  const bucket = Math.floor(frame / fps);
  for (let s = bucket - 1; s <= bucket; s++) {
    if (s < 0) continue;
    if (random(`flicker:${id}:${s}`) >= cfg.chance) continue;
    const span = cfg.maxDur - cfg.minDur + 1;
    const dur = cfg.minDur + Math.floor(random(`flickerDur:${id}:${s}`) * span);
    const start =
      s * fps + Math.floor(random(`flickerAt:${id}:${s}`) * (fps - dur));
    if (frame >= start && frame < start + dur) return cfg.level;
  }
  return 1;
};

export type GlitchSlice = { y: number; h: number; dx: number };
export type GlitchEvent = { start: number; dur: number; slices: GlitchSlice[] };

/**
 * The whole glitch schedule for one 300-frame run, built once. Events land
 * every 45-90 frames and each one's slices are clustered around a single
 * band, so the tearing reads as a burst rather than as even noise.
 */
export const buildGlitchSchedule = (
  seed: string,
  durationInFrames: number,
  frameHeight: number,
  cfg: GlitchConfig | null,
): GlitchEvent[] => {
  if (!cfg) return [];
  const events: GlitchEvent[] = [];
  let f = cfg.minGap * 0.6 + random(`${seed}:g:first`) * cfg.minGap * 0.5;
  let i = 0;
  while (f < durationInFrames) {
    const dur =
      cfg.minDur +
      Math.floor(random(`${seed}:g:dur:${i}`) * (cfg.maxDur - cfg.minDur + 1));
    const n =
      cfg.minSlices +
      Math.floor(
        random(`${seed}:g:n:${i}`) * (cfg.maxSlices - cfg.minSlices + 1),
      );
    const band = random(`${seed}:g:band:${i}`) * frameHeight;
    const slices: GlitchSlice[] = [];
    for (let k = 0; k < n; k++) {
      const y =
        band + (random(`${seed}:g:y:${i}:${k}`) - 0.5) * cfg.cluster;
      const h =
        cfg.minSliceH +
        random(`${seed}:g:h:${i}:${k}`) * (cfg.maxSliceH - cfg.minSliceH);
      const mag =
        cfg.minShift +
        random(`${seed}:g:s:${i}:${k}`) * (cfg.maxShift - cfg.minShift);
      const dx = random(`${seed}:g:d:${i}:${k}`) < 0.5 ? -mag : mag;
      slices.push({ y: Math.round(y), h: Math.round(h), dx: Math.round(dx) });
    }
    events.push({ start: Math.round(f), dur, slices });
    f +=
      cfg.minGap + random(`${seed}:g:gap:${i}`) * (cfg.maxGap - cfg.minGap);
    i++;
  }
  return events;
};

export const activeGlitch = (
  events: GlitchEvent[],
  frame: number,
): GlitchEvent | null => {
  for (const e of events) {
    if (frame >= e.start && frame < e.start + e.dur) return e;
  }
  return null;
};
