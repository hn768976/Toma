import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  NODE_COLORS,
  PULSE_COLORS,
  TRACE_BRIGHT_COLOR,
  TRACE_COLOR,
} from "./constants";
import { pathFromPoints, polygonCrossings, polylineLength, type Point } from "./geometry";
import { intFrom, mulberry32, pickFrom, pickWeighted, rangeFrom, type Rng } from "./random";

export type Pulse = {
  color: string;
  length: number; // board units
  speed: number; // board units per frame (negative = travels backwards)
  phase: number; // starting offset along the trace
  width: number;
};

export type Node = { p: Point; color: string; r: number; phase: number };

export type Trace = {
  id: number;
  d: string;
  length: number;
  width: number;
  color: string;
  pulses: Pulse[];
  pad: Point | null; // square pad at the far end
  nodes: Node[];
};

// PCB-style path: runs along one axis with occasional 45-degree jogs.
type Jog = { at: number; delta: number };

const buildLane = (
  axis: "x" | "y",
  startAlong: number,
  endAlong: number,
  across: number,
  jogs: Jog[],
): Point[] => {
  const toPoint = (along: number, acr: number): Point =>
    axis === "x" ? { x: along, y: acr } : { x: acr, y: along };
  const points: Point[] = [toPoint(startAlong, across)];
  let acr = across;
  const dir = endAlong >= startAlong ? 1 : -1;
  for (const jog of jogs) {
    const a0 = jog.at;
    const a1 = jog.at + Math.abs(jog.delta) * dir;
    if ((dir > 0 && (a0 <= startAlong || a1 >= endAlong)) || (dir < 0 && (a0 >= startAlong || a1 <= endAlong))) {
      continue;
    }
    points.push(toPoint(a0, acr));
    acr += jog.delta;
    points.push(toPoint(a1, acr));
  }
  points.push(toPoint(endAlong, acr));
  return points;
};

const makePulses = (rng: Rng, length: number, count: number, towardsStart: boolean): Pulse[] => {
  const pulses: Pulse[] = [];
  for (let i = 0; i < count; i++) {
    const palette = pickWeighted(rng, PULSE_COLORS);
    const speed = rangeFrom(rng, 9, 22) * (towardsStart ? -1 : 1);
    pulses.push({
      color: palette.color,
      length: rangeFrom(rng, 60, 260),
      speed,
      phase: rng() * (length + 300),
      width: rangeFrom(rng, 3.5, 6),
    });
  }
  return pulses;
};

const finishTrace = (
  rng: Rng,
  id: number,
  points: Point[],
  opts: { bright: boolean; padAtEnd: boolean; towardsStart: boolean; pulseCount: number },
): Trace => {
  const length = polylineLength(points);
  const nodes: Node[] = [];
  // Glowing dots on some corners and the pad.
  for (let i = 1; i < points.length - 1; i++) {
    if (rng() < 0.28) {
      nodes.push({
        p: points[i],
        color: pickFrom(rng, NODE_COLORS),
        r: rangeFrom(rng, 5, 9),
        phase: rng() * Math.PI * 2,
      });
    }
  }
  const end = points[points.length - 1];
  if (opts.padAtEnd && rng() < 0.7) {
    nodes.push({ p: end, color: pickFrom(rng, NODE_COLORS), r: rangeFrom(rng, 6, 10), phase: rng() * 6.28 });
  }
  return {
    id,
    d: pathFromPoints(points, false),
    length,
    width: opts.bright ? rangeFrom(rng, 3.2, 4.2) : rangeFrom(rng, 2, 3),
    color: opts.bright ? TRACE_BRIGHT_COLOR : TRACE_COLOR,
    pulses: makePulses(rng, length, opts.pulseCount, opts.towardsStart),
    pad: opts.padAtEnd ? end : null,
    nodes,
  };
};

export type BoardData = { traces: Trace[]; vias: Point[] };

const GAP_MIN = 4;
const GAP_MAX = 26;

type Axis = "x" | "y";

