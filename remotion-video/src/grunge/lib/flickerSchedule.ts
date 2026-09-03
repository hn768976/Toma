/**
 * Builds a loop-safe schedule of appear/disappear events for layers whose
 * elements flicker in and out — scratches, hairs, splice marks.
 *
 * Two properties matter and neither comes free from "pick a random start
 * frame for N events":
 *
 *  1. No event may straddle the loop point. Every event satisfies
 *     start + life <= duration, so the schedule is a pure function of
 *     frame % duration and frame `duration` is identical to frame 0.
 *
 *  2. The number of simultaneously visible events must stay inside
 *     [minConcurrent, maxConcurrent]. The ceiling comes from construction:
 *     events are tiled into exactly `maxConcurrent` channels, and within a
 *     channel they never overlap. The floor comes from a second pass that
 *     fills any frame still below the minimum, clipping the filler event so
 *     it cannot push a later frame over the ceiling.
 */
import { rndInt } from "./rng";

export type FlickerEvent = {
  /** Stable identity, used as the seed prefix for the event's own geometry. */
  id: string;
  start: number;
  life: number;
};

export type FlickerScheduleOptions = {
  seed: string;
  duration: number;
  minConcurrent: number;
  maxConcurrent: number;
  minLife: number;
  maxLife: number;
  minGap: number;
  maxGap: number;
};

export const scheduleFlickerEvents = (
  options: FlickerScheduleOptions,
): FlickerEvent[] => {
  const { seed, duration, minConcurrent, maxConcurrent, minLife, maxLife, minGap, maxGap } =
    options;

  const events: FlickerEvent[] = [];
  const concurrency = new Int32Array(duration);

  const addEvent = (id: string, start: number, life: number) => {
    events.push({ id, start, life });
    for (let f = start; f < start + life; f++) concurrency[f]++;
  };

  // Pass 1 — tile each channel with alternating gaps and events.
  for (let channel = 0; channel < maxConcurrent; channel++) {
    const channelSeed = seed + "|ch" + channel;
    // Stagger channel starts so they do not all begin together at frame 0.
    let cursor = rndInt(channelSeed + "|offset", 0, maxGap);
    let index = 0;
    while (cursor < duration) {
      const life = rndInt(channelSeed + "|life" + index, minLife, maxLife);
      if (cursor + life > duration) break;
      addEvent(channelSeed + "|e" + index, cursor, life);
      cursor += life + rndInt(channelSeed + "|gap" + index, minGap, maxGap);
      index++;
    }
  }

  // Pass 2 — raise any frame that is still below the floor. The filler's life
  // is clipped to the run of frames that are below the ceiling, so it can
  // never overshoot.
  let fillIndex = 0;
  for (let f = 0; f < duration; f++) {
    while (concurrency[f] < minConcurrent) {
      let life = 0;
      while (
        f + life < duration &&
        life < maxLife &&
        concurrency[f + life] < maxConcurrent
      ) {
        life++;
      }
      if (life === 0) break; // ceiling already reached; nothing more we can do
      addEvent(seed + "|fill" + fillIndex, f, life);
      fillIndex++;
    }
  }

  return events;
};

/**
 * Fade envelope for an event: ramps in and out over `ramp` frames so an
 * element does not pop to full brightness on a single frame.
 */
export const flickerEnvelope = (
  frame: number,
  event: FlickerEvent,
  ramp: number,
): number => {
  const since = frame - event.start;
  const until = event.start + event.life - frame;
  if (since < 0 || until <= 0) return 0;
  if (ramp <= 0) return 1;
  return Math.max(0, Math.min(1, Math.min((since + 1) / ramp, until / ramp)));
};

/** Events visible at `frame`. Callers pass frame % duration. */
export const activeEvents = (events: FlickerEvent[], frame: number): FlickerEvent[] => {
  const out: FlickerEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (frame >= e.start && frame < e.start + e.life) out.push(e);
  }
  return out;
};
