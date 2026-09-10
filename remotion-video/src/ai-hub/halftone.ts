// The background dot field, generated once at module load.
//
// Dots are bucketed into a handful of shimmer groups; each group is
// emitted as a single path holding every one of its dots as a subpath,
// so the whole ~2.5k-dot field costs six DOM nodes rather than 2,500.
// Only the group opacities change per frame.

import { circlePath } from "./svg-shapes";
import { mulberry32 } from "./random";

export const SHIMMER_GROUPS = 6;

/** Whole shimmer cycles per 300-frame loop, one per group. */
export const SHIMMER_CYCLES = [2, 3, 2, 4, 3, 5];

const SPACING = 0.0235;
const HUB_CLEAR = 0.152; // dots under the hub disc would never be seen

const buildDotGroups = (seed: number, aspect: number): string[] => {
  const rand = mulberry32(seed);
  const halfW = aspect / 2 + SPACING;
  const buckets: string[][] = Array.from({ length: SHIMMER_GROUPS }, () => []);

  for (let x = -halfW; x <= halfW; x += SPACING) {
    for (let y = -0.52; y <= 0.52; y += SPACING) {
      const d = Math.hypot(x, y);
      if (d < HUB_CLEAR) continue;
      // Denser toward the centre: keep ~95% of candidates near the hub
      // falling to ~40% at the corners.
      const keep = 0.95 - 0.55 * Math.min(d / 0.95, 1);
      if (rand() > keep) continue;
      // Centre dots are also fractionally larger, which reinforces the
      // density gradient without needing a second grid.
      const r = 0.0026 - 0.0009 * Math.min(d / 0.95, 1);
      const jx = (rand() - 0.5) * SPACING * 0.18;
      const jy = (rand() - 0.5) * SPACING * 0.18;
      buckets[Math.floor(rand() * SHIMMER_GROUPS) % SHIMMER_GROUPS].push(
        circlePath(x + jx, y + jy, r),
      );
    }
  }
  return buckets.map((b) => b.join(" "));
};

export const DOT_GROUPS = buildDotGroups(77123, 16 / 9);

export type DriftDot = {
  x: number;
  y: number;
  r: number;
  ax: number;
  ay: number;
  cyclesX: number;
  cyclesY: number;
  phase: number;
  opacity: number;
};

// A dozen larger, blurred dots loitering near the frame edges. Their
// drift is two sines with integer cycle counts, so they return exactly
// to their starting point at the end of the loop.
const buildDriftDots = (seed: number, aspect: number): DriftDot[] => {
  const rand = mulberry32(seed);
  const halfW = aspect / 2;
  const dots: DriftDot[] = [];
  for (let i = 0; i < 12; i++) {
    const edge = i % 4;
    const along = rand() * 2 - 1;
    const inset = 0.02 + rand() * 0.12;
    let x = 0;
    let y = 0;
    if (edge === 0) [x, y] = [along * halfW, -0.5 + inset];
    else if (edge === 1) [x, y] = [along * halfW, 0.5 - inset];
    else if (edge === 2) [x, y] = [-halfW + inset, along * 0.5];
    else [x, y] = [halfW - inset, along * 0.5];
    dots.push({
      x,
      y,
      r: 0.008 + rand() * 0.013,
      ax: 0.01 + rand() * 0.022,
      ay: 0.01 + rand() * 0.022,
      cyclesX: 1 + Math.floor(rand() * 2),
      cyclesY: 1 + Math.floor(rand() * 2),
      phase: rand(),
      opacity: 0.1 + rand() * 0.16,
    });
  }
  return dots;
};

export const DRIFT_DOTS = buildDriftDots(4412, 16 / 9);