// Routes one bundle of parallel lanes towards the hub: lanes get a final
// steering jog so they land inside the hub's band on the other axis, then
// either stop at the hub's edge (pad) or run underneath and out the far
// side. Returns the finished traces.
const routeBundle = (
  rng: Rng,
  hub: Point[],
  axis: Axis,
  opts: {
    laneCount: number;
    spacing: number;
    centerAcross: number;
    fromLow: boolean; // enters from the low end of the axis (left / top)
    jogs: Jog[];
    hubMinAlong: number;
    hubMaxAlong: number;
    hubMinAcross: number;
    hubMaxAcross: number;
    boardAlong: number;
    passUnderChance: number;
    brightChance: number;
    maxPulses: number;
    nextId: () => number;
  },
): Trace[] => {
  const out: Trace[] = [];
  const targetAcross = rangeFrom(rng, opts.hubMinAcross + 30, opts.hubMaxAcross - 20);
  const bright = rng() < opts.brightChance;
  for (let l = 0; l < opts.laneCount; l++) {
    const laneOffset = (l - (opts.laneCount - 1) / 2) * opts.spacing;
    const across = opts.centerAcross + laneOffset;
    const laneJogs = opts.jogs.map((j) => ({ ...j }));
    const preAcross = laneJogs.reduce((acc, j) => acc + j.delta, across);
    const steer = targetAcross + laneOffset - preAcross;
    const steerAt = opts.fromLow
      ? opts.hubMinAlong - Math.abs(steer) - rangeFrom(rng, 120, 520)
      : opts.hubMaxAlong + rangeFrom(rng, 120, 520);
    laneJogs.push({ at: steerAt, delta: steer });
    const finalAcross = targetAcross + laneOffset;
    const crossings = polygonCrossings(hub, axis, finalAcross);
    if (crossings.length < 2) continue;
    const passUnder = rng() < opts.passUnderChance;
    let start: number;
    let end: number;
    if (opts.fromLow) {
      start = rangeFrom(rng, -500, 100);
      end = passUnder
        ? crossings[crossings.length - 1] + rangeFrom(rng, 200, 900)
        : crossings[0] - rangeFrom(rng, GAP_MIN, GAP_MAX);
      laneJogs.sort((p, q) => p.at - q.at);
    } else {
      start = opts.boardAlong + rangeFrom(rng, -100, 500);
      end = passUnder
        ? crossings[0] - rangeFrom(rng, 200, 900)
        : crossings[crossings.length - 1] + rangeFrom(rng, GAP_MIN, GAP_MAX);
      laneJogs.sort((p, q) => q.at - p.at);
    }
    const points = buildLane(axis, start, end, across, laneJogs);
    out.push(
      finishTrace(rng, opts.nextId(), points, {
        bright: bright || rng() < 0.15,
        padAtEnd: !passUnder,
        towardsStart: rng() < 0.3,
        pulseCount: intFrom(rng, 1, opts.maxPulses),
      }),
    );
  }
  return out;
};

