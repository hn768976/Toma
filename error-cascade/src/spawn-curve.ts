/**
 * The spawn curve, expressed as data in config.ts and resolved here.
 *
 * `spawnsAtFrame` is the curve the brief asks for: a pure function of the
 * frame number returning how many dialogs appear on that frame. Reshaping a
 * variant means editing its segment list — the spawn logic never changes.
 *
 * Counts come from integer-differencing a continuous cumulative function, so a
 * segment emits exactly its stated total and fractional rates (one every 20
 * frames) fall out for free.
 */

import type { SpawnSegment } from "./config";

/** Dialogs emitted by one segment, at frame offset `d` from its start. */
const cumulativeInSegment = (seg: SpawnSegment, d: number): number => {
  const len = seg.to - seg.from;
  if (len <= 0) {
    return 0;
  }
  const t = Math.max(0, Math.min(len, d));
  if (seg.rateStart !== undefined && seg.rateEnd !== undefined) {
    // Integral of a linear rate ramp.
    return seg.rateStart * t + ((seg.rateEnd - seg.rateStart) * t * t) / (2 * len);
  }
  return ((seg.total ?? 0) * t) / len;
};

/** Per-frame integer counts for one segment, indexed by frame offset. */
const segmentCounts = (seg: SpawnSegment): number[] => {
  const len = seg.to - seg.from;
  const counts: number[] = [];
  let previous = 0;
  for (let d = 0; d < len; d++) {
    const next = Math.floor(cumulativeInSegment(seg, d + 1));
    counts.push(next - previous);
    previous = next;
  }
  return counts;
};

/** The spawn curve: how many dialogs appear on this exact frame. */
export const spawnsAtFrame = (segments: SpawnSegment[], frame: number): number => {
  for (const seg of segments) {
    if (frame >= seg.from && frame < seg.to) {
      return segmentCounts(seg)[frame - seg.from] ?? 0;
    }
  }
  return 0;
};

export interface ScheduledDialog {
  spawnFrame: number;
  /** Cluster this dialog belongs to. Only the "clustered" layout reads it. */
  group: number;
}

/**
 * Flatten the curve into one entry per dialog, in spawn order. Index in this
 * array is both the stacking order and the seed index, so the pile always
 * builds in the same order.
 */
export const buildSchedule = (segments: SpawnSegment[]): ScheduledDialog[] => {
  const schedule: ScheduledDialog[] = [];
  let groupCursor = 0;

  for (const seg of segments) {
    const counts = segmentCounts(seg);
    const emitted = counts.reduce((a, b) => a + b, 0);
    if (emitted === 0) {
      continue;
    }
    const clusters = Math.max(1, seg.clusters ?? 1);
    let seen = 0;
    for (let d = 0; d < counts.length; d++) {
      for (let k = 0; k < counts[d]; k++) {
        // Split the segment's dialogs into contiguous cluster chunks.
        const chunk = Math.min(clusters - 1, Math.floor((seen / emitted) * clusters));
        schedule.push({ spawnFrame: seg.from + d, group: groupCursor + chunk });
        seen++;
      }
    }
    groupCursor += clusters;
  }

  return schedule;
};

/** Total groups a segment list produces, so cluster spread can be normalised. */
export const groupCount = (segments: SpawnSegment[]): number =>
  segments.reduce(
    (acc, seg) =>
      segmentCounts(seg).some((c) => c > 0) ? acc + Math.max(1, seg.clusters ?? 1) : acc,
    0,
  );
