import { cubicAngleAt, cubicAt, type Pt } from "../shared/paths";
import { FORK, PIPE_LAYOUT, STAGES } from "./data";

/** Vertical centre of the stage cards — the line every job travels along. */
export const RAIL_Y = PIPE_LAYOUT.cardY + PIPE_LAYOUT.cardH / 2;

const DECISION = STAGES.find((s) => s.id === "decision")!;
const EXECUTION = STAGES.find((s) => s.id === "execution")!;

export const DIAMOND_W = 150;
export const DIAMOND_H = 116;

const RAIL_START = 96;
const RAIL_END = 1836;
const FORK_IN = DECISION.cx + DIAMOND_W / 2;
const FORK_OUT = EXECUTION.cx - PIPE_LAYOUT.cardW / 2;

type Seg =
  | { kind: "line"; from: Pt; to: Pt; len: number }
  | { kind: "curve"; p0: Pt; c1: Pt; c2: Pt; p1: Pt; len: number };

const line = (from: Pt, to: Pt): Seg => ({
  kind: "line",
  from,
  to,
  len: Math.hypot(to.x - from.x, to.y - from.y),
});

/** Rough arc length by flat sampling — enough to keep packet speed even. */
const curve = (p0: Pt, c1: Pt, c2: Pt, p1: Pt): Seg => {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= 16; i++) {
    const p = cubicAt(p0, c1, c2, p1, i / 16);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return { kind: "curve", p0, c1, c2, p1, len };
};

/** One branch of the fork: rail out, over the pill, back to the rail. */
const forkBranch = (branchY: number): Seg[] => {
  const a = { x: FORK_IN, y: RAIL_Y };
  const mid1 = { x: FORK.cx - FORK.width / 2, y: branchY };
  const mid2 = { x: FORK.cx + FORK.width / 2, y: branchY };
  const b = { x: FORK_OUT, y: RAIL_Y };
  const rise = branchY - RAIL_Y;
  return [
    curve(
      a,
      { x: a.x + 34, y: a.y + rise * 0.22 },
      { x: mid1.x - 44, y: branchY },
      mid1,
    ),
    line(mid1, mid2),
    curve(
      mid2,
      { x: mid2.x + 44, y: branchY },
      { x: b.x - 34, y: b.y + rise * 0.22 },
      b,
    ),
  ];
};

export const APPROVE_SEGS = forkBranch(FORK.approveY);
export const ESCALATE_SEGS = forkBranch(FORK.escalateY);

/** Full journey of a job: entry rail, fork branch, exit rail. */
const buildRoute = (branch: Seg[]): Seg[] => [
  line({ x: RAIL_START, y: RAIL_Y }, { x: FORK_IN, y: RAIL_Y }),
  ...branch,
  line({ x: FORK_OUT, y: RAIL_Y }, { x: RAIL_END, y: RAIL_Y }),
];

export const ROUTES = {
  approve: buildRoute(APPROVE_SEGS),
  escalate: buildRoute(ESCALATE_SEGS),
};

/** Position and heading at normalised distance `u` along a route. */
export const routeAt = (segs: Seg[], u: number): Pt & { angle: number } => {
  const total = segs.reduce((s, seg) => s + seg.len, 0);
  let target = Math.max(0, Math.min(1, u)) * total;
  for (const seg of segs) {
    if (target > seg.len && seg !== segs[segs.length - 1]) {
      target -= seg.len;
      continue;
    }
    const t = Math.max(0, Math.min(1, target / seg.len));
    if (seg.kind === "line") {
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * t,
        y: seg.from.y + (seg.to.y - seg.from.y) * t,
        angle: (Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x) * 180) / Math.PI,
      };
    }
    const p = cubicAt(seg.p0, seg.c1, seg.c2, seg.p1, t);
    return { ...p, angle: cubicAngleAt(seg.p0, seg.c1, seg.c2, seg.p1, t) };
  }
  return { x: RAIL_END, y: RAIL_Y, angle: 0 };
};

/** SVG path data for a segment list, for drawing the fork guides. */
export const segsToPath = (segs: Seg[]): string => {
  const head = segs[0];
  const start = head.kind === "line" ? head.from : head.p0;
  const parts = [`M ${start.x} ${start.y}`];
  for (const seg of segs) {
    parts.push(
      seg.kind === "line"
        ? `L ${seg.to.x} ${seg.to.y}`
        : `C ${seg.c1.x} ${seg.c1.y} ${seg.c2.x} ${seg.c2.y} ${seg.p1.x} ${seg.p1.y}`,
    );
  }
  return parts.join(" ");
};

export { FORK_IN, FORK_OUT, RAIL_START, RAIL_END };
