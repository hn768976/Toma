import { random } from "remotion";
import { dist, lerpPoint, type Point } from "./geometry";

/**
 * A glyph outline is carried as arc-length parameterised polylines. Sampling
 * the curves once up front means the sweep can address any point on the
 * outline by distance, which is what makes the dash-based trail exact.
 */
export type SubPath = {
  points: Point[];
  /** Where this sub-path starts along the glyph's nominal outline length. */
  start: number;
  length: number;
  closed: boolean;
};

export type GlyphGeometry = {
  /** The unbroken outline, which the sweep head travels regardless of gaps. */
  nominal: Point[];
  /** Length of the nominal (unbroken) outline — what the sweep circuits. */
  outlineLength: number;
  /** The outline itself, split into one closed run or several broken runs. */
  outline: SubPath[];
  /** Fray stubs and the interior crack: drawn, but never swept. */
  detail: SubPath[];
  /** A closed shape sitting inside the outline: drawn, but never swept. */
  interior: SubPath[];
  /** Gap ranges along the outline, in nominal arc length. */
  gaps: { start: number; end: number }[];
};

const cubicAt = (p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
};

type Cmd =
  | { kind: "line"; to: Point }
  | { kind: "cubic"; c1: Point; c2: Point; to: Point }
  | { kind: "arc"; centre: Point; radius: number; from: number; to: number };

/** Walks a command list into a dense polyline. */
const flatten = (start: Point, cmds: Cmd[]): Point[] => {
  const pts: Point[] = [start];
  let cursor = start;
  for (const cmd of cmds) {
    if (cmd.kind === "line") {
      pts.push(cmd.to);
      cursor = cmd.to;
    } else if (cmd.kind === "cubic") {
      const steps = 96;
      for (let i = 1; i <= steps; i++) {
        pts.push(cubicAt(cursor, cmd.c1, cmd.c2, cmd.to, i / steps));
      }
      cursor = cmd.to;
    } else {
      const span = cmd.to - cmd.from;
      const steps = Math.max(24, Math.ceil(Math.abs(span) * 40));
      for (let i = 1; i <= steps; i++) {
        const a = cmd.from + (span * i) / steps;
        pts.push({
          x: cmd.centre.x + Math.cos(a) * cmd.radius,
          y: cmd.centre.y + Math.sin(a) * cmd.radius,
        });
      }
      cursor = pts[pts.length - 1];
    }
  }
  return pts;
};

/** Re-spaces a polyline at a constant step so dash offsets map to distance. */
export const resample = (pts: Point[], step: number, closed: boolean): Point[] => {
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Point[] = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1];
    const b = src[i];
    const seg = dist(a, b);
    if (seg === 0) continue;
    let t = carry;
    while (t + step <= seg) {
      t += step;
      out.push(lerpPoint(a, b, t / seg));
    }
    carry = t - seg;
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
};

export const polylineLength = (pts: Point[], closed: boolean) => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  if (closed) total += dist(pts[pts.length - 1], pts[0]);
  return total;
};

