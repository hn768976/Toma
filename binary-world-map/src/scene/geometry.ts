import {random} from "remotion";
import {CONFIG, HEIGHT, WIDTH} from "../config";
import {seededInt, seededPick, seededRange} from "../lib/seeded";
import type {Pt} from "../lib/catmull-rom";

/**
 * All of the overlay geometry, derived once from string seeds.
 *
 * Nothing here depends on the frame: these are the fixed positions the
 * animation then modulates. Keeping generation separate from drawing means the
 * expensive parts (pairwise line intersections, contour control points) run in
 * a single `useMemo` rather than per frame.
 */

export type Line = {
  /** A point the line passes through. */
  px: number;
  py: number;
  /** Unit direction. */
  dx: number;
  dy: number;
};

export type Node = {
  x: number;
  y: number;
  major: boolean;
  radius: number;
  /** Pulse period in frames. */
  period: number;
  phase: number;
};

export type Contour = {
  points: Pt[];
  closed: boolean;
  /** Per-curve drift phase so the layer does not move as one block. */
  driftPhase: number;
  driftScale: number;
  opacity: number;
};

export type Callout = {
  x: number;
  y: number;
  /** Node this callout's leader line points at. */
  nodeIndex: number;
  /** Leader elbow runs left or right out of the text block. */
  side: -1 | 1;
  lineCount: number;
  headerSeed: string;
  bodySeed: string;
  bigNumber: string | null;
};

export type Star = {x: number; y: number; r: number; alpha: number; period: number; phase: number};

/* ------------------------------------------------------------------ lines */

export const buildLines = (seed: string): Line[] => {
  const {count, overshoot} = CONFIG.connections;
  void overshoot;
  const lines: Line[] = [];
  for (let i = 0; i < count; i++) {
    // Mostly shallow: straight sightlines across a wide frame, not flight paths.
    const steep = random(`${seed}-steep-${i}`) < 0.22;
    const spread = steep ? 58 : 30;
    const deg =
      seededRange(`${seed}-ang-${i}`, -spread, spread) +
      (random(`${seed}-flip-${i}`) < 0.5 ? 0 : 180);
    const rad = (deg * Math.PI) / 180;
    lines.push({
      px: seededRange(`${seed}-px-${i}`, -WIDTH * 0.1, WIDTH * 1.1),
      py: seededRange(`${seed}-py-${i}`, -HEIGHT * 0.15, HEIGHT * 1.15),
      dx: Math.cos(rad),
      dy: Math.sin(rad),
    });
  }
  return lines;
};

const intersect = (a: Line, b: Line): Pt | null => {
  const det = a.dx * -b.dy - -b.dx * a.dy;
  if (Math.abs(det) < 1e-6) return null;
  const rx = b.px - a.px;
  const ry = b.py - a.py;
  const t = (rx * -b.dy - -b.dx * ry) / det;
  return {x: a.px + a.dx * t, y: a.py + a.dy * t};
};

/* ------------------------------------------------------------------ nodes */