// The board is generated around a "hub" polygon (the cloud / chip
// outline in board coordinates). Every trace is routed to the hub: it
// either terminates at the hub's edge with a pad, or runs underneath it
// and out the other side. Nothing just wanders past.
export const generateBoard = (seed: number, hub: Point[]): BoardData => {
  const rng = mulberry32(seed);
  const traces: Trace[] = [];
  const vias: Point[] = [];
  let id = 0;
  const nextId = () => id++;

  const hubMinY = Math.min(...hub.map((p) => p.y));
  const hubMaxY = Math.max(...hub.map((p) => p.y));
  const hubMinX = Math.min(...hub.map((p) => p.x));
  const hubMaxX = Math.max(...hub.map((p) => p.x));

  // Horizontal bundles; two thirds enter from the left like the reference.
  for (let b = 0; b < 16; b++) {
    const jogs: Jog[] = [];
    const jogCount = intFrom(rng, 1, 3);
    for (let j = 0; j < jogCount; j++) {
      jogs.push({ at: rangeFrom(rng, 200, BOARD_WIDTH - 500), delta: rangeFrom(rng, 60, 220) * (rng() < 0.5 ? -1 : 1) });
    }
    traces.push(
      ...routeBundle(rng, hub, "x", {
        laneCount: intFrom(rng, 3, 7),
        spacing: rangeFrom(rng, 15, 22),
        // Bundles start near the hub's band so the steering jogs stay short.
        centerAcross: Math.min(BOARD_HEIGHT - 80, Math.max(80, (hubMinY + hubMaxY) / 2 + rangeFrom(rng, -1000, 1000))),
        fromLow: b % 3 !== 2,
        jogs,
        hubMinAlong: hubMinX,
        hubMaxAlong: hubMaxX,
        hubMinAcross: hubMinY,
        hubMaxAcross: hubMaxY,
        boardAlong: BOARD_WIDTH,
        passUnderChance: 0.22,
        brightChance: 0.4,
        maxPulses: 3,
        nextId,
      }),
    );
  }

  // Vertical bundles.
  for (let b = 0; b < 10; b++) {
    const jogs: Jog[] = [];
    const jogCount = intFrom(rng, 0, 2);
    for (let j = 0; j < jogCount; j++) {
      jogs.push({ at: rangeFrom(rng, 200, BOARD_HEIGHT - 400), delta: rangeFrom(rng, 50, 180) * (rng() < 0.5 ? -1 : 1) });
    }
    traces.push(
      ...routeBundle(rng, hub, "y", {
        laneCount: intFrom(rng, 2, 5),
        spacing: rangeFrom(rng, 15, 22),
        centerAcross: Math.min(BOARD_WIDTH - 100, Math.max(100, (hubMinX + hubMaxX) / 2 + rangeFrom(rng, -1500, 1500))),
        fromLow: rng() < 0.5,
        jogs,
        hubMinAlong: hubMinY,
        hubMaxAlong: hubMaxY,
        hubMinAcross: hubMinX,
        hubMaxAcross: hubMaxX,
        boardAlong: BOARD_HEIGHT,
        passUnderChance: 0.2,
        brightChance: 0.3,
        maxPulses: 2,
        nextId,
      }),
    );
  }

  // Short feeders that start right at the hub edge and run outwards, so
  // light packets are seen arriving at / leaving the hologram all round.
  for (let f = 0; f < 30; f++) {
    const side = f % 4; // 0 right, 1 left, 2 down, 3 up
    const run = rangeFrom(rng, 400, 1400);
    const jogs: Jog[] = [];
    if (rng() < 0.7) jogs.push({ at: 0, delta: rangeFrom(rng, 40, 160) * (rng() < 0.5 ? -1 : 1) });
    let points: Point[];
    if (side === 0 || side === 1) {
      const y = rangeFrom(rng, hubMinY + 20, hubMaxY - 10);
      const crossings = polygonCrossings(hub, "x", y);
      if (crossings.length < 2) continue;
      const startX = side === 0 ? crossings[crossings.length - 1] + rangeFrom(rng, GAP_MIN, 14) : crossings[0] - rangeFrom(rng, GAP_MIN, 14);
      const endX = side === 0 ? startX + run : startX - run;
      const dir = side === 0 ? 1 : -1;
      jogs.forEach((j) => (j.at = startX + dir * rangeFrom(rng, 120, 400)));
      points = buildLane("x", startX, endX, y, jogs);
    } else {
      const x = rangeFrom(rng, hubMinX + 30, hubMaxX - 30);
      const crossings = polygonCrossings(hub, "y", x);
      if (crossings.length < 2) continue;
      const startY = side === 2 ? crossings[crossings.length - 1] + rangeFrom(rng, GAP_MIN, 14) : crossings[0] - rangeFrom(rng, GAP_MIN, 14);
      const endY = side === 2 ? startY + run : startY - run;
      const dir = side === 2 ? 1 : -1;
      jogs.forEach((j) => (j.at = startY + dir * rangeFrom(rng, 120, 400)));
      points = buildLane("y", startY, endY, x, jogs);
    }
    const towardsHologram = rng() < 0.65;
    traces.push(
      finishTrace(rng, nextId(), points.slice().reverse(), {
        bright: rng() < 0.5,
        padAtEnd: true,
        towardsStart: !towardsHologram,
        pulseCount: intFrom(rng, 1, 2),
      }),
    );
  }

  for (let v = 0; v < 260; v++) {
    vias.push({ x: rangeFrom(rng, 0, BOARD_WIDTH), y: rangeFrom(rng, 0, BOARD_HEIGHT) });
  }

  return { traces, vias };
};
