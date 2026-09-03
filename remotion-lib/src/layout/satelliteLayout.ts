/**
 * Satellite layout: places N nodes around a hub and returns their positions
 * plus the connector paths that join them.
 *
 * `buildLayout` branches on the layout MODE and returns node positions plus
 * connector paths. Both modes return the same shape, so <ConnectorLines> and
 * <IconNode> render either arrangement without knowing which one they got:
 *
 *   "radiating" — nodes burst from the hub at deliberately uneven distances
 *                 and jittered angles; paths are straight hub spokes plus
 *                 node-to-node cross-links, which is what makes it read as a
 *                 network rather than a star.
 *   "arcs"      — nodes are beads strung along a few large intersecting
 *                 circle segments that sweep across the frame; the hub sits
 *                 where two of them cross and there are no spokes at all. The
 *                 arcs themselves are the connective tissue.
 *
 * Positions are static — a pure function of the seed and frame size, so they
 * can be computed once and memoised. Only `resolveFrame` is per-frame, and it
 * too is a pure function of the frame number, so renders are deterministic
 * even when a renderer works frames out of order.
 *
 * Nothing here knows about colour: nodes carry a `bright` weight and paths a
 * "dim"/"bright" tone, and the caller maps those onto its own palette. The
 * icon name is a free type parameter, so any icon registry can be used.
 *
 *   const layout = buildSatelliteLayout({
 *     mode: "radiating",          // or "arcs"
 *     count: 14,
 *     icons: ["chip", "cloud"],   // any string union
 *     hub: {x: 1920, y: 1080}, hubRadius: 259,
 *     width: 3840, height: 2160,
 *     seed: "hub/ai", exclusions: panelRects,
 *     loopFrames: 450, dotPeriods: [50, 75, 90, 150, 225],
 *   });
 *
 * Every dot period must divide `loopFrames`, or travelling dots will jump at
 * the loop seam.
 */
import {
  circleHitsRect,
  cumulativeLengths,
  inFrameSpan,
  distToSegment,
  distanceToFrameEdge,
  pointAtT,
  sampleArc,
  arcThroughPoint,
  type Arc,
  type Rect,
  type Vec2,
} from "../geometry/polyline";
import { pick, rand, randRange, shuffled } from "../random/seeded";

/** How satellites are arranged around the hub. */
export type LayoutMode = "radiating" | "arcs";

export type LayoutNode<T extends string = string> = {
  id: string;
  x: number;
  y: number;
  /** Radius of the thin circle around the icon; 0 for a bare icon. */
  ring: number;
  /** Side of the square the icon is drawn into, in px. */
  iconSize: number;
  icon: T;
  /** Relative brightness, 0..1. Drives stroke alpha and bloom strength. */
  bright: number;
  /** Direction of a short connector stub for a bare icon, or null. */
  stub: number | null;
};

export type PathDot = {
  /** Frames for one transit. Divides loopFrames, so the loop closes. */
  period: number;
  /** Starting offset, 0..1. */
  phase: number;
  /** Radius in px. */
  size: number;
};

export type LayoutPath = {
  id: string;
  points: Vec2[];
  weight: number;
  tone: "dim" | "bright";
  dots: PathDot[];
};

export type Layout<T extends string = string> = {
  nodes: LayoutNode<T>[];
  paths: LayoutPath[];
};

export type LayoutOptions<T extends string = string> = {
  mode: LayoutMode;
  count: number;
  icons: readonly T[];
  hub: Vec2;
  hubRadius: number;
  width: number;
  height: number;
  seed: string;
  /**
   * Rectangles satellites must keep clear of — the side chrome. Without this
   * a node can land on top of a panel, which reads as a mistake rather than
   * as depth.
   */
  exclusions: readonly Rect[];
  /** Loop length in frames. Dot transits are phased against this. */
  loopFrames: number;
  /** Candidate transit times for travelling dots. Each must divide loopFrames. */
  dotPeriods: readonly number[];
};

/** A dot resolved to a concrete position for one frame. */
export type ResolvedDot = { x: number; y: number; size: number; alpha: number };

export type FrameState = {
  dots: ResolvedDot[];
  /** Per-node extra brightness, 0..1, from a dot passing through it. */
  boosts: number[];
};

/** Radius within which a passing dot brightens a node. */
const BOOST_RADIUS = 150;

/** Clear space kept between a satellite and a panel. */
const PANEL_CLEARANCE = 44;