/** Point at a given distance along a polyline, plus the local direction. */
export const pointAt = (
  pts: Point[],
  closed: boolean,
  target: number,
): { point: Point; angle: number } => {
  const src = closed ? [...pts, pts[0]] : pts;
  let travelled = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1];
    const b = src[i];
    const seg = dist(a, b);
    if (travelled + seg >= target) {
      const t = seg === 0 ? 0 : (target - travelled) / seg;
      return { point: lerpPoint(a, b, t), angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    travelled += seg;
  }
  const last = src[src.length - 1];
  const prev = src[src.length - 2] ?? last;
  return { point: last, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
};

/**
 * Heraldic shield: flat across the top with softened corners, sides falling
 * away and tucking inward to a rounded point. Slightly taller than wide.
 */
export const shieldOutline = (height: number): Point[] => {
  const hh = height / 2;
  const width = height * 0.8;
  const hw = width / 2;
  const corner = width * 0.05;

  const start: Point = { x: -hw + corner, y: -hh };
  const cmds: Cmd[] = [
    { kind: "line", to: { x: hw - corner, y: -hh } },
    // Top-right corner: a small radius, not a rounded rectangle.
    {
      kind: "cubic",
      c1: { x: hw - corner * 0.4, y: -hh },
      c2: { x: hw, y: -hh + corner * 0.4 },
      to: { x: hw, y: -hh + corner },
    },
    // Right flank: a shallow bulge outward, then tucking in hard.
    {
      kind: "cubic",
      c1: { x: hw * 1.03, y: -hh + height * 0.32 },
      c2: { x: hw * 0.9, y: hh * 0.44 },
      to: { x: hw * 0.24, y: hh * 0.86 },
    },
    // The rounded point at the bottom.
    {
      kind: "cubic",
      c1: { x: hw * 0.12, y: hh * 0.97 },
      c2: { x: hw * 0.045, y: hh },
      to: { x: 0, y: hh },
    },
    {
      kind: "cubic",
      c1: { x: -hw * 0.045, y: hh },
      c2: { x: -hw * 0.12, y: hh * 0.97 },
      to: { x: -hw * 0.24, y: hh * 0.86 },
    },
    // Left flank, mirrored.
    {
      kind: "cubic",
      c1: { x: -hw * 0.9, y: hh * 0.44 },
      c2: { x: -hw * 1.03, y: -hh + height * 0.32 },
      to: { x: -hw, y: -hh + corner },
    },
    {
      kind: "cubic",
      c1: { x: -hw, y: -hh + corner * 0.4 },
      c2: { x: -hw + corner * 0.4, y: -hh },
      to: start,
    },
  ];
  return resample(flatten(start, cmds), 2.4, true);
};

/**
 * Keyhole: a circle joined to a slot that tapers outward toward a flat
 * bottom edge. The circle-to-slot junction is a genuine concavity, which
 * is what makes the sweep read differently from the shield.
 */
export const keyholeOutline = (height: number): Point[] => {
  const hh = height / 2;
  const r = height * 0.29;
  const cy = -hh + r * 1.04;
  const neck = r * 0.44;
  const foot = r * 0.66;
  const bottom = hh;
  const joinY = cy + Math.sqrt(Math.max(r * r - neck * neck, 1));
  const joinAngle = Math.atan2(joinY - cy, neck);

  const start: Point = { x: neck, y: joinY };
  const cmds: Cmd[] = [
    // Right slot wall, flaring gently outward on the way down.
    {
      kind: "cubic",
      c1: { x: neck * 1.02, y: joinY + (bottom - joinY) * 0.45 },
      c2: { x: foot * 0.94, y: bottom - r * 0.22 },
      to: { x: foot, y: bottom - r * 0.08 },
    },
    // Flat bottom edge with softened corners.
    {
      kind: "cubic",
      c1: { x: foot, y: bottom },
      c2: { x: foot * 0.86, y: bottom },
      to: { x: foot * 0.7, y: bottom },
    },
    { kind: "line", to: { x: -foot * 0.7, y: bottom } },
    {
      kind: "cubic",
      c1: { x: -foot * 0.86, y: bottom },
      c2: { x: -foot, y: bottom },
      to: { x: -foot, y: bottom - r * 0.08 },
    },
    // Left slot wall back up to the circle.
    {
      kind: "cubic",
      c1: { x: -foot * 0.94, y: bottom - r * 0.22 },
      c2: { x: -neck * 1.02, y: joinY + (bottom - joinY) * 0.45 },
      to: { x: -neck, y: joinY },
    },
    // From the left junction, up and over the top of the circle, back round
    // to the right junction where the outline started.
    {
      kind: "arc",
      centre: { x: 0, y: cy },
      radius: r,
      from: Math.PI - joinAngle,
      to: 2 * Math.PI + joinAngle,
    },
  ];
  return resample(flatten(start, cmds), 2.4, true);
};

/**
 * Guard shield: flat across the top between generously rounded shoulders,
 * sides converging steadily from their widest point at the very top, then a
 * long taper to a narrow tip — the shape a security badge takes.
 *
 * Close cousin to `shieldOutline`, and deliberately so, but wider across a
 * flatter top, with straight sides rather than bulging flanks and a much
 * longer, sharper taper.
 */
export const guardShieldOutline = (height: number): Point[] => {
  const hh = height / 2;
  const width = height * 0.84;
  const hw = width / 2;
  const corner = width * 0.11;

  const start: Point = { x: -hw + corner, y: -hh };
  const cmds: Cmd[] = [
    { kind: "line", to: { x: hw - corner, y: -hh } },
    // Rounded shoulder, a fuller radius than v1's clipped corner.
    {
      kind: "cubic",
      c1: { x: hw - corner * 0.42, y: -hh },
      c2: { x: hw, y: -hh + corner * 0.42 },
      to: { x: hw, y: -hh + corner },
    },
    // The side: no outward bulge — it narrows from the shoulder downward,
    // gently at first and then harder through the waist.
    {
      kind: "cubic",
      c1: { x: hw * 0.995, y: -hh + height * 0.3 },
      c2: { x: hw * 0.93, y: -hh + height * 0.56 },
      to: { x: hw * 0.56, y: hh * 0.54 },
    },
    // The long taper down to a narrow, barely rounded tip.
    {
      kind: "cubic",
      c1: { x: hw * 0.33, y: hh * 0.85 },
      c2: { x: hw * 0.1, y: hh * 0.985 },
      to: { x: 0, y: hh },
    },
    {
      kind: "cubic",
      c1: { x: -hw * 0.1, y: hh * 0.985 },
      c2: { x: -hw * 0.33, y: hh * 0.85 },
      to: { x: -hw * 0.56, y: hh * 0.54 },
    },
    // Left side, mirrored.
    {
      kind: "cubic",
      c1: { x: -hw * 0.93, y: -hh + height * 0.56 },
      c2: { x: -hw * 0.995, y: -hh + height * 0.3 },
      to: { x: -hw, y: -hh + corner },
    },
    {
      kind: "cubic",
      c1: { x: -hw, y: -hh + corner * 0.42 },
      c2: { x: -hw + corner * 0.42, y: -hh },
      to: start,
    },
  ];
  return resample(flatten(start, cmds), 2.4, true);
};

const subPathFrom = (points: Point[], start: number, closed: boolean): SubPath => ({
  points,
  start,
  length: polylineLength(points, closed),
  closed,
});

/** Slices the closed outline at a distance range, returning an open run. */
const sliceOutline = (pts: Point[], from: number, to: number): Point[] => {
  const total = polylineLength(pts, true);
  const out: Point[] = [pointAt(pts, true, from % total).point];
  const step = 2.4;
  for (let d = from + step; d < to; d += step) {
    out.push(pointAt(pts, true, d % total).point);
  }
  out.push(pointAt(pts, true, to % total).point);
  return out;
};

/** Recursive midpoint displacement — the crack running into the shield. */
const jaggedPath = (a: Point, b: Point, levels: number, seed: string): Point[] => {
  let pts = [a, b];
  for (let level = 0; level < levels; level++) {
    const next: Point[] = [pts[0]];
    const amp = dist(a, b) * 0.16 * Math.pow(0.55, level);
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const mid = lerpPoint(p0, p1, 0.5);
      const nx = -(p1.y - p0.y);
      const ny = p1.x - p0.x;
      const len = Math.hypot(nx, ny) || 1;
      const offset = (random(`${seed}-${level}-${i}`) - 0.5) * 2 * amp;
      next.push({ x: mid.x + (nx / len) * offset, y: mid.y + (ny / len) * offset });
      next.push(p1);
    }
    pts = next;
  }
  return pts;
};

