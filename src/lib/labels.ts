import {DURATION} from './theme';
import {clamp, rnd, rndRange} from './rand';
import {CACHE_FONT} from './text';
import {VariantConfig} from './variants';

/**
 * The floating price labels.
 *
 * Labels live in the *tilted* frame: `u` runs along the tilt (up-to-the-right
 * on screen), `v` across it. They scroll toward -u at `z x baseSpeed`, so near
 * labels sweep past and distant ones barely shift.
 *
 * Looping: every label travels a whole number of SPAN-wide wrap cycles in 840
 * frames. Its speed is quantised to `cycles * SPAN / 840` (cycles derived from
 * z), so at frame 840 every label is exactly where it was at frame 0 — same u,
 * same wrap slot, same respawn position, same value.
 */
export const SPAN = 2600; // wrap distance along u — comfortably wider than the tilted frame
export const V_HALF = 760; // half the cross-axis spread; larger than the visible 668 so labels crop
export const MAX_CYCLES = 9; // wrap cycles per loop for the nearest plane
export const MAX_SIZE = 64; // font px at z = 1 before per-label jitter

export type LabelDef = {
  id: number;
  z: number;
  cycles: number;
  /** px per frame along -u */
  speed: number;
  baseU: number;
  sizePx: number;
  alpha: number;
  /** softness in canonical CACHE_FONT units, quantised so tiles are shared */
  blurTile: number;
  white: boolean;
  /** so distant it reads as a blurred dash, not a number */
  isDash: boolean;
  dashLen: number;
  /** values this label cycles through as it respawns */
  values: string[];
  /**
   * When set, the value is chosen by where the label sits in the loop rather
   * than by wrap count, so its numbers step downward as the loop plays out.
   */
  byPhase: boolean;
};

/** ~200 to ~35000 — the range the reference footage lives in. */
const priceValue = (seed: string): number => {
  const m = rnd(`${seed}-mag`);
  return m < 0.24
    ? rndRange(`${seed}-v`, 200, 999)
    : m < 0.72
      ? rndRange(`${seed}-v`, 1000, 9999)
      : rndRange(`${seed}-v`, 10000, 35000);
};

/** Two decimals, always. */
const priceString = (seed: string): string => priceValue(seed).toFixed(2);

export const LABEL_COUNT = 44; // ~30 of these are inside the frame at any time

export const buildLabels = (cfg: VariantConfig): LabelDef[] => {
  const out: LabelDef[] = [];
  for (let id = 0; id < LABEL_COUNT; id++) {
    // Skewed toward the far plane so only a handful are huge.
    const z = 0.2 + 0.8 * Math.pow(rnd(`z-${id}`), 1.35);
    const cycles = clamp(Math.round(z * MAX_CYCLES), 1, MAX_CYCLES);
    const speed = (cycles * SPAN) / DURATION;
    const sizePx = clamp(z * MAX_SIZE * rndRange(`sj-${id}`, 0.9, 1.55), 9, 112);
    const alpha = clamp(
      (0.3 + (0.7 * (z - 0.2)) / 0.8) * rndRange(`aj-${id}`, 0.82, 1.08),
      0.22,
      1,
    );
    const white = z > 0.46 ? rnd(`w-${id}`) > 0.16 : rnd(`w-${id}`) < 0.26;
    const isDash = z < 0.32 && rnd(`dash-${id}`) < 0.45;
    // Near labels are slightly soft; far ones stay sharp. Expressed in the
    // tile's own units and quantised to half-pixels so labels of similar depth
    // share one cached tile.
    const blurPx = z > 0.62 ? (z - 0.62) * 4.2 : 0;
    const blurTile = Math.round(((blurPx * CACHE_FONT) / sizePx) * 2) / 2;

    // A share of labels reroll their value when they respawn. With ~8 respawns
    // a second across the field that lands at a few value changes per second.
    const rerolls = rnd(`rr-${id}`) < cfg.rerollChance;
    // When the variant declines, a rerolling label walks a descending triple
    // instead of three unrelated numbers, and picks by loop phase rather than
    // wrap count — so the field as a whole reads lower at the end of the loop
    // than at the start. Three values per label, so the tile cache does not
    // grow.
    const declines = cfg.labelDecline > 0;
    let values: string[];
    if (rerolls && declines) {
      const base = priceValue(`p-${id}-0`);
      values = [0, 1, 2].map((k) =>
        (
          base *
          (1 - cfg.labelDecline * (k / 2)) *
          rndRange(`pd-${id}-${k}`, 0.94, 1.06)
        ).toFixed(2),
      );
    } else if (rerolls) {
      values = [0, 1, 2].map((k) => priceString(`p-${id}-${k}`));
    } else {
      values = [priceString(`p-${id}-0`)];
    }

    out.push({
      id,
      z,
      cycles,
      speed,
      baseU: rnd(`u-${id}`) * SPAN,
      sizePx,
      alpha,
      blurTile,
      white,
      isDash,
      dashLen: rndRange(`dl-${id}`, 12, 34),
      values,
      byPhase: declines && values.length > 1,
    });
  }
  return out;
};