/** Where a bare icon's stub starts and ends, as a fraction of the icon box. */
export const STUB_FROM = 0.5;
export const STUB_TO = 0.7;

const nodeLooks = (
  seed: string,
  index: number,
  circledChance: number,
): Pick<LayoutNode, "ring" | "iconSize" | "bright"> => {
  const circled = rand(`${seed}/circled/${index}`) < circledChance;
  const scale = randRange(`${seed}/scale/${index}`, 0.82, 1.35);
  if (circled) {
    const ring = Math.round(randRange(`${seed}/ring/${index}`, 52, 84) * scale);
    return {
      ring,
      iconSize: Math.round(ring * 1.16),
      bright: randRange(`${seed}/bright/${index}`, 0.55, 1),
    };
  }
  return {
    ring: 0,
    iconSize: Math.round(randRange(`${seed}/bare/${index}`, 150, 230) * scale),
    bright: randRange(`${seed}/bright/${index}`, 0.5, 0.95),
  };
};

const dotSpec = (
  seed: string,
  key: string,
  count: number,
  dotPeriods: readonly number[],
): PathDot[] =>
  Array.from({ length: count }, (_, i) => ({
    period: pick(`${seed}/dotperiod/${key}/${i}`, dotPeriods),
    phase: rand(`${seed}/dotphase/${key}/${i}`),
    size: randRange(`${seed}/dotsize/${key}/${i}`, 7, 12),
  }));

/**
 * "radiating": a hub-and-spoke burst, deliberately de-regularised. Angles are
 * jittered off the even division and distances are drawn from a shuffled
 * stratified set, so the spread is guaranteed to run from just outside the hub
 * to close to the frame edges — a uniform distance would read as a clock face.
 */
const buildRadiating = <T extends string>(opts: LayoutOptions<T>): Layout<T> => {
  const { count, icons, hub, hubRadius, width, height, seed, exclusions, dotPeriods } =
    opts;
  const step = (Math.PI * 2) / count;
  const minDistance = hubRadius + 210;

  // Stratified distance fractions, shuffled so neither the near nor the far
  // nodes end up bunched on one side of the frame.
  const strata = Array.from({ length: count }, (_, i) =>
    count === 1 ? 0.5 : i / (count - 1),
  );
  const fractions = shuffled(`${seed}/strata`, strata);

  const nodes: LayoutNode<T>[] = [];
  for (let i = 0; i < count; i++) {
    const look = nodeLooks(seed, i, 0.62);
    const reach = look.ring > 0 ? look.ring : look.iconSize / 2;

    let placed: Vec2 | null = null;
    // A few seeded attempts, so a node that lands on a neighbour gets
    // re-jittered rather than overlapping it.
    for (let attempt = 0; attempt < 10 && !placed; attempt++) {
      const angle =
        i * step +
        randRange(`${seed}/angle/${i}/${attempt}`, -step * 0.42, step * 0.42);
      const edge = distanceToFrameEdge(hub, angle, width, height, reach + 130);
      const far = Math.max(minDistance + 60, edge * 0.94);
      const u = Math.min(
        1,
        Math.max(
          0,
          fractions[i] +
            randRange(`${seed}/ujit/${i}/${attempt}`, -0.06, 0.06),
        ),
      );
      // Slight bias outward keeps the middle band from feeling crowded.
      const distance = minDistance + (far - minDistance) * Math.pow(u, 0.82);
      const candidate = {
        x: hub.x + Math.cos(angle) * distance,
        y: hub.y + Math.sin(angle) * distance,
      };
      const clash =
        nodes.some((n) => {
          const need = reach + (n.ring > 0 ? n.ring : n.iconSize / 2) + 54;
          return Math.hypot(n.x - candidate.x, n.y - candidate.y) < need;
        }) ||
        exclusions.some((rect) =>
          circleHitsRect(candidate, reach, rect, PANEL_CLEARANCE),
        );
      if (!clash) placed = candidate;
    }
    if (!placed) continue;

    nodes.push({
      id: `n${i}`,
      x: placed.x,
      y: placed.y,
      icon: icons[i % icons.length],
      ...look,
      // A bare icon's stub aims back at the hub, so its spoke reads as
      // arriving at the icon rather than stopping short in mid-air.
      stub:
        look.ring > 0
          ? null
          : Math.atan2(hub.y - placed.y, hub.x - placed.x),
    });
  }

  const paths: LayoutPath[] = [];

  // Straight spokes, hub rim to node rim.
  nodes.forEach((node, i) => {
    const angle = Math.atan2(node.y - hub.y, node.x - hub.x);
    // Circled nodes stop at the circle; bare ones stop where their stub
    // begins, so the stub completes the connection.
    const gap =
      (node.ring > 0 ? node.ring : node.iconSize * STUB_TO) + 14;
    const start = {
      x: hub.x + Math.cos(angle) * (hubRadius + 40),
      y: hub.y + Math.sin(angle) * (hubRadius + 40),
    };
    const end = {
      x: node.x - Math.cos(angle) * gap,
      y: node.y - Math.sin(angle) * gap,
    };
    paths.push({
      id: `spoke${i}`,
      points: [start, end],
      weight: 3,
      tone: "bright",
      dots: rand(`${seed}/spokedot/${i}`) < 0.6
        ? dotSpec(seed, `spoke${i}`, 1, dotPeriods)
        : [],
    });
  });

  // Cross-links between angular neighbours. These are what turn the star into
  // a loose web; a link that would cut across the hub is dropped.
  const linked = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    for (const skip of [1, 2]) {
      const j = (i + skip) % nodes.length;
      if (i === j) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (linked.has(key)) continue;
      if (rand(`${seed}/cross/${key}`) > (skip === 1 ? 0.78 : 0.46)) continue;

      const a = nodes[i];
      const b = nodes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 1600) continue;
      if (distToSegment(hub, a, b) < hubRadius + 70) continue;

      linked.add(key);
      // Trim both ends back to each node's own footprint. Terminating at the
      // node centre would leave a stub poking out of an un-circled icon.
      const along = Math.atan2(b.y - a.y, b.x - a.x);
      const trimA = (a.ring > 0 ? a.ring : a.iconSize * 0.44) + 8;
      const trimB = (b.ring > 0 ? b.ring : b.iconSize * 0.44) + 8;
      paths.push({
        id: `cross${key}`,
        points: [
          { x: a.x + Math.cos(along) * trimA, y: a.y + Math.sin(along) * trimA },
          { x: b.x - Math.cos(along) * trimB, y: b.y - Math.sin(along) * trimB },
        ],
        weight: 2.4,
        tone: "dim",
        dots: rand(`${seed}/crossdot/${key}`) < 0.35
          ? dotSpec(seed, `cross${key}`, 1, dotPeriods)
          : [],
      });
    }
  }

  return { nodes, paths };
};

