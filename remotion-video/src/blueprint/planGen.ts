import { mulberry32, pick, range, type Rng } from "./rng";

/**
 * Procedural architectural floor plan.
 *
 * Plan space is measured in inches. The layout comes from a binary space
 * partition: every internal node of the BSP tree contributes exactly one wall
 * segment spanning its parent rectangle, and every leaf is a room. That gives
 * a wall graph with no duplicate or overlapping segments, which matters
 * because the walls are drawn as double lines with door openings punched
 * through them.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type Opening = {
  /** Distance along the segment, from its start point. */
  at: number;
  len: number;
  kind: "door" | "window";
  /** Which side the door leaf swings to. */
  swing: 1 | -1;
  /** Which end of the opening the door is hinged on. */
  hinge: 0 | 1;
};

export type WallSeg = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vertical: boolean;
  exterior: boolean;
  /** Load-bearing runs are drawn brighter and heavier than partitions, which
   *  is what gives the plan its sense of depth rather than a flat mesh. */
  heavy: boolean;
  openings: Opening[];
};

/** A fixture, closet or core drawn inside a room. */
export type Fixture = { x: number; y: number; w: number; h: number };

export type Room = {
  rect: Rect;
  /** Sequential tag shown in the room, e.g. 04. */
  index: number;
  kind: "room" | "stair" | "shaft";
  fixtures: Fixture[];
  /** Stair run direction; only meaningful for kind === "stair". */
  stairVertical: boolean;
};

/** A numeral drawn alongside a wall, rotated to run parallel with it. */
export type WallLabel = {
  x: number;
  y: number;
  angle: number;
  text: string;
  size: number;
  strong: boolean;
};

/** A dimension run: line, 45-degree slash ticks, extension whiskers, numeral. */
export type DimChain = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  vertical: boolean;
  /** Length of the extension whiskers back toward the thing being measured. */
  whisker: number;
  text: string;
};

export type Plan = {
  /** Outer boundary of the plan, in plan units. */
  bounds: Rect;
  walls: WallSeg[];
  rooms: Room[];
  labels: WallLabel[];
  chains: DimChain[];
};

/** Wall thickness in inches — the gap between the two parallel wall lines. */
export const WALL_T = 7;

const MIN_ROOM = 120;
const DOOR_W = 34;
const WINDOW_W = 62;
/** Snap every wall to a 6" grid so the dimension numerals come out tidy. */
const snap = (v: number) => Math.round(v / 6) * 6;

/** 246 -> 20'-6" */
export const feetInches = (inches: number) => {
  const total = Math.max(0, Math.round(inches));
  const ft = Math.floor(total / 12);
  const inch = total % 12;
  return inch === 0 ? `${ft}'-0"` : `${ft}'-${inch}"`;
};

/** Square inches -> "285 SF" */
export const squareFeet = (sqIn: number) => `${Math.round(sqIn / 144)} SF`;

/** Split position along a span, biased toward the middle so no child keeps
 *  almost the whole parent. */
const cutAt = (span: number, rng: Rng) => {
  const ratio = range(rng, 0.36, 0.64);
  return Math.min(span - MIN_ROOM, Math.max(MIN_ROOM, span * ratio));
};

const partition = (
  rect: Rect,
  depth: number,
  roomSize: number,
  rng: Rng,
  walls: WallSeg[],
  leaves: Rect[],
) => {
  const canV = rect.w >= MIN_ROOM * 2;
  const canH = rect.h >= MIN_ROOM * 2;

  if (!canV && !canH) {
    leaves.push(rect);
    return;
  }
  // Stop on footprint, not on tree depth: a fixed depth cap leaves whole
  // branches of the plan at wildly different room scales. The jittered
  // threshold is what gives the plan its mix of large and small rooms.
  if (depth >= 12 || rect.w * rect.h < roomSize * roomSize * range(rng, 0.8, 2.1)) {
    leaves.push(rect);
    return;
  }

  let vertical: boolean;
  if (canV && canH) {
    const ratio = rect.w / rect.h;
    vertical = ratio > 1.15 ? true : ratio < 0.87 ? false : rng() < 0.5;
  } else {
    vertical = canV;
  }

  if (vertical) {
    const cut = snap(rect.x + cutAt(rect.w, rng));
    walls.push({
      x1: cut,
      y1: rect.y,
      x2: cut,
      y2: rect.y + rect.h,
      vertical: true,
      exterior: false,
      heavy: rng() < 0.62,
      openings: [],
    });
    partition({ ...rect, w: cut - rect.x }, depth + 1, roomSize, rng, walls, leaves);
    partition(
      { x: cut, y: rect.y, w: rect.x + rect.w - cut, h: rect.h },
      depth + 1,
      roomSize,
      rng,
      walls,
      leaves,
    );
  } else {
    const cut = snap(rect.y + cutAt(rect.h, rng));
    walls.push({
      x1: rect.x,
      y1: cut,
      x2: rect.x + rect.w,
      y2: cut,
      vertical: false,
      exterior: false,
      heavy: rng() < 0.62,
      openings: [],
    });
    partition({ ...rect, h: cut - rect.y }, depth + 1, roomSize, rng, walls, leaves);
    partition(
      { x: rect.x, y: cut, w: rect.w, h: rect.y + rect.h - cut },
      depth + 1,
      roomSize,
      rng,
      walls,
      leaves,
    );
  }
};

