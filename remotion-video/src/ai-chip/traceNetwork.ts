/**
 * Procedural PCB routing.
 *
 * Traces are grown as random walks on a grid that are biased to head away from
 * the chip, so the finished board reads as a fan-out from the package the way
 * real escape routing does. Walks run in straight axis-aligned runs, turn at
 * right angles and get their corners chamfered to 45 degrees afterwards, which
 * is the detail that makes a line drawing look like a circuit board.
 */

import type { Rng } from "./rng";

export type Vec2 = { x: number; z: number };

export type Route = {
  /** Chamfered polyline in world XZ coordinates. */
  points: Vec2[];
  /** Cumulative arc length at each point. */
  arcLengths: number[];
  length: number;
  /** Stable per-route random, drives pulse phase, colour and brightness. */
  seed: number;
  /** 0 for routes leaving the chip, higher for branches. */
  depth: number;
  /** Radius the route starts at; used to fade in seeded-in-the-field routes. */
  startRadius: number;
};

const CELL = 0.22;
const DIRECTIONS: readonly Vec2[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

const key = (x: number, z: number) => (x + 4096) * 8192 + (z + 4096);

const chamferCorners = (points: Vec2[], amount: number): Vec2[] => {
  if (points.length < 3) {
    return points;
  }

  const out: Vec2[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];

    const inX = previous.x - corner.x;
    const inZ = previous.z - corner.z;
    const outX = next.x - corner.x;
    const outZ = next.z - corner.z;

    const inLength = Math.sqrt(inX * inX + inZ * inZ);
    const outLength = Math.sqrt(outX * outX + outZ * outZ);
    if (inLength === 0 || outLength === 0) {
      continue;
    }

    const cut = Math.min(amount, inLength * 0.45, outLength * 0.45);
    out.push({
      x: corner.x + (inX / inLength) * cut,
      z: corner.z + (inZ / inLength) * cut,
    });
    out.push({
      x: corner.x + (outX / outLength) * cut,
      z: corner.z + (outZ / outLength) * cut,
    });
  }

  out.push(points[points.length - 1]);
  return out;
};

const measure = (points: Vec2[]) => {
  const arcLengths = [0];
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dz = points[i].z - points[i - 1].z;
    total += Math.sqrt(dx * dx + dz * dz);
    arcLengths.push(total);
  }

  return { arcLengths, length: total };
};

type Walker = {
  x: number;
  z: number;
  direction: Vec2;
  depth: number;
};

export type TraceNetworkOptions = {
  maxRadius: number;
  /** Cells the walk may traverse before it is cut off. */
  maxSteps: number;
  branchChance: number;
  maxDepth: number;
};