/**
 * Turns a closed outline into the variant's integrity mode.
 *
 * "solid" hands back one closed run. "fractured" cuts 5 irregular gaps,
 * frays the broken ends with short stubs, and adds a jagged interior
 * crack — all derived from the outline itself, never a second hardcoded
 * path.
 */
export const buildGlyphGeometry = (
  outline: Point[],
  integrity: "solid" | "fractured",
  seed: string,
  inner?: Point[],
): GlyphGeometry => {
  const outlineLength = polylineLength(outline, true);
  const interior = inner ? [subPathFrom(inner, 0, true)] : [];

  if (integrity === "solid") {
    return {
      nominal: outline,
      outlineLength,
      outline: [subPathFrom(outline, 0, true)],
      detail: [],
      interior,
      gaps: [],
    };
  }

  const gapCount = 5;
  const gaps: { start: number; end: number }[] = [];
  for (let i = 0; i < gapCount; i++) {
    // Irregular positions: an even share of the outline, nudged off centre.
    const slot = (i + 0.5) / gapCount;
    const jitter = (random(`${seed}-gap-pos-${i}`) - 0.5) * 0.55;
    const size = 0.03 + random(`${seed}-gap-size-${i}`) * 0.05;
    const centre = ((slot + jitter / gapCount) % 1) * outlineLength;
    gaps.push({
      start: (centre - (size * outlineLength) / 2 + outlineLength) % outlineLength,
      end: (centre + (size * outlineLength) / 2 + outlineLength) % outlineLength,
    });
  }
  gaps.sort((a, b) => a.start - b.start);

  const runs: SubPath[] = [];
  for (let i = 0; i < gaps.length; i++) {
    const from = gaps[i].end;
    const to = gaps[(i + 1) % gaps.length].start;
    const span = (to - from + outlineLength) % outlineLength;
    if (span < 8) continue;
    runs.push(subPathFrom(sliceOutline(outline, from, from + span), from, false));
  }

  // Frays: two or three stubs peeling off each broken end.
  const detail: SubPath[] = [];
  for (let i = 0; i < gaps.length; i++) {
    for (const [endKind, at] of [
      ["a", gaps[i].start],
      ["b", gaps[i].end],
    ] as const) {
      const stubs = 2 + Math.floor(random(`${seed}-fray-n-${i}-${endKind}`) * 2);
      const base = pointAt(outline, true, at);
      for (let s = 0; s < stubs; s++) {
        const spread = (random(`${seed}-fray-a-${i}-${endKind}-${s}`) - 0.5) * 1.1;
        // Stubs trail off the way the outline was heading when it broke.
        const dir = base.angle + spread + (endKind === "a" ? 0 : Math.PI);
        const len = outlineLength * (0.012 + random(`${seed}-fray-l-${i}-${endKind}-${s}`) * 0.02);
        const tip = {
          x: base.point.x + Math.cos(dir) * len,
          y: base.point.y + Math.sin(dir) * len,
        };
        detail.push(subPathFrom(jaggedPath(base.point, tip, 2, `${seed}-fray-j-${i}-${endKind}-${s}`), 0, false));
      }
    }
  }

  // The crack: from the upper-right edge inward and down toward centre.
  const crackStart = pointAt(outline, true, outlineLength * 0.3).point;
  const crackEnd = { x: crackStart.x * 0.06, y: crackStart.y + outlineLength * 0.085 };
  detail.push(subPathFrom(jaggedPath(crackStart, crackEnd, 4, `${seed}-crack`), 0, false));

  return { nominal: outline, outlineLength, outline: runs, detail, interior, gaps };
};

export const toPath2D = (sub: SubPath): Path2D => {
  const p = new Path2D();
  sub.points.forEach((pt, i) => (i === 0 ? p.moveTo(pt.x, pt.y) : p.lineTo(pt.x, pt.y)));
  if (sub.closed) p.closePath();
  return p;
};