/**
 * "arcs": nodes are beads on a few large circle segments. Two arcs are
 * constructed to pass exactly through the hub so it sits at an intersection,
 * and the remaining arcs cross the frame at other angles so the rails overlap
 * and intersect each other. No spokes are produced at all.
 */
const buildArcs = <T extends string>(opts: LayoutOptions<T>): Layout<T> => {
  const { count, icons, hub, hubRadius, width, height, seed, exclusions, dotPeriods } =
    opts;

  // Two rails through the hub, two more sweeping across elsewhere. Radii are
  // large relative to the frame so each reads as a gentle sweep, not a circle.
  const rails: Arc[] = [
    arcThroughPoint(hub, 2600, -0.24, 1.28, 1),
    arcThroughPoint(hub, 3200, 1.16, 1.1, -1),
    arcThroughPoint(
      { x: width * 0.34, y: height * 0.2 },
      2900,
      0.3,
      1.16,
      1,
    ),
    arcThroughPoint(
      { x: width * 0.68, y: height * 0.83 },
      2400,
      -0.42,
      1.34,
      -1,
    ),
  ];

  const railPoints = rails.map((arc) => sampleArc(arc, 190));

  const paths: LayoutPath[] = railPoints.map((points, i) => ({
    id: `rail${i}`,
    points,
    weight: i < 2 ? 3.2 : 2.6,
    tone: i < 2 ? "bright" : "dim",
    dots: dotSpec(seed, `rail${i}`, i < 2 ? 3 : 2, dotPeriods),
  }));

  // Spread the bead count across the rails, front-loading the two that run
  // through the hub.
  const perRail = [0, 0, 0, 0];
  for (let i = 0; i < count; i++) perRail[i % 4]++;

  const nodes: LayoutNode<T>[] = [];
  let index = 0;
  railPoints.forEach((points, railIndex) => {
    const cum = cumulativeLengths(points);
    const wanted = perRail[railIndex];

    // Stratify beads over the rail's visible stretch rather than its whole
    // length: these arcs are far larger than the frame, so much of each one
    // is off-screen and slots allocated there would never place.
    const span = inFrameSpan(points, cum, width, height, 150) ?? {
      from: 0,
      to: 1,
    };
    const spanWidth = span.to - span.from;

    for (let k = 0; k < wanted; k++) {
      const look = nodeLooks(seed, index, 0.55);
      const reach = look.ring > 0 ? look.ring : look.iconSize / 2;
      const margin = reach + 80;

      // Irregular intervals: a stratified base position along the rail plus a
      // seeded nudge, retried if it lands on the hub, off-frame, or on a bead
      // already strung on any rail.
      let placed: Vec2 | null = null;
      for (let attempt = 0; attempt < 26 && !placed; attempt++) {
        const base = span.from + ((k + 0.5) / wanted) * spanWidth;
        // Later attempts range wider, so a bead crowded out of its own slot
        // slides along the rail instead of being dropped.
        const spread = (0.38 + attempt * 0.06) / wanted;
        const t = Math.min(
          span.to,
          Math.max(
            span.from,
            base +
              randRange(
                `${seed}/beadt/${railIndex}/${k}/${attempt}`,
                -spread * spanWidth,
                spread * spanWidth,
              ),
          ),
        );
        const candidate = pointAtT(points, cum, t);
        if (
          candidate.x < margin ||
          candidate.x > width - margin ||
          candidate.y < margin ||
          candidate.y > height - margin
        ) {
          continue;
        }
        if (Math.hypot(candidate.x - hub.x, candidate.y - hub.y) < hubRadius + reach + 130) {
          continue;
        }
        const clash =
          nodes.some((n) => {
            const need = reach + (n.ring > 0 ? n.ring : n.iconSize / 2) + 46;
            return Math.hypot(n.x - candidate.x, n.y - candidate.y) < need;
          }) ||
          exclusions.some((rect) =>
            circleHitsRect(candidate, reach, rect, PANEL_CLEARANCE),
          );
        if (!clash) placed = candidate;
      }
      if (!placed) {
        index++;
        continue;
      }

      nodes.push({
        id: `n${index}`,
        x: placed.x,
        y: placed.y,
        icon: icons[index % icons.length],
        ...look,
        // No stubs here: the rail runs through the node, so a stub would be
        // a second, contradictory connection.
        stub: null,
      });
      index++;
    }
  });

  return { nodes, paths };
};