export type LabelState = {
  u: number;
  v: number;
  text: string;
};

/**
 * Where a label is on a given frame, and what it currently reads.
 * `wrapIndex mod cycles` is what makes the respawn position and the value
 * close the loop: after 840 frames wrapIndex has moved by exactly `cycles`.
 */
export const labelStateAt = (L: LabelDef, frame: number): LabelState => {
  const raw = L.baseU - frame * L.speed;
  const wrapIndex = Math.floor(raw / SPAN);
  const u = raw - wrapIndex * SPAN - SPAN / 2;
  const slot = ((wrapIndex % L.cycles) + L.cycles) % L.cycles;
  const v = (rnd(`lv-${L.id}-${slot}`) * 2 - 1) * V_HALF;

  // Every label's speed is proportional to its cycle count, so -wrapIndex/cycles
  // tracks frame/840 for all of them: this is the label's position in the loop,
  // quantised to its own respawn cadence. It closes because wrapIndex moves by
  // exactly `cycles` over 840 frames.
  let idx: number;
  if (L.byPhase) {
    const phaseSlot = (((-wrapIndex) % L.cycles) + L.cycles) % L.cycles;
    const phase = phaseSlot / L.cycles;
    idx = Math.min(L.values.length - 1, Math.floor(phase * L.values.length));
  } else {
    idx = slot % L.values.length;
  }
  return {u, v, text: L.values[idx]};
};

/** Out-of-focus labels that have already passed the camera. */
export type BokehDef = {
  id: number;
  radius: number;
  alpha: number;
  cycles: number;
  speed: number;
  baseU: number;
};

export const BOKEH_COUNT = 12;

export const buildBokeh = (): BokehDef[] => {
  const out: BokehDef[] = [];
  for (let id = 0; id < BOKEH_COUNT; id++) {
    const z = rndRange(`bz-${id}`, 0.72, 1.0);
    const cycles = clamp(Math.round(z * MAX_CYCLES), 1, MAX_CYCLES);
    out.push({
      id,
      radius: rndRange(`br-${id}`, 42, 150),
      alpha: rndRange(`ba-${id}`, 0.03, 0.085),
      cycles,
      speed: (cycles * SPAN) / DURATION,
      baseU: rnd(`bu-${id}`) * SPAN,
    });
  }
  return out;
};

export const bokehStateAt = (B: BokehDef, frame: number): {u: number; v: number} => {
  const raw = B.baseU - frame * B.speed;
  const wrapIndex = Math.floor(raw / SPAN);
  const u = raw - wrapIndex * SPAN - SPAN / 2;
  const slot = ((wrapIndex % B.cycles) + B.cycles) % B.cycles;
  return {u, v: (rnd(`bv-${B.id}-${slot}`) * 2 - 1) * V_HALF};
};

