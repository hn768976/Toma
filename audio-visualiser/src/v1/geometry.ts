import {makeHslRamp} from '../shared/color';
import {mulberry32} from '../spectrum/random';

/** Bars around the ring. More than there are bands, so the ring reads as fine. */
export const BAR_COUNT = 168;

/** Dots in the outer ring. */
export const DOT_COUNT = 132;

/** Turns of the bar ring over the 300-frame loop. Integer, so the loop closes. */
export const RING_TURNS = 1;

/** Turns of the dotted ring. Negative: it counter-rotates. */
export const DOT_TURNS = -1;

/**
 * Magenta at the top, through violet and blue down the sides, to cyan at the
 * bottom. Interpolated in HSL — see makeHslRamp.
 */
export const ringRamp = makeHslRamp(['#e026c0', '#7a3ce8', '#2a6fe8', '#22d3ee']);

/**
 * The handful of bars drawn as long thin spikes. Scattered by seed rather than
 * spaced evenly, so they do not read as a pattern.
 */
export const SPIKE_BARS: {index: number; reach: number; phase: number}[] = (() => {
  const rand = mulberry32(0x1f0e_2c55);
  const picked: {index: number; reach: number; phase: number}[] = [];
  const used = new Set<number>();
  while (picked.length < 5) {
    const index = Math.floor(rand() * BAR_COUNT);
    // Keep spikes off each other's shoulders.
    let tooClose = false;
    for (const u of used) {
      const d = Math.min(Math.abs(u - index), BAR_COUNT - Math.abs(u - index));
      if (d < 13) {
        tooClose = true;
      }
    }
    if (tooClose) {
      continue;
    }
    used.add(index);
    picked.push({index, reach: 0.85 + rand() * 0.75, phase: rand()});
  }
  return picked.sort((a, b) => a.index - b.index);
})();

export const SPIKE_BY_INDEX = new Map(SPIKE_BARS.map((s) => [s.index, s]));

/**
 * A fixed per-bar gain. Neighbouring bars read from almost the same band, so
 * without this the ring's outline comes out as one smooth envelope; real
 * spectrum bins vary from their neighbours and the ring needs that texture.
 */
export const BAR_GAIN: number[] = (() => {
  const rand = mulberry32(0x77c1_04ab);
  return Array.from({length: BAR_COUNT}, () => 0.6 + rand() * 0.62);
})();
