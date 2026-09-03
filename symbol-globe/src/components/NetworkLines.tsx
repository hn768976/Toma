/**
 * The lattice behind everything.
 *
 * Long, gently bowed lines running off every edge, most at shallow angles with
 * a few steep ones for variety. They are meant to read as texture, not as a
 * mesh: the eye should never be able to trace a node-to-node graph out of them.
 * The alpha range below was halved from a first pass that read as a subject in
 * its own right; at this level the lattice is felt more than seen.
 * Both endpoints and the bow's control point drift on closed paths, so the
 * lattice breathes without any line ever arriving somewhere new at frame 450.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { closedDrift, rand, randRange } from "../lib/seededRandom";
import { withAlpha } from "../lib/color";
import { useStageLayer } from "../stage/CanvasStage";
import { DESIGN_HEIGHT } from "../config";
import type { Palette } from "../variants";

/** Fraction of lines that run top-to-bottom rather than edge-to-edge. */
const STEEP_SHARE = 0.25;

type Line = {
  seed: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Perpendicular bow, as a fraction of the line's length. */
  bow: number;
  alpha: number;
};

/**
 * Endpoints are placed beyond the frame so no line ever shows a loose end.
 * Positions are in normalised frame coordinates.
 */
const buildLines = (count: number): Line[] => {
  const lines: Line[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `net-${i}`;
    const steep = rand(`${seed}-steep`) < STEEP_SHARE;
    if (steep) {
      const x = randRange(`${seed}-x`, -0.05, 1.05);
      lines.push({
        seed,
        ax: x,
        ay: -0.08,
        bx: x + randRange(`${seed}-dx`, -0.3, 0.3),
        by: 1.08,
        bow: randRange(`${seed}-bow`, -0.022, 0.022),
        alpha: randRange(`${seed}-a`, 0.09, 0.21),
      });
    } else {
      const y = randRange(`${seed}-y`, -0.06, 1.06);
      lines.push({
        seed,
        ax: -0.08,
        ay: y,
        bx: 1.08,
        by: y + randRange(`${seed}-dy`, -0.34, 0.34),
        bow: randRange(`${seed}-bow`, -0.02, 0.02),
        alpha: randRange(`${seed}-a`, 0.09, 0.21),
      });
    }
  }
  return lines;
};

export type NetworkLinesProps = {
  palette: Palette;
  count: number;
  opacity: number;
  /**
   * Frames in one full loop. Passed explicitly rather than read from the
   * composition so the same component can be rendered past the end of its loop
   * (frame 450 of a 450-frame cycle) to prove the loop actually closes.
   */
  loopLength: number;
  z: number;
};

export const NetworkLines: React.FC<NetworkLinesProps> = ({
  palette,
  count,
  opacity,
  loopLength,
  z,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lines = useMemo(() => buildLines(count), [count]);
  const scale = height / DESIGN_HEIGHT;

  const draw = (ctx: CanvasRenderingContext2D) => {
    const t = frame / loopLength;
    ctx.lineWidth = 2.5 * scale;
    ctx.lineCap = "round";
    for (const line of lines) {
      const driftA = closedDrift(`${line.seed}-a`, t, width * 0.02, height * 0.03, 2);
      const driftB = closedDrift(`${line.seed}-b`, t, width * 0.02, height * 0.03, 2);
      const ax = line.ax * width + driftA.x;
      const ay = line.ay * height + driftA.y;
      const bx = line.bx * width + driftB.x;
      const by = line.by * height + driftB.y;
      // Bow the line by pushing its midpoint along the perpendicular, so it is
      // straight enough to read as a lattice but never mechanically so.
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const cxp = mx + (-dy / len) * line.bow * len;
      const cyp = my + (dx / len) * line.bow * len;

      ctx.strokeStyle = withAlpha(
        palette.networkLine,
        Math.min(1, line.alpha * opacity),
      );
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cxp, cyp, bx, by);
      ctx.stroke();
    }
  };

  useStageLayer({ id: "network-lines", z, draw });
  return null;
};