const segLength = (s: WallSeg) =>
  s.vertical ? Math.abs(s.y2 - s.y1) : Math.abs(s.x2 - s.x1);

/** Punch doors into interior walls and windows into the exterior shell. */
const addOpenings = (seg: WallSeg, rng: Rng) => {
  const len = segLength(seg);
  const margin = 26;
  if (seg.exterior) {
    const count = Math.min(4, Math.floor(len / 190));
    for (let i = 0; i < count; i++) {
      const slot = (len - margin * 2) / count;
      const at =
        margin + i * slot + range(rng, 0.22, 0.62) * (slot - WINDOW_W);
      if (at + WINDOW_W < len - margin) {
        seg.openings.push({ at, len: WINDOW_W, kind: "window", swing: 1, hinge: 0 });
      }
    }
    return;
  }
  const count = len > 460 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const slot = (len - margin * 2) / count;
    const at = margin + i * slot + range(rng, 0.18, 0.7) * (slot - DOOR_W);
    if (at > margin && at + DOOR_W < len - margin) {
      seg.openings.push({
        at,
        len: DOOR_W,
        kind: "door",
        swing: rng() < 0.5 ? 1 : -1,
        hinge: rng() < 0.5 ? 0 : 1,
      });
    }
  }
  seg.openings.sort((a, b) => a.at - b.at);
};

/**
 * Numerals hugging the walls, the way a drafted plan annotates each run.
 * `density` throttles how many appear so the lite theme reads calmer.
 */
const buildWallLabels = (walls: WallSeg[], rng: Rng, density: number) => {
  const labels: WallLabel[] = [];
  for (const seg of walls) {
    const len = segLength(seg);
    if (len < 150 || rng() > density) continue;
    const off = 26;
    const mid = 0.5;
    if (seg.vertical) {
      labels.push({
        x: seg.x1 - off,
        y: seg.y1 + (seg.y2 - seg.y1) * mid,
        angle: -90,
        text: feetInches(len),
        size: 18,
        strong: false,
      });
    } else {
      labels.push({
        x: seg.x1 + (seg.x2 - seg.x1) * mid,
        y: seg.y1 - off,
        angle: 0,
        text: feetInches(len),
        size: 18,
        strong: false,
      });
    }
  }
  return labels;
};

/**
 * Outer dimension runs: one chain per distinct wall gridline on each axis,
 * plus an overall run further out.
 */
const buildChains = (bounds: Rect, walls: WallSeg[]) => {
  const chains: DimChain[] = [];
  const xs = Array.from(
    new Set(walls.filter((w) => w.vertical).map((w) => w.x1)),
  ).sort((a, b) => a - b);
  const ys = Array.from(
    new Set(walls.filter((w) => !w.vertical).map((w) => w.y1)),
  ).sort((a, b) => a - b);

  const top = bounds.y - 86;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (b - a < 90) continue;
    chains.push({
      x1: a,
      y1: top,
      x2: b,
      y2: top,
      vertical: false,
      whisker: 74,
      text: feetInches(b - a),
    });
  }
  chains.push({
    x1: bounds.x,
    y1: bounds.y - 168,
    x2: bounds.x + bounds.w,
    y2: bounds.y - 168,
    vertical: false,
    whisker: 156,
    text: feetInches(bounds.w),
  });

  const left = bounds.x - 86;
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i];
    const b = ys[i + 1];
    if (b - a < 90) continue;
    chains.push({
      x1: left,
      y1: a,
      x2: left,
      y2: b,
      vertical: true,
      whisker: 74,
      text: feetInches(b - a),
    });
  }
  chains.push({
    x1: bounds.x - 168,
    y1: bounds.y,
    x2: bounds.x - 168,
    y2: bounds.y + bounds.h,
    vertical: true,
    whisker: 156,
    text: feetInches(bounds.h),
  });

  return chains;
};

export type PlanOptions = {
  seed: number;
  width: number;
  height: number;
  /** Target room footprint in inches; drives plan density. */
  roomSize: number;
  labelDensity: number;
  chains: boolean;
};

