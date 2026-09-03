/**
 * <BlockCluster> — v3's element: upright blocks standing on the corridor's
 * planes, like a city seen at low level.
 *
 * Blocks stand rather than lie flat, and they arrive in clusters — dense
 * groups with gaps between them, because evenly spaced blocks read as a chart.
 * Each is a flat filled rectangle with a brighter top edge and a soft glow
 * above it; there is no 3D shading, the perspective comes entirely from scale
 * and position. A small warm minority draws the eye through the depth, and the
 * ceiling plane carries a mirrored, dimmer copy of the same field so the
 * corridor reads as enclosed.
 */
import React, { useMemo } from "react";
import { mixRgba, rgba } from "../lib/color";
import { TAU } from "../lib/math";
import { Plane } from "../lib/perspective";
import { randChance, randInt, randRange } from "../lib/seededRandom";
import {
  CorridorElement,
  ElementRenderer,
  useCorridorGroup,
} from "./PerspectiveCorridor";

export interface BlockElement extends CorridorElement {
  /** Half-width across the corridor, in lane units. */
  laneW: number;
  /** Block height as a fraction of frame height at d = 1. */
  heightUnit: number;
  warm: boolean;
  lit: boolean;
  alpha: number;
  phase: number;
  /** Flicker depth, 0 = steady. */
  flicker: number;
}

export const renderBlockCluster: ElementRenderer<BlockElement> = (
  ctx,
  el,
  p,
  api,
) => {
  const { geo, palette } = api;
  const up = el.plane === "ceiling" ? 1 : -1;

  const left = api.point(el.lane - el.laneW, p.d, el.plane);
  const right = api.point(el.lane + el.laneW, p.d, el.plane);
  const w = Math.abs(right.x - left.x);
  if (w < 0.6) return;
  const h = el.heightUnit * geo.height * p.d;
  if (h < 1.2) return;

  const x = Math.min(left.x, right.x);
  const yBase = p.y;
  const yTop = yBase + up * h;
  if (x + w < -geo.width * 0.1 || x > geo.width * 1.1) return;

  // Mask on whichever end of the block is nearest the clear band.
  const bandY = Math.min(
    Math.max(geo.bandCenterY, Math.min(yBase, yTop)),
    Math.max(yBase, yTop),
  );
  const flick =
    1 - el.flicker + el.flicker * (0.5 + 0.5 * Math.sin((api.frame / api.loop + el.phase) * TAU * 5));
  const a = p.fade * api.band(bandY) * el.alpha * flick;
  if (a < 0.008) return;

  const body = el.warm
    ? palette.blockWarm
    : el.lit
      ? mixRgba(palette.blockFill, palette.blockBright, 0.45, 1)
      : palette.blockFill;
  const edge = el.warm ? palette.blockWarm : palette.blockBright;

  // Body.
  const bodyGrad = ctx.createLinearGradient(0, yBase, 0, yTop);
  bodyGrad.addColorStop(0, rgba(body, a * 0.46));
  bodyGrad.addColorStop(1, rgba(body, a * 0.78));
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x, Math.min(yBase, yTop), w, h);

  // Brighter top edge.
  const lw = Math.max(0.9, h * 0.05);
  ctx.fillStyle = rgba(edge, Math.min(1, a * (el.warm ? 1.25 : 1.05)));
  ctx.fillRect(x, yTop - (up < 0 ? 0 : lw), w, lw);

  // Soft glow spilling off the top edge.
  const glowH = Math.max(3, h * 0.55);
  const glow = ctx.createLinearGradient(0, yTop, 0, yTop + up * glowH);
  glow.addColorStop(0, rgba(edge, a * 0.42));
  glow.addColorStop(1, rgba(edge, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(
    x - w * 0.12,
    up < 0 ? yTop - glowH : yTop,
    w * 1.24,
    glowH,
  );
};

/**
 * Blocks are generated cluster by cluster: each cluster shares a lane centre,
 * a depth phase and a traversal rate, so it moves as a group and leaves gaps
 * between it and the next.
 */
export const makeBlockElements = (
  count: number,
  seed: string,
  /** Fraction of the field mirrored onto the ceiling, dimmer. */
  ceilingShare = 0.82,
): BlockElement[] => {
  const out: BlockElement[] = [];
  const clusters = Math.max(6, Math.round(count / 4));
  let made = 0;
  for (let c = 0; c < clusters && made < count; c++) {
    const cs = `${seed}-cluster-${c}`;
    const laneCentre = randRange(`${cs}-lc`, -1, 1);
    const laneSpan = randRange(`${cs}-ls`, 0.03, 0.2);
    const d0 = randRange(`${cs}-d0`, 0, 1);
    const cycles = randInt(`${cs}-cy`, 1, 2);
    const members = randInt(`${cs}-n`, 2, 7);

    for (let i = 0; i < members && made < count; i++, made++) {
      const s = `${cs}-b${i}`;
      const lane = laneCentre + randRange(`${s}-lj`, -1, 1) * laneSpan;
      const warm = randChance(`${s}-wm`, 0.06);
      const el: BlockElement = {
        seed: s,
        lane,
        plane: "floor" as Plane,
        // A small depth jitter inside the cluster so it has thickness.
        d0: (d0 + randRange(`${s}-dj`, -0.02, 0.02) + 1) % 1,
        cycles,
        // Narrow and tall: these stand up, they are not slabs on their side.
        laneW: randRange(`${s}-lw`, 0.005, 0.024),
        heightUnit: randRange(`${s}-h`, 0.05, 0.3) * randRange(`${s}-h2`, 0.55, 1.4),
        warm,
        lit: randChance(`${s}-lt`, 0.24),
        alpha: randRange(`${s}-a`, 0.55, 1),
        phase: randRange(`${s}-ph`, 0, 1),
        flicker: randChance(`${s}-fk`, 0.3) ? randRange(`${s}-fa`, 0.1, 0.4) : 0,
      };
      out.push(el);

      // The mirrored ceiling field: the same block, dimmer and shorter.
      if (randChance(`${s}-mir`, ceilingShare)) {
        out.push({
          ...el,
          seed: `${s}-ceil`,
          plane: "ceiling",
          heightUnit: el.heightUnit * randRange(`${s}-mh`, 0.5, 0.9),
          alpha: el.alpha * 0.42,
          warm: el.warm && randChance(`${s}-mw`, 0.5),
        });
      }
    }
  }
  return out;
};

export interface BlockClusterProps {
  order: number;
  count: number;
  seed: string;
}

export const BlockCluster: React.FC<BlockClusterProps> = ({ order, count, seed }) => {
  const elements = useMemo(() => makeBlockElements(count, seed), [count, seed]);
  useCorridorGroup<BlockElement>({
    id: "block-clusters",
    order,
    elements,
    render: renderBlockCluster,
    blend: "lighter",
    fadeIn: 0.14,
  });
  return null;
};