/** Builds a layout for `mode`. Deterministic for a given options object. */
export const buildSatelliteLayout = <T extends string>(opts: LayoutOptions<T>): Layout<T> => {
  if (opts.count <= 0 || opts.icons.length === 0) {
    return { nodes: [], paths: [] };
  }
  switch (opts.mode) {
    case "radiating":
      return buildRadiating(opts);
    case "arcs":
      return buildArcs(opts);
  }
};

/**
 * Per-frame state for a layout: where every travelling dot currently is, and
 * how much each node is brightened by a dot passing it.
 *
 * This lives here rather than in the renderer so that both the connector layer
 * and the icon layer agree on dot positions without either of them knowing the
 * arrangement. A dot's position is a pure function of `frame`, and because
 * every period divides loopFrames the whole set returns to its frame-0
 * arrangement at the end of the loop.
 */
export const resolveFrame = (
  layout: Layout,
  frame: number,
  loopFrames: number,
): FrameState => {
  const f = frame % loopFrames;
  const dots: ResolvedDot[] = [];
  const boosts = new Array<number>(layout.nodes.length).fill(0);

  for (const path of layout.paths) {
    if (path.dots.length === 0) continue;
    const cum = cumulativeLengths(path.points);
    for (const dot of path.dots) {
      const t = ((f / dot.period) % 1 + dot.phase) % 1;
      const at = pointAtT(path.points, cum, t);
      // Fade in and out at the ends so a dot never pops mid-air.
      const edge = Math.min(t, 1 - t);
      const alpha = Math.min(1, edge / 0.08);
      dots.push({ x: at.x, y: at.y, size: dot.size, alpha });

      layout.nodes.forEach((node, i) => {
        const d = Math.hypot(node.x - at.x, node.y - at.y);
        if (d < BOOST_RADIUS) {
          boosts[i] = Math.max(boosts[i], (1 - d / BOOST_RADIUS) * alpha);
        }
      });
    }
  }

  return { dots, boosts };
};