export const buildNodes = (seed: string, lines: Line[]): Node[] => {
  const {count, majorFraction, radiusMinor, radiusMajor} = CONFIG.nodes;
  const inset = 90;
  const candidates: Pt[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const p = intersect(lines[i], lines[j]);
      if (!p) continue;
      if (p.x < inset || p.x > WIDTH - inset) continue;
      if (p.y < inset || p.y > HEIGHT - inset) continue;
      candidates.push(p);
    }
  }

  // Seeded shuffle, then thin out clusters so nodes read as distinct points.
  candidates.sort(
    (a, b) =>
      random(`${seed}-sort-${Math.round(a.x)}-${Math.round(a.y)}`) -
      random(`${seed}-sort-${Math.round(b.x)}-${Math.round(b.y)}`),
  );

  const chosen: Pt[] = [];
  const minGap = 150;
  for (const p of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minGap)) continue;
    chosen.push(p);
  }

  // Top up with points along lines — these read as line endpoints/waypoints.
  let guard = 0;
  while (chosen.length < count && guard < 400) {
    guard++;
    const l = lines[seededInt(`${seed}-ep-l-${guard}`, 0, lines.length - 1)];
    const t = seededRange(`${seed}-ep-t-${guard}`, -1200, 1200);
    const p = {x: l.px + l.dx * t, y: l.py + l.dy * t};
    if (p.x < inset || p.x > WIDTH - inset) continue;
    if (p.y < inset || p.y > HEIGHT - inset) continue;
    if (chosen.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minGap)) continue;
    chosen.push(p);
  }

  return chosen.slice(0, count).map((p, i) => {
    const major = random(`${seed}-major-${i}`) < majorFraction;
    return {
      x: p.x,
      y: p.y,
      major,
      radius: major
        ? seededRange(`${seed}-r-${i}`, radiusMajor * 0.82, radiusMajor * 1.18)
        : seededRange(`${seed}-r-${i}`, radiusMinor * 0.7, radiusMinor * 1.3),
      period: seededRange(`${seed}-per-${i}`, 58, 165),
      phase: random(`${seed}-ph-${i}`) * Math.PI * 2,
    };
  });
};

/* --------------------------------------------------------------- contours */

export const buildContours = (seed: string): Contour[] => {
  const {count, points} = CONFIG.contours;
  const out: Contour[] = [];

  for (let i = 0; i < count; i++) {
    const closed = random(`${seed}-closed-${i}`) < 0.32;
    const pts: Pt[] = [];

    if (closed) {
      // A jittered ring: convex enough that it can never cross itself.
      const cx = seededRange(`${seed}-cx-${i}`, WIDTH * 0.06, WIDTH * 0.94);
      const cy = seededRange(`${seed}-cy-${i}`, HEIGHT * 0.06, HEIGHT * 0.94);
      const rx = seededRange(`${seed}-rx-${i}`, 190, 620);
      const ry = rx * seededRange(`${seed}-ry-${i}`, 0.5, 1.15);
      const n = points;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const wob = seededRange(`${seed}-w-${i}-${k}`, 0.82, 1.18);
        pts.push({x: cx + Math.cos(a) * rx * wob, y: cy + Math.sin(a) * ry * wob});
      }
    } else {
      // A monotone left-to-right sweep with vertical wander: also self-avoiding.
      const y0 = seededRange(`${seed}-y0-${i}`, -HEIGHT * 0.1, HEIGHT * 1.1);
      const amp = seededRange(`${seed}-amp-${i}`, 90, 420);
      const n = points + seededInt(`${seed}-n-${i}`, 0, 3);
      const startX = -WIDTH * 0.12;
      const span = WIDTH * 1.24;
      let y = y0;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        y += seededRange(`${seed}-dy-${i}-${k}`, -amp, amp) * 0.5;
        pts.push({x: startX + span * t, y});
      }
    }

    out.push({
      points: pts,
      closed,
      driftPhase: random(`${seed}-dp-${i}`) * Math.PI * 2,
      driftScale: seededRange(`${seed}-ds-${i}`, 0.5, 1.4),
      opacity: seededRange(`${seed}-op-${i}`, 0.5, 1),
    });
  }

  return out;
};

/* --------------------------------------------------------------- callouts */