export const generatePlan = ({
  seed,
  width,
  height,
  roomSize,
  labelDensity,
  chains,
}: PlanOptions): Plan => {
  const rng = mulberry32(seed);
  const bounds: Rect = { x: 0, y: 0, w: width, h: height };

  const walls: WallSeg[] = [];
  const leaves: Rect[] = [];
  partition(bounds, 0, roomSize, rng, walls, leaves);

  // Exterior shell, added after the partition so it is never split.
  walls.push(
    { x1: 0, y1: 0, x2: width, y2: 0, vertical: false, exterior: true, heavy: true, openings: [] },
    { x1: 0, y1: height, x2: width, y2: height, vertical: false, exterior: true, heavy: true, openings: [] },
    { x1: 0, y1: 0, x2: 0, y2: height, vertical: true, exterior: true, heavy: true, openings: [] },
    { x1: width, y1: 0, x2: width, y2: height, vertical: true, exterior: true, heavy: true, openings: [] },
  );

  for (const seg of walls) {
    if (!seg.exterior && rng() < 0.2) {
      const keep = range(rng, 0.5, 0.78);
      if (seg.vertical) {
        const len = seg.y2 - seg.y1;
        if (rng() < 0.5) seg.y2 = seg.y1 + len * keep;
        else seg.y1 = seg.y2 - len * keep;
      } else {
        const len = seg.x2 - seg.x1;
        if (rng() < 0.5) seg.x2 = seg.x1 + len * keep;
        else seg.x1 = seg.x2 - len * keep;
      }
    }
  }

  for (const seg of walls) addOpenings(seg, rng);

  // Smallest elongated leaf becomes the stair; one other becomes a shaft.
  const sorted = [...leaves].sort(
    (a, b) => a.w * a.h - b.w * b.h,
  );
  const stairRect = sorted.find(
    (r) => Math.max(r.w, r.h) / Math.min(r.w, r.h) > 1.35,
  );
  const shaftRect = sorted.find((r) => r !== stairRect);

  const rooms: Room[] = leaves.map((rect, i) => {
    const kind: Room["kind"] =
      rect === stairRect ? "stair" : rect === shaftRect ? "shaft" : "room";
    const fixtures: Fixture[] = [];
    // Closets and service cores tucked into a corner, so room interiors are
    // not just empty boxes.
    if (kind === "room" && rect.w > 210 && rect.h > 210 && rng() < 0.42) {
      const fw = rect.w * range(rng, 0.2, 0.36);
      const fh = rect.h * range(rng, 0.18, 0.32);
      const right = rng() < 0.5;
      const bottom = rng() < 0.5;
      fixtures.push({
        x: right ? rect.x + rect.w - WALL_T / 2 - fw : rect.x + WALL_T / 2,
        y: bottom ? rect.y + rect.h - WALL_T / 2 - fh : rect.y + WALL_T / 2,
        w: fw,
        h: fh,
      });
    }
    return { rect, index: i + 1, kind, fixtures, stairVertical: rect.h > rect.w };
  });

  const labels = buildWallLabels(walls, rng, labelDensity);

  // Dimension runs tucked just inside a room's own walls. The reference is
  // full of these short interior chains; they carry most of the fine detail.
  const interiorChains: DimChain[] = [];
  if (chains) {
    for (const room of rooms) {
      const { x, y, w, h } = room.rect;
      if (w > 200 && rng() < 0.55) {
        const oy = y + 44 + rng() * 26;
        interiorChains.push({
          x1: x + 16, y1: oy, x2: x + w - 16, y2: oy,
          vertical: false, whisker: 0, text: feetInches(w - 32),
        });
      }
      if (h > 200 && rng() < 0.5) {
        const ox = x + 44 + rng() * 26;
        interiorChains.push({
          x1: ox, y1: y + 16, x2: ox, y2: y + h - 16,
          vertical: true, whisker: 0, text: feetInches(h - 32),
        });
      }
    }
  }

  // A handful of room-width dimension runs inside the plan, like the reference.
  for (const room of rooms) {
    if (room.kind !== "room") continue;
    if (rng() > labelDensity * 0.55) continue;
    const inset = 34;
    labels.push({
      x: room.rect.x + room.rect.w / 2,
      y: room.rect.y + room.rect.h / 2 + 4,
      angle: 0,
      text: pick(rng, [
        squareFeet(room.rect.w * room.rect.h),
        `AREA ${squareFeet(room.rect.w * room.rect.h)}`,
        `ROOM ${String(room.index).padStart(2, "0")}`,
      ]),
      size: 25,
      strong: true,
    });
    void inset;
  }

  return {
    bounds,
    walls,
    rooms,
    labels,
    chains: chains ? [...buildChains(bounds, walls), ...interiorChains] : [],
  };
};
