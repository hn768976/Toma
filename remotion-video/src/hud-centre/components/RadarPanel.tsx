import React, { useMemo } from "react";
import { Panel } from "./Panel";
import type { Rect } from "../layout";
import { PALETTE, withAlpha } from "../palette";
import { DASH_RADAR_PERIOD } from "../timing";
import { sansFont } from "../fonts";
import { smallCaps } from "@lib/draw/panel-chrome";
import { tickRing } from "@lib/draw/shapes";
import { type RadarColors, drawRadarContacts, drawRadarGrid, drawRadarSweep, makeContacts } from "@lib/scopes/radar-scope";

const COLORS: RadarColors = {
  grid: PALETTE.elementDim,
  gridFaint: withAlpha(PALETTE.elementDim, 0.45),
  sweep: PALETTE.elementCyan,
  trail: PALETTE.elementCyan,
  contact: PALETTE.accentAmber,
  contactHot: PALETTE.textBright,
};

export type RadarPanelProps = {
  rect: Rect;
  index: number;
  panelCount: number;
  frame: number;
  label: string;
  seed: string;
};

/** Bottom-left scope: a polar grid with a slowly rotating sweep wedge and
 *  contacts that light as it crosses them. Two turns across the loop. */
export const RadarPanel: React.FC<RadarPanelProps> = ({
  rect,
  index,
  panelCount,
  frame,
  label,
  seed,
}) => {
  const contacts = useMemo(() => makeContacts(seed, 9, 40, 240), [seed]);

  const centre = (inner: Rect) => ({
    cx: inner.x + inner.w / 2,
    cy: inner.y + inner.h / 2,
    radius: Math.min(inner.w, inner.h) / 2 - 34,
  });

  const drawStatic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { cx, cy, radius } = centre(inner);
    drawRadarGrid(ctx, {
      cx,
      cy,
      radius,
      rings: 4,
      spokeStep: 30,
      colors: COLORS,
      lineWidth: 2,
      denseSector: null,
    });
    tickRing(ctx, {
      cx,
      cy,
      radius: radius + 6,
      count: 72,
      length: 7,
      width: 1.5,
      color: withAlpha(PALETTE.elementDim, 0.8),
      majorEvery: 6,
      majorLength: 15,
      majorColor: withAlpha(PALETTE.textPale, 0.8),
      majorWidth: 2,
    });
    for (const [deg, txt] of [
      [0, "090"],
      [90, "180"],
      [180, "270"],
      [270, "000"],
    ] as const) {
      const a = (deg * Math.PI) / 180;
      smallCaps(ctx, txt, cx + Math.cos(a) * (radius + 26), cy + Math.sin(a) * (radius + 26), {
        font: sansFont(500, 19),
        color: withAlpha(PALETTE.textPale, 0.8),
        align: "center",
      });
    }
  };

  const drawDynamic = (ctx: CanvasRenderingContext2D, inner: Rect) => {
    const { cx, cy, radius } = centre(inner);
    const opts = {
      cx,
      cy,
      radius,
      frame,
      period: DASH_RADAR_PERIOD,
      rings: 4,
      spokeStep: 30,
      wedgeSpan: (34 * Math.PI) / 180,
      colors: COLORS,
      contacts,
      contactDecay: 45,
      contactRadius: 7,
      wedgeAlpha: 0.62,
      trailAlpha: 0.18,
    };
    drawRadarSweep(ctx, opts);
    drawRadarContacts(ctx, opts);
  };

  return (
    <Panel
      rect={rect}
      index={index}
      panelCount={panelCount}
      frame={frame}
      label={label}
      drawStatic={drawStatic}
      drawDynamic={drawDynamic}
    />
  );
};
