import {BURST_TYPES} from './physics';
import {pickWeighted, pickWeightedIndex, randBool, randInt, randRange} from './rng';
import {DURATION_IN_FRAMES, HEIGHT, WIDTH} from './variants';
import type {BurstTypeName, VariantConfig, VariantName, Weighted} from './variants';
import {VARIANTS} from './variants';

export type ShellLaunch = {
  /** Frame the shell leaves the bottom of the frame. */
  readonly start: number;
  readonly duration: number;
  readonly fromX: number;
  readonly fromY: number;
};

export type Burst = {
  readonly id: string;
  /** Frame the shell breaks. */
  readonly start: number;
  readonly type: BurstTypeName;
  readonly x: number;
  readonly y: number;
  /** Size multiplier — secondary breaks are small. */
  readonly scale: number;
  readonly lifeScale: number;
  /** Drift inherited from a parent particle, for multi-break shells. */
  readonly vx: number;
  readonly vy: number;
  readonly brightness: number;
  readonly colorIndex: number;
  readonly altColorIndex: number;
  /** Fraction of particles taking the alternate colour. */
  readonly altRate: number;
  /** Frames from the break until the burst is completely out. */
  readonly maxLife: number;
  readonly launch: ShellLaunch | null;
};

/** Frames of slack kept between the last ember dying and the loop point. */
const LOOP_MARGIN = 2;

const maxLifeOf = (type: BurstTypeName, lifeScale: number): number =>
  Math.ceil(BURST_TYPES[type].life[1] * lifeScale) + 1;

const scheduleCache = new Map<VariantName, Burst[]>();

export const getSchedule = (name: VariantName): Burst[] => {
  const cached = scheduleCache.get(name);
  if (cached) {
    return cached;
  }
  const built = buildSchedule(name, VARIANTS[name]);
  scheduleCache.set(name, built);
  return built;
};

const makeBurst = (
  name: VariantName,
  variant: VariantConfig,
  index: number,
  start: number,
): Burst | null => {
  const seed = name + ':burst' + index;

  // Pick a type that still has room to burn out before the loop closes. Late
  // in the loop only the short-lived types fit, which keeps the tail busy
  // without letting anything straddle frame 0.
  const shortestFirst = [...variant.types].sort(
    (a, b) => BURST_TYPES[a.value].life[1] - BURST_TYPES[b.value].life[1],
  );
  const room = DURATION_IN_FRAMES - LOOP_MARGIN - start;
  const affordable: Weighted<BurstTypeName>[] = shortestFirst.filter(
    (t) => maxLifeOf(t.value, 1) <= room,
  );

  let type: BurstTypeName;
  let lifeScale: number;
  if (affordable.length > 0) {
    type = pickWeighted(seed + ':type', affordable);
    lifeScale = 1;
  } else {
    // Right at the end of the loop, keep the sky busy with a small, quick
    // shell whose life is shortened just enough to burn out in time.
    type = shortestFirst[0].value;
    lifeScale = room / maxLifeOf(type, 1);
    if (lifeScale < 0.5) {
      return null;
    }
  }
  // Never let a burst's embers reach the loop point.
  const maxLife = Math.min(maxLifeOf(type, lifeScale), room);

  const {placement} = variant;
  const xMid = (placement.xRange[0] + placement.xRange[1]) / 2;
  const xHalf = (placement.xRange[1] - placement.xRange[0]) / 2;
  const uniformX = randRange(seed + ':x', -1, 1);
  const centredX =
    randRange(seed + ':xa', -1, 1) * 0.5 + randRange(seed + ':xb', -1, 1) * 0.5;
  const fx = uniformX + (centredX - uniformX) * placement.clustering;
  const x = (xMid + fx * xHalf) * WIDTH;
  const y =
    randRange(seed + ':y', placement.yRange[0], placement.yRange[1]) * HEIGHT;

  const colorIndex = pickWeightedIndex(seed + ':col', variant.palette.burst);
  const altColorIndex = pickWeightedIndex(
    seed + ':col2',
    variant.palette.burst,
  );

  const launchDuration = Math.round(randRange(seed + ':ld', 26, 38));
  const wantsLaunch = randBool(seed + ':launch', variant.shellLaunchChance);
  const launch: ShellLaunch | null =
    wantsLaunch && start - launchDuration >= 0
      ? {
          start: start - launchDuration,
          duration: launchDuration,
          fromX: x + randRange(seed + ':lx', -0.03, 0.03) * WIDTH,
          fromY: HEIGHT + 80,
        }
      : null;

  return {
    id: seed,
    start,
    type,
    x,
    y,
    scale: randRange(seed + ':sc', 0.85, 1.15) * (0.6 + 0.4 * lifeScale),
    lifeScale,
    vx: 0,
    vy: 0,
    brightness: variant.brightness * randRange(seed + ':b', 0.9, 1.1),
    colorIndex,
    altColorIndex,
    altRate: randRange(seed + ':ar', 0, 0.3),
    maxLife,
    launch,
  };
};

const buildSchedule = (name: VariantName, variant: VariantConfig): Burst[] => {
  const bursts: Burst[] = [];
  const {rate} = variant;
  let cursor = 0;
  let index = 0;

  while (cursor < DURATION_IN_FRAMES - LOOP_MARGIN) {
    if (rate.mode === 'clustered') {
      const size = randInt(
        name + ':cluster' + index,
        rate.clusterSize[0],
        rate.clusterSize[1],
      );
      for (let k = 0; k < size && cursor < DURATION_IN_FRAMES; k++) {
        const burst = makeBurst(name, variant, index, Math.round(cursor));
        if (burst) {
          bursts.push(burst);
        }
        index++;
        cursor += randRange(name + ':step' + index, rate.step[0], rate.step[1]);
      }
      cursor += randRange(name + ':gap' + index, rate.gap[0], rate.gap[1]);
    } else {
      const burst = makeBurst(name, variant, index, Math.round(cursor));
      if (burst) {
        bursts.push(burst);
      }
      index++;
      cursor += randRange(name + ':step' + index, rate.step[0], rate.step[1]);
    }
  }

  return bursts;
};
