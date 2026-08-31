import {getBurstParticles, positionAt, velocityAt} from './particles';
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

/** Golden ratio conjugate, used to spread burst positions across the band. */
const GOLDEN = 0.618033988749895;

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
  // Successive bursts step across the band by the golden ratio, so the whole
  // band gets used instead of the run clumping wherever the seed happens to
  // land. Some of them are then pulled in towards the middle of the band,
  // which is what gives the weighting without emptying the edges.
  const stride = (index * GOLDEN + randRange(name + ':xoff', 0, 1)) % 1;
  let fx = stride * 2 - 1;
  if (randBool(seed + ':pull', placement.clustering)) {
    fx *= randRange(seed + ':pullAmount', 0.15, 0.6);
  }
  const x = (xMid + fx * xHalf) * WIDTH;
  const y =
    randRange(seed + ':y', placement.yRange[0], placement.yRange[1]) * HEIGHT;

  const colorIndex = pickWeightedIndex(seed + ':col', variant.palette.burst);
  const altColorIndex = pickWeightedIndex(
    seed + ':col2',
    variant.palette.burst,
  );

  // A shell that would have to start before frame 0 climbs faster instead of
  // being dropped, so the loop opens with rising shells like any other moment.
  const launchDuration = Math.min(
    Math.round(randRange(seed + ':ld', 26, 38)),
    start,
  );
  const wantsLaunch = randBool(seed + ':launch', variant.shellLaunchChance);
  const launch: ShellLaunch | null =
    wantsLaunch && launchDuration >= 12
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

/**
 * A multi-break shell: a few of the primary burst's own particles detonate
 * again a beat later, carrying the drift they had at that moment. Nothing else
 * in the piece behaves like this — it is what makes the finale read as a
 * finale rather than as more of the same.
 */
const makeSecondaryBursts = (
  parent: Burst,
  variant: VariantConfig,
): Burst[] => {
  const {multiBreak} = variant;
  if (multiBreak.chance <= 0 || !randBool(parent.id + ':mb', multiBreak.chance)) {
    return [];
  }
  const particles = getBurstParticles(parent, variant);
  const count = randInt(
    parent.id + ':mbn',
    multiBreak.children[0],
    multiBreak.children[1],
  );
  const delay = Math.round(
    randRange(parent.id + ':mbd', multiBreak.delay[0], multiBreak.delay[1]),
  );
  const start = parent.start + delay;
  const room = DURATION_IN_FRAMES - LOOP_MARGIN - start;
  const type: BurstTypeName = 'crackle';
  if (maxLifeOf(type, 1) > room) {
    return [];
  }

  const children: Burst[] = [];
  for (let i = 0; i < count; i++) {
    const seed = parent.id + ':mb' + i;
    const p = particles[randInt(seed + ':i', 0, particles.length - 1)];
    const {x, y} = positionAt(parent, p, delay);
    const v = velocityAt(p, delay);
    children.push({
      id: seed,
      start,
      type,
      x,
      y,
      scale: parent.scale * multiBreak.scale,
      lifeScale: 1,
      // The secondary keeps the momentum of the particle it came from.
      vx: v.vx * 0.8,
      vy: v.vy * 0.8,
      brightness: parent.brightness * 1.15,
      colorIndex: pickWeightedIndex(seed + ':col', variant.palette.burst),
      altColorIndex: parent.colorIndex,
      altRate: randRange(seed + ':ar', 0.1, 0.35),
      maxLife: Math.min(maxLifeOf(type, 1), room),
      launch: null,
    });
  }
  return children;
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

  const secondaries = bursts.flatMap((b: Burst) =>
    makeSecondaryBursts(b, variant),
  );
  return [...bursts, ...secondaries].sort((a, b) => a.start - b.start);
};