export const buildCallouts = (seed: string, nodes: Node[]): Callout[] => {
  const {count, bigNumberCount} = CONFIG.callouts;
  const out: Callout[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    let nodeIndex = seededInt(`${seed}-n-${i}`, 0, nodes.length - 1);
    let guard = 0;
    while (used.has(nodeIndex) && guard++ < 40) {
      nodeIndex = seededInt(`${seed}-n-${i}-${guard}`, 0, nodes.length - 1);
    }
    used.add(nodeIndex);
    const node = nodes[nodeIndex];

    const side: -1 | 1 = random(`${seed}-side-${i}`) < 0.5 ? -1 : 1;
    const dx = seededRange(`${seed}-dx-${i}`, 230, 520) * side;
    const dy = seededRange(`${seed}-dy-${i}`, 90, 330) * (random(`${seed}-dyS-${i}`) < 0.4 ? -1 : 1);

    const long = random(`${seed}-long-${i}`) < 0.5;
    out.push({
      x: Math.max(70, Math.min(WIDTH - 640, node.x + dx)),
      y: Math.max(120, Math.min(HEIGHT - 260, node.y + dy)),
      nodeIndex,
      side,
      lineCount: long ? seededInt(`${seed}-lines-${i}`, 4, 6) : 1,
      headerSeed: `${seed}-head-${i}`,
      bodySeed: `${seed}-body-${i}`,
      bigNumber: i < bigNumberCount ? String(seededInt(`${seed}-big-${i}`, 11, 97)) : null,
    });
  }
  return out;
};

/* ------------------------------------------------------------------ stars */

export const buildStars = (seed: string): Star[] => {
  const {count, radiusMin, radiusMax} = CONFIG.stars;
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: seededRange(`${seed}-x-${i}`, 0, WIDTH),
      y: seededRange(`${seed}-y-${i}`, 0, HEIGHT),
      r: seededRange(`${seed}-r-${i}`, radiusMin, radiusMax),
      alpha: seededRange(`${seed}-a-${i}`, 0.25, 1),
      period: seededRange(`${seed}-p-${i}`, 90, 320),
      phase: random(`${seed}-ph-${i}`) * Math.PI * 2,
    });
  }
  return out;
};

/* ------------------------------------------------- fictional callout text */

const HEAD_WORDS = ["SECTOR", "ARRAY", "LATTICE", "VECTOR", "CHANNEL", "SEGMENT", "RELAY"];
const KEYS = [
  "grid_ref",
  "seq_delta",
  "band_idx",
  "phase_lock",
  "carrier",
  "sample_win",
  "drift_corr",
  "parity_set",
  "frame_tag",
  "gain_bias",
];
const VERBS = ["sync", "hold", "trace", "align", "commit", "resolve", "sample"];
const STATES = ["ok", "nominal", "held", "queued", "locked", "idle"];

const groupNumber = (seed: string): string =>
  `${seededInt(`${seed}-a`, 10, 99)}.${seededInt(`${seed}-b`, 10, 99)}.${seededInt(
    `${seed}-c`,
    100,
    999,
  )}.${seededInt(`${seed}-d`, 10, 99)}`;

/**
 * Invented technical fragments. Deliberately not real place names and not
 * coordinates that resolve to anywhere: the group numbers are four arbitrary
 * fields, and the labels are made-up subsystem names.
 */
export const calloutHeader = (seed: string, epoch: number): string =>
  `${seededPick(`${seed}-w-${epoch}`, HEAD_WORDS)}  ${groupNumber(`${seed}-g-${epoch}`)}`;

export const calloutLine = (seed: string, index: number, epoch: number): string => {
  const s = `${seed}-${index}-${epoch}`;
  const kind = seededInt(`${s}-k`, 0, 3);
  const key = seededPick(`${s}-key`, KEYS);
  if (kind === 0) {
    return `${key} = 0x${seededInt(`${s}-h`, 4096, 65535).toString(16).toUpperCase()}`;
  }
  if (kind === 1) {
    return `${key} -> ${seededPick(`${s}-v`, VERBS)}.${seededPick(`${s}-st`, STATES)}`;
  }
  if (kind === 2) {
    return `${key}[${seededInt(`${s}-i`, 0, 15)}]  ${(
      seededRange(`${s}-f`, -1, 1)
    ).toFixed(4)}`;
  }
  return `${seededPick(`${s}-w`, HEAD_WORDS).toLowerCase()}_${seededInt(
    `${s}-n`,
    100,
    999,
  )}  ${groupNumber(`${s}-g`)}`;
};