export const buildTraceNetwork = (
  rng: Rng,
  options: TraceNetworkOptions,
): Route[] => {
  const occupied = new Set<number>();
  const routes: Route[] = [];
  const queue: Walker[] = [];

  const maxCellRadius = options.maxRadius / CELL;

  /** Reserve the footprint of the package so nothing is drawn under it. */
  const chipCells = 6;
  for (let x = -chipCells; x <= chipCells; x++) {
    for (let z = -chipCells; z <= chipCells; z++) {
      occupied.add(key(x, z));
    }
  }

  const seedRing = (cellRadius: number, count: number, depth: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.06, 0.06);
      const x = Math.round(Math.cos(angle) * cellRadius);
      const z = Math.round(Math.sin(angle) * cellRadius);
      if (occupied.has(key(x, z))) {
        continue;
      }

      // Head outward along the dominant axis of the seed angle.
      const direction =
        Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
          ? { x: Math.sign(Math.cos(angle)), z: 0 }
          : { x: 0, z: Math.sign(Math.sin(angle)) };

      queue.push({ x, z, direction, depth });
    }
  };

  // Escape routes leaving the package, then progressively sparser rings so the
  // board stays populated as the fan-out spreads apart.
  seedRing(chipCells + 1, 40, 0);
  seedRing(8, 34, 0);
  seedRing(12, 42, 0);
  seedRing(17, 52, 0);
  seedRing(23, 64, 0);
  seedRing(31, 78, 0);
  seedRing(41, 94, 0);
  seedRing(54, 112, 0);
  seedRing(70, 132, 0);
  seedRing(90, 156, 0);
  seedRing(115, 184, 0);
  seedRing(146, 214, 0);
  seedRing(184, 248, 0);
  seedRing(230, 288, 0);

  const pickDirection = (walker: Walker, allowStraight: boolean) => {
    const radialLength = Math.sqrt(walker.x * walker.x + walker.z * walker.z);
    const radialX = radialLength === 0 ? 1 : walker.x / radialLength;
    const radialZ = radialLength === 0 ? 0 : walker.z / radialLength;
    const outwardBias = Math.max(0.18, 1 - radialLength / 90);

    let totalWeight = 0;
    const weights: number[] = [];

    for (let i = 0; i < DIRECTIONS.length; i++) {
      const direction = DIRECTIONS[i];
      const isReverse =
        direction.x === -walker.direction.x && direction.z === -walker.direction.z;
      const isStraight =
        direction.x === walker.direction.x && direction.z === walker.direction.z;

      let weight = 0;
      if (!isReverse && (allowStraight || !isStraight)) {
        const outward = direction.x * radialX + direction.z * radialZ;
        // Escape routing near the package is strongly radial; out in the field
        // the bias relaxes so the board reads as a mesh rather than spokes.
        const score = outward * outwardBias + (1 - outwardBias) * 0.55;
        weight = Math.pow(Math.max(0.05, score + 0.3), 2.2);
        if (isStraight) {
          weight *= 4.5;
        }
      }

      weights.push(weight);
      totalWeight += weight;
    }

    if (totalWeight <= 0) {
      return null;
    }

    let target = rng.next() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      target -= weights[i];
      if (target <= 0) {
        return DIRECTIONS[i];
      }
    }

    return DIRECTIONS[DIRECTIONS.length - 1];
  };

  while (queue.length > 0) {
    const walker = queue.shift() as Walker;
    if (occupied.has(key(walker.x, walker.z))) {
      continue;
    }

    const cells: Vec2[] = [{ x: walker.x, z: walker.z }];
    occupied.add(key(walker.x, walker.z));

    const startRadius =
      Math.sqrt(walker.x * walker.x + walker.z * walker.z) * CELL;
    let steps = 0;
    let stuck = false;

    while (steps < options.maxSteps && !stuck) {
      const run = rng.int(3, 11);
      let advanced = 0;

      for (let i = 0; i < run; i++) {
        const nextX = walker.x + walker.direction.x;
        const nextZ = walker.z + walker.direction.z;

        if (occupied.has(key(nextX, nextZ))) {
          break;
        }

        if (Math.sqrt(nextX * nextX + nextZ * nextZ) > maxCellRadius) {
          stuck = true;
          break;
        }

        walker.x = nextX;
        walker.z = nextZ;
        occupied.add(key(nextX, nextZ));
        advanced++;
        steps++;
      }

      if (advanced > 0) {
        cells.push({ x: walker.x, z: walker.z });
      }

      if (stuck) {
        break;
      }

      // A branch peels off at the corner, the way a net taps off a bus.
      if (
        walker.depth < options.maxDepth &&
        rng.chance(options.branchChance) &&
        queue.length < 6000
      ) {
        const branchDirection = pickDirection(walker, false);
        if (branchDirection !== null) {
          queue.push({
            x: walker.x + branchDirection.x,
            z: walker.z + branchDirection.z,
            direction: branchDirection,
            depth: walker.depth + 1,
          });
        }
      }

      const nextDirection = pickDirection(walker, advanced === 0);
      if (nextDirection === null) {
        break;
      }

      walker.direction = nextDirection;

      // A blocked run that cannot make progress twice in a row is a dead end.
      if (advanced === 0) {
        const probeX = walker.x + walker.direction.x;
        const probeZ = walker.z + walker.direction.z;
        if (occupied.has(key(probeX, probeZ))) {
          break;
        }
      }
    }

    if (cells.length < 2) {
      continue;
    }

    const world = cells.map((cell) => ({ x: cell.x * CELL, z: cell.z * CELL }));
    const points = chamferCorners(world, CELL * 2.1);
    const { arcLengths, length } = measure(points);

    if (length < CELL * 3) {
      continue;
    }

    routes.push({
      points,
      arcLengths,
      length,
      seed: rng.next(),
      depth: walker.depth,
      startRadius,
    });
  }

  return routes;
};
