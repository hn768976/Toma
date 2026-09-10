// The radial network, generated once at module load.
//
// Angles, radii, node sizes, icon assignment and pulse timing are all
// fixed here; per frame the composition only re-evaluates rotation and
// pulse phase. Coordinates are in normalised units (1 = frame height),
// origin at frame centre.

import {
  NODE_COUNT,
  HUB_OUTER_RADIUS,
  SPOKE_ORIGIN_RADIUS,
  DURATION_IN_FRAMES,
} from "./constants";
import { ICONS } from "./icons";
import { mulberry32 } from "./random";

export type NetworkNode = {
  index: number;
  /** Radians, measured from the +x axis. */
  angle: number;
  /** Distance from hub centre, normalised units. */
  radius: number;
  /** Node ring radius, normalised units. */
  size: number;
  iconIndex: number;
  /** 0 = primary, 1 = accent, 2 = alt. */
  colorSlot: 0 | 1 | 2;
  /** Whole trips this node's pulse makes across the 300-frame loop. */
  pulseTrips: number;
  /** Fixed phase offset so pulses stagger instead of firing together. */
  pulsePhase: number;
  /** 0 = sharp, 1 = slightly soft, 2 = softest. Mild edge falloff only. */
  blurTier: 0 | 1 | 2;
  /** Where the spoke starts and ends, normalised units. */
  spokeStart: number;
  spokeEnd: number;
};

/**
 * Distance from frame centre to the frame edge along `angle`, for a
 * frame `2 * halfW` wide and 1 tall. Node radii are expressed as a
 * fraction of this so the network fills a 16:9 frame evenly instead of
 * bunching into a circle inside it.
 */
const edgeDistance = (angle: number, halfW: number) => {
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const dx = c < 1e-6 ? Infinity : halfW / c;
  const dy = s < 1e-6 ? Infinity : 0.5 / s;
  return Math.min(dx, dy);
};

const buildNetwork = (seed: number, aspect: number): NetworkNode[] => {
  const rand = mulberry32(seed);
  const halfW = aspect / 2;

  // Irregular angular spacing: random gaps normalised to a full turn.
  // Even division would read as a diagram rather than a network, so the
  // gaps are allowed to vary roughly 0.55x to 1.55x the mean.
  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < NODE_COUNT; i++) {
    const g = 0.68 + rand() * 0.72;
    gaps.push(g);
    total += g;
  }
  const startAngle = rand() * Math.PI * 2;

  const nodes: NetworkNode[] = [];
  let acc = 0;
  // Shuffled icon bag, refilled as it empties, so every icon appears
  // before any repeats.
  let bag: number[] = [];
  const takeIcon = () => {
    if (bag.length === 0) {
      bag = ICONS.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop() as number;
  };

  for (let i = 0; i < NODE_COUNT; i++) {
    const angle = startAngle + (acc / total) * Math.PI * 2;
    acc += gaps[i];

    // Radial spread: `t` walks nodes out from just clear of the hub to
    // slightly past the frame edge, so they sit at many radii and a few
    // end up cropped.
    // Biased inward so the frame stays dense near the hub the way the
    // reference does, with a handful pushed deliberately over the edge.
    let t = Math.pow(rand(), 1.3);
    if (rand() > 0.84) t = 0.96 + rand() * 0.06;
    const minR = 0.245;
    const maxR = edgeDistance(angle, halfW) * 1.02;
    const radius = minR + t * Math.max(maxR - minR, 0.05);

    const big = rand() > 0.8;
    const size = big ? 0.033 + rand() * 0.009 : 0.0205 + rand() * 0.0095;

    // Mostly warm orange, a few cyan, a couple red. That warm/cool mix
    // against the blue field is what gives the frame its life.
    const c = rand();
    const colorSlot: 0 | 1 | 2 = c > 0.9 ? 2 : c > 0.74 ? 1 : 0;

    const trips = [1, 1, 2, 2, 3][Math.floor(rand() * 5)];

    nodes.push({
      index: i,
      angle,
      radius,
      size,
      iconIndex: takeIcon(),
      colorSlot,
      pulseTrips: trips,
      pulsePhase: rand(),
      blurTier: 0,
      spokeStart: SPOKE_ORIGIN_RADIUS,
      spokeEnd: 0,
    });
  }

  relax(nodes);

  for (const node of nodes) {
    node.blurTier = node.radius > 0.62 ? 2 : node.radius > 0.44 ? 1 : 0;
    node.spokeEnd = Math.max(
      node.radius - node.size,
      SPOKE_ORIGIN_RADIUS + 0.01,
    );
  }
  return nodes;
};

/**
 * Pushes overlapping nodes apart along their own spokes. Angles are
 * fixed by design, so the only free axis is radius - which keeps the
 * layout strictly radial while stopping two icon discs from colliding
 * on an unlucky seed.
 */
const relax = (nodes: NetworkNode[]) => {
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = Math.cos(a.angle) * a.radius - Math.cos(b.angle) * b.radius;
        const dy = Math.sin(a.angle) * a.radius - Math.sin(b.angle) * b.radius;
        const dist = Math.hypot(dx, dy);
        const want = (a.size + b.size) * 1.28;
        if (dist >= want) continue;
        const push = (want - dist) * 0.5;
        // The outer node steps out, the inner one steps in, so neither
        // drifts far from the radius it was assigned.
        const outer = a.radius >= b.radius ? a : b;
        const inner = outer === a ? b : a;
        outer.radius += push;
        inner.radius = Math.max(0.245, inner.radius - push);
        moved = true;
      }
    }
    if (!moved) break;
  }
};

export const NETWORK = buildNetwork(20260910, 16 / 9);

// Sanity: every pulse must complete a whole number of trips over the
// loop, otherwise frame 300 wouldn't land back on frame 0.
export const PULSE_PERIODS = NETWORK.map(
  (node) => DURATION_IN_FRAMES / node.pulseTrips,
);

export const HUB_EDGE = HUB_OUTER_RADIUS;
