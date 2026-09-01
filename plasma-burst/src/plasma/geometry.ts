import { CENTRE, DISCHARGE } from "./config";
import { chance, randInt, randRange, randSigned, TAU } from "./random";

/**
 * The discharge web: recursive midpoint displacement, the same algorithm as
 * lightning, tuned to a different character.
 *
 *  - Displacement scale is LOW, so filaments are sinuous rather than jagged,
 *    and the polyline is drawn as chained quadratics so it curls instead of
 *    zigzagging.
 *  - Branch probability is HIGH, producing a tangled web rather than a channel
 *    with a few forks.
 *  - Some filaments run along a curled spine and loop back on themselves.
 *  - Only some primaries start at the core; the rest start partway out, on
 *    other filaments, so the web has no single obvious source.
 */

type Vec2 = { x: number; y: number };

export type Filament = {
  /** Pre-built so the four render passes re-stroke one object. */
  readonly path: Path2D;
  readonly points: readonly Vec2[];
  /** 0 = primary, 1 = fork, 2 = fork of a fork. */
  readonly generation: number;
  /** Hotter filaments run cyan rather than plasma-bright in the mid channel. */
  readonly hot: boolean;
  readonly brightness: number;
};

export type Web = {
  readonly filaments: readonly Filament[];
  /**
   * `boundaries[i]` is the number of filaments belonging to primaries 0..i.
   * Thinning the web to N primaries is a slice, not a regeneration.
   */
  readonly boundaries: readonly number[];
};

/** Chained quadratics through the displaced points — this is what makes it curl. */
const smoothPath = (points: readonly Vec2[]): Path2D => {
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    path.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  const last = points[points.length - 1];
  path.lineTo(last.x, last.y);
  return path;
};

/** A straight run from the origin, bowed to one side before displacement. */
const bowedSpine = (origin: Vec2, angle: number, length: number, seed: string): Vec2[] => {
  const endX = origin.x + Math.cos(angle) * length;
  const endY = origin.y + Math.sin(angle) * length;
  const bow = randSigned(`${seed}-bow`, DISCHARGE.bowAmount * length);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);

  return [
    origin,
    { x: (origin.x + endX) / 2 + nx * bow, y: (origin.y + endY) / 2 + ny * bow },
    { x: endX, y: endY },
  ];
};

/**
 * A filament that curls back on itself. The spine is an opening spiral arc that
 * leaves the origin along `angle` and sweeps most of the way round — lightning
 * never does this, plasma arcs do.
 */
const loopSpine = (origin: Vec2, angle: number, length: number, seed: string): Vec2[] => {
  const sign = chance(`${seed}-loop-dir`, 0.5) ? 1 : -1;
  const radius = length * randRange(`${seed}-loop-r`, 0.32, 0.52);
  const sweep = randRange(`${seed}-loop-sweep`, Math.PI * 1.15, Math.PI * 2.1);
  const spiral = randRange(`${seed}-loop-spiral`, 0.2, 0.85);

  // Centre placed perpendicular to `angle` so the arc's tangent at the origin
  // is `angle` — the loop grows out of the direction the filament was heading.
  const centre = {
    x: origin.x + Math.cos(angle + (Math.PI / 2) * sign) * radius,
    y: origin.y + Math.sin(angle + (Math.PI / 2) * sign) * radius,
  };
  const startAngle = Math.atan2(origin.y - centre.y, origin.x - centre.x);

  const steps = 6;
  const points: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + sign * sweep * t;
    const r = radius * (1 + spiral * t);
    points.push({ x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r });
  }

  return points;
};

type BuildContext = {
  readonly out: Filament[];
};

/**
 * Recursive midpoint displacement. Each level splits every segment, offsets the
 * new midpoint perpendicular by a seeded amount scaled to that segment's length
 * (so the displacement halves naturally as segments halve), and may fork.
 */
