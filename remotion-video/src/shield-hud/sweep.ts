import { random } from "remotion";
import { DURATION_IN_FRAMES } from "./constants";
import type { GlyphGeometry } from "./paths";
import type { Variant } from "./variants";

export type SweepSample = {
  /** Distance of the head along the nominal outline, in [0, outlineLength). */
  head: number;
  /** True while the head is stalled inside one of the fractured gaps. */
  inGap: boolean;
  /** Brightness multiplier for the head — flickers while it is in a gap. */
  flicker: number;
};

/** The trail decays from full brightness to a dim ember over 40% of the path. */
export const TRAIL_FRACTION = 0.4;

export type Sweep = {
  sample: (frame: number) => SweepSample;
};

const smoothSweep = (outlineLength: number, circuits: number): Sweep => ({
  sample: (frame) => {
    const t = (frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES;
    return {
      head: (t * circuits * outlineLength) % outlineLength,
      inGap: false,
      flicker: 1,
    };
  },
});

const inAnyGap = (gaps: GlyphGeometry["gaps"], at: number, length: number) =>
  gaps.some(({ start, end }) => {
    const span = (end - start + length) % length;
    const rel = (at - start + length) % length;
    return rel <= span;
  });

/**
 * The breach sweep: the head lurches. Runs of 4-8 frames at speed, stalls of
 * 3-6, the odd abrupt jump and short reversal, and a 5-10 frame stall
 * whenever it meets a gap in the broken outline.
 *
 * The whole schedule is built once from frame indices 0..329 and then scaled
 * so the displacement over the loop is exactly `circuits` circuits — the
 * motion is irregular but the loop still closes.
 */
const stutterSweep = (
  outlineLength: number,
  circuits: number,
  gaps: GlyphGeometry["gaps"],
  seed: string,
): Sweep => {
  const target = circuits * outlineLength;

  // 1. A jerky velocity profile, in arbitrary units.
  const velocity = new Array<number>(DURATION_IN_FRAMES).fill(0);
  let f = 0;
  let phase = 0;
  while (f < DURATION_IN_FRAMES) {
    const roll = random(`${seed}-phase-${phase}`);
    if (phase % 2 === 0) {
      // Run: fast for 4-8 frames.
      const len = 4 + Math.floor(random(`${seed}-run-${phase}`) * 5);
      const speed = 1.4 + roll * 1.5;
      for (let i = 0; i < len && f < DURATION_IN_FRAMES; i++, f++) velocity[f] = speed;
    } else if (roll < 0.18) {
      // Abrupt jump ahead in a single frame.
      velocity[f] = 9 + roll * 20;
      f += 1;
    } else if (roll < 0.32) {
      // A short reversal.
      const len = 2 + Math.floor(random(`${seed}-rev-${phase}`) * 2);
      for (let i = 0; i < len && f < DURATION_IN_FRAMES; i++, f++) velocity[f] = -0.9;
    } else {
      // Stall for 3-6 frames.
      const len = 3 + Math.floor(random(`${seed}-stall-${phase}`) * 4);
      for (let i = 0; i < len && f < DURATION_IN_FRAMES; i++, f++) velocity[f] = 0.02;
    }
    phase++;
  }

  const gapStall = new Array<boolean>(DURATION_IN_FRAMES).fill(false);

  const positionsFrom = (v: number[]) => {
    const sum = v.reduce((a, b) => a + b, 0);
    const scale = sum === 0 ? 0 : target / sum;
    const pos = new Array<number>(DURATION_IN_FRAMES + 1);
    pos[0] = 0;
    for (let i = 0; i < DURATION_IN_FRAMES; i++) pos[i + 1] = pos[i] + v[i] * scale;
    return pos;
  };

  // 2. Park the head at each gap it reaches, then rescale so the total
  //    displacement is unchanged. Two passes settle the schedule.
  let positions = positionsFrom(velocity);
  if (gaps.length > 0) {
    for (let pass = 0; pass < 2; pass++) {
      let i = 0;
      while (i < DURATION_IN_FRAMES) {
        const here = ((positions[i] % outlineLength) + outlineLength) % outlineLength;
        if (!gapStall[i] && inAnyGap(gaps, here, outlineLength)) {
          const len = 5 + Math.floor(random(`${seed}-gapstall-${pass}-${i}`) * 6);
          for (let k = 0; k < len && i + k < DURATION_IN_FRAMES; k++) {
            velocity[i + k] = 0;
            gapStall[i + k] = true;
          }
          i += len;
          continue;
        }
        i++;
      }
      positions = positionsFrom(velocity);
    }
  }

  return {
    sample: (frame) => {
      const f = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
      const head = ((positions[f] % outlineLength) + outlineLength) % outlineLength;
      const stalled = gapStall[f];
      return {
        head,
        inGap: stalled,
        flicker: stalled ? 0.25 + 0.75 * random(`${seed}-flick-${f}`) : 1,
      };
    },
  };
};

export const buildSweep = (variant: Variant, geometry: GlyphGeometry, seed: string): Sweep =>
  variant.sweep.mode === "smooth"
    ? smoothSweep(geometry.outlineLength, variant.sweep.circuits)
    : stutterSweep(geometry.outlineLength, variant.sweep.circuits, geometry.gaps, seed);
