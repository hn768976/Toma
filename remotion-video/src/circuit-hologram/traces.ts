import {
  BOARD_CENTER_X,
  BOARD_CENTER_Y,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  NODE_COLORS,
  PULSE_COLORS,
  TRACE_BRIGHT_COLOR,
  TRACE_COLOR,
} from "./constants";
import { pathFromPoints, polylineLength, type Point } from "./geometry";
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

// Keep-out ellipse around the hologram so traces stop at its edge
// instead of running straight through it.
const KEEP_OUT_RX = 520;
const KEEP_OUT_RY = 420;

export const generateBoard = (seed: number): BoardData => {
  const rng = mulberry32(seed);
  const traces: Trace[] = [];
  const vias: Point[] = [];
  let id = 0;

  // Horizontal bundles: bands of 3..7 parallel lanes sharing jogs, like
  // a real PCB bus. They enter from the left (off-board) and run right.
  const bundleCount = 13;
  for (let b = 0; b < bundleCount; b++) {
    const laneCount = intFrom(rng, 3, 7);
    const spacing = rangeFrom(rng, 15, 22);
    const centerY = rangeFrom(rng, 120, BOARD_HEIGHT - 120);
    const jogCount = intFrom(rng, 1, 4);
    const jogs: Jog[] = [];
    for (let j = 0; j < jogCount; j++) {
      jogs.push({ at: rangeFrom(rng, 200, BOARD_WIDTH - 500), delta: rangeFrom(rng, 60, 220) * (rng() < 0.5 ? -1 : 1) });
    }
    jogs.sort((p, q) => p.at - q.at);
    const bright = rng() < 0.4;
    for (let l = 0; l < laneCount; l++) {
      const y = centerY + (l - (laneCount - 1) / 2) * spacing;
      const start = rangeFrom(rng, -400, 300);
      let end = rangeFrom(rng, BOARD_WIDTH * 0.4, BOARD_WIDTH + 300);
      // Clip lanes that would cross the hologram keep-out.
      const crosses = Math.abs(y - BOARD_CENTER_Y) < KEEP_OUT_RY;
      let padAtEnd = rng() < 0.45;
      if (crosses) {
        const dx = KEEP_OUT_RX * Math.sqrt(1 - ((y - BOARD_CENTER_Y) / KEEP_OUT_RY) ** 2);
        const stopX = BOARD_CENTER_X - dx - rangeFrom(rng, 10, 90);
        if (end > stopX) {
          end = stopX;
          padAtEnd = true;
        }
      }
      if (end - start < 300) continue;
      const points = buildLane("x", start, end, y, jogs);
      traces.push(
        finishTrace(rng, id++, points, {
          bright: bright || rng() < 0.15,
          padAtEnd,
          towardsStart: false,
          pulseCount: intFrom(rng, 1, 3),
        }),
      );
    }
  }

  // Vertical bundles (the perpendicular set), fewer and shorter.
  const vBundleCount = 9;
  for (let b = 0; b < vBundleCount; b++) {
    const laneCount = intFrom(rng, 2, 5);
    const spacing = rangeFrom(rng, 15, 22);
    const centerX = rangeFrom(rng, 150, BOARD_WIDTH - 150);
    const jogCount = intFrom(rng, 0, 3);
    const jogs: Jog[] = [];
    for (let j = 0; j < jogCount; j++) {
      jogs.push({ at: rangeFrom(rng, 200, BOARD_HEIGHT - 400), delta: rangeFrom(rng, 50, 180) * (rng() < 0.5 ? -1 : 1) });
    }
    jogs.sort((p, q) => p.at - q.at);
    const downwards = rng() < 0.5;
    for (let l = 0; l < laneCount; l++) {
      const x = centerX + (l - (laneCount - 1) / 2) * spacing;
      const start = downwards ? rangeFrom(rng, -300, 200) : BOARD_HEIGHT + rangeFrom(rng, -200, 300);
      let end = downwards ? rangeFrom(rng, BOARD_HEIGHT * 0.35, BOARD_HEIGHT + 200) : rangeFrom(rng, -200, BOARD_HEIGHT * 0.65);
      let padAtEnd = rng() < 0.5;
      const crosses = Math.abs(x - BOARD_CENTER_X) < KEEP_OUT_RX;
      if (crosses) {
        const dy = KEEP_OUT_RY * Math.sqrt(1 - ((x - BOARD_CENTER_X) / KEEP_OUT_RX) ** 2);
        if (downwards) {
          const stopY = BOARD_CENTER_Y - dy - rangeFrom(rng, 10, 80);
          if (end > stopY) {
            end = stopY;
            padAtEnd = true;
          }
        } else {
          const stopY = BOARD_CENTER_Y + dy + rangeFrom(rng, 10, 80);
          if (end < stopY) {
            end = stopY;
            padAtEnd = true;
          }
        }
      }
      if (Math.abs(end - start) < 250) continue;
      const points = buildLane("y", start, end, x, jogs);
      traces.push(
        finishTrace(rng, id++, points, {
          bright: rng() < 0.3,
          padAtEnd,
          towardsStart: false,
          pulseCount: intFrom(rng, 1, 2),
        }),
      );
    }
  }

  // Feeder traces: short runs from the hologram edge outwards, so light
  // packets are seen arriving at / leaving the hologram in every
  // direction, as in the reference.
  const feeders = 26;
  for (let f = 0; f < feeders; f++) {
    const side = f % 4; // 0 right, 1 left, 2 down, 3 up
    const offset = rangeFrom(rng, -320, 320);
    const gap = rangeFrom(rng, 40, 140);
    const run = rangeFrom(rng, 500, 1500);
    const jogs: Jog[] = [];
    if (rng() < 0.7) {
      jogs.push({ at: 0, delta: rangeFrom(rng, 40, 160) * (rng() < 0.5 ? -1 : 1) });
    }
    let points: Point[];
    if (side === 0 || side === 1) {
      const y = BOARD_CENTER_Y + offset;
      const dx = KEEP_OUT_RX * Math.sqrt(1 - (offset / KEEP_OUT_RY) ** 2) * 0.8;
      const startX = side === 0 ? BOARD_CENTER_X + dx + gap : BOARD_CENTER_X - dx - gap;
      const endX = side === 0 ? startX + run : startX - run;
      const dir = side === 0 ? 1 : -1;
      jogs.forEach((j) => (j.at = startX + dir * rangeFrom(rng, 120, 400)));
      points = buildLane("x", startX, endX, y, jogs);
    } else {
      const x = BOARD_CENTER_X + offset;
      const dy = KEEP_OUT_RY * Math.sqrt(1 - (offset / KEEP_OUT_RX) ** 2) * 0.8;
      const startY = side === 2 ? BOARD_CENTER_Y + dy + gap : BOARD_CENTER_Y - dy - gap;
      const endY = side === 2 ? startY + run : startY - run;
      const dir = side === 2 ? 1 : -1;
      jogs.forEach((j) => (j.at = startY + dir * rangeFrom(rng, 120, 400)));
      points = buildLane("y", startY, endY, x, jogs);
    }
    // Reverse so the "end" (pad) is the hologram side and pulses travel in.
    const towardsHologram = rng() < 0.65;
    const ordered = points.slice().reverse();
    traces.push(
      finishTrace(rng, id++, ordered, {
        bright: rng() < 0.5,
        padAtEnd: true,
        towardsStart: !towardsHologram,
        pulseCount: intFrom(rng, 1, 2),
      }),
    );
  }

  // Scattered vias / solder dots for texture.
  for (let v = 0; v < 260; v++) {
    vias.push({ x: rangeFrom(rng, 0, BOARD_WIDTH), y: rangeFrom(rng, 0, BOARD_HEIGHT) });
  }

  return { traces, vias };
};