const growFilament = (
  spine: readonly Vec2[],
  depth: number,
  generation: number,
  seed: string,
  ctx: BuildContext,
): void => {
  let points: readonly Vec2[] = spine;

  for (let level = 0; level < depth; level++) {
    const decay = DISCHARGE.levelDecay ** level;
    const next: Vec2[] = [points[0]];

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const key = `${seed}-l${level}s${i}`;

      if (length < 1e-3) {
        next.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b);
        continue;
      }

      const nx = -dy / length;
      const ny = dx / length;
      const offset = randSigned(`${key}-d`, DISCHARGE.displacementScale * length * decay);
      next.push(
        { x: (a.x + b.x) / 2 + nx * offset, y: (a.y + b.y) / 2 + ny * offset },
        b,
      );

      const canBranch =
        generation < DISCHARGE.maxGeneration && level < DISCHARGE.branchMaxLevel;

      if (!canBranch) {
        continue;
      }

      const probability =
        DISCHARGE.branchProbability *
        DISCHARGE.branchLevelFalloff ** level *
        DISCHARGE.branchGenerationFalloff ** generation;

      if (!chance(`${key}-b`, probability)) {
        continue;
      }

      const mid = next[next.length - 2];
      const tangent = Math.atan2(dy, dx);
      const branchAngle =
        tangent + randSigned(`${key}-ba`, 1.15) * (chance(`${key}-bs`, 0.5) ? 1 : -1);
      const branchLength = length * randRange(`${key}-bl`, 0.55, 1.15);
      const branchSeed = `${key}-branch`;
      const branchSpine = chance(`${key}-bloop`, DISCHARGE.loopProbability * 0.7)
        ? loopSpine(mid, branchAngle, branchLength, branchSeed)
        : bowedSpine(mid, branchAngle, branchLength, branchSeed);

      growFilament(
        branchSpine,
        Math.max(2, depth - level - 2),
        generation + 1,
        branchSeed,
        ctx,
      );
    }

    points = next;
  }

  ctx.out.push({
    path: smoothPath(points),
    points,
    generation,
    hot: chance(`${seed}-hot`, DISCHARGE.hotFraction),
    brightness: randRange(`${seed}-bright`, 0.55, 1),
  });
};

/** A point and local tangent partway along an existing filament. */
const pointOn = (filament: Filament, t: number): { point: Vec2; tangent: number } => {
  const points = filament.points;
  const raw = t * (points.length - 1);
  const i = Math.min(points.length - 2, Math.max(0, Math.floor(raw)));
  const f = raw - i;
  const a = points[i];
  const b = points[i + 1];

  return {
    point: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
    tangent: Math.atan2(b.y - a.y, b.x - a.x),
  };
};

const buildWeb = (seedIndex: number, width: number, height: number): Web => {
  const cx = width * CENTRE.x;
  const cy = height * CENTRE.y;
  const reach = Math.min(width, height) * DISCHARGE.reach;

  const out: Filament[] = [];
  const boundaries: number[] = [];
  const ctx: BuildContext = { out };
  const webSeed = `web-${seedIndex}`;

  for (let i = 0; i < DISCHARGE.primaryCount; i++) {
    const seed = `${webSeed}-f${i}`;
    const fromCore =
      out.length === 0 || i < DISCHARGE.primaryCount * DISCHARGE.coreOriginFraction;

    let origin: Vec2;
    let angle: number;
    let length: number;

    if (fromCore) {
      // Radiating outward from the discharge centre, with a little jitter on
      // the start point so they do not all converge on one pixel.
      const a = randRange(`${seed}-a`, 0, TAU);
      const r0 = randRange(`${seed}-r0`, 0, reach * 0.42);
      origin = { x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0 };
      angle = a + randSigned(`${seed}-da`, 0.55);
      length = randRange(`${seed}-len`, 0.4, 1.05) * reach;
    } else {
      // Starting partway out, on another filament — the web has no single
      // obvious source.
      const host = out[randInt(`${seed}-host`, 0, out.length)];
      const anchor = pointOn(host, randRange(`${seed}-t`, 0.12, 0.88));
      origin = anchor.point;
      angle = anchor.tangent + randSigned(`${seed}-da`, 1.3);
      length = randRange(`${seed}-len`, 0.22, 0.68) * reach;
    }

    const looping = chance(`${seed}-loop`, DISCHARGE.loopProbability);
    const spine = looping
      ? loopSpine(origin, angle, length, seed)
      : bowedSpine(origin, angle, length, seed);

    // A looped spine already carries its own structure, so it needs fewer
    // subdivision levels to reach the same point density.
    growFilament(spine, looping ? DISCHARGE.recursionDepth - 2 : DISCHARGE.recursionDepth, 0, seed, ctx);

    boundaries.push(out.length);
  }

  return { filaments: out, boundaries };
};

/**
 * Webs are memoised by seed index (and frame size). Re-seeding fires every 2-3
 * frames at peak, so generating each web once and reusing it for its whole hold
 * is the difference between an affordable render and an unaffordable one.
 */
const webCache = new Map<string, Web>();
const WEB_CACHE_LIMIT = 6;

export const getWeb = (seedIndex: number, width: number, height: number): Web => {
  const key = `${seedIndex}:${width}x${height}`;
  const cached = webCache.get(key);
  if (cached) {
    return cached;
  }

  const web = buildWeb(seedIndex, width, height);
  webCache.set(key, web);

  if (webCache.size > WEB_CACHE_LIMIT) {
    const oldest = webCache.keys().next().value;
    if (oldest !== undefined) {
      webCache.delete(oldest);
    }
  }

  return web;
};
