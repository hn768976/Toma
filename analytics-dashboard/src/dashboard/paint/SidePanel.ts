/**
 * SidePanel — the animated content of the right column below the donut: the
 * two stacked label-row panels, and the highlighted regions on the world map.
 *
 * The static parts of all three (titles, row labels, empty tracks, the low
 * contrast dot map) live in ScreenChrome; only the growing fills and the
 * highlights are redrawn per frame, and both read the shared progress.
 */

import { LAYOUT, type Rect } from "../layout";
import { MAP_HIGHLIGHTS, SIDE_PANELS } from "../data";
import { mapArea, sideRowRect } from "./ScreenChrome";
import { drawText, roundRectPath, withAlpha, type DashboardLayer } from "./utils";

export const SidePanel: DashboardLayer = {
  name: "SidePanel",
  paint: (env) => {
    const { ctx, palette, anim, fontFamily } = env;
    const shells: Rect[] = [LAYOUT.sideA, LAYOUT.sideB];

    SIDE_PANELS.forEach((spec, panelIndex) => {
      const shell = shells[panelIndex];
      spec.rows.forEach((row, rowIndex) => {
        const track = sideRowRect(shell, rowIndex);
        const width = track.w * row.fill * anim.progress;
        if (width <= 1) return;
        roundRectPath(ctx, { ...track, w: width }, track.h / 2);
        ctx.fillStyle = rowIndex === 0 ? palette.seriesMagenta : palette.seriesBlue;
        ctx.fill();
      });
    });

    // Map highlights: a filled dot plus an expanding ring per region.
    const area = mapArea();
    MAP_HIGHLIGHTS.forEach((region, i) => {
      const x = area.x + region.x * area.w;
      const y = area.y + region.y * area.h;
      const stagger = Math.min(1, Math.max(0, anim.progress * 3 - i * 0.6));
      if (stagger <= 0) return;

      ctx.fillStyle = withAlpha(palette.seriesMagenta, 0.9 * stagger);
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = withAlpha(palette.seriesMagenta, 0.35 * stagger);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 9 + 26 * stagger, 0, Math.PI * 2);
      ctx.stroke();

      drawText(ctx, region.label, x + 44, y, {
        size: 26,
        weight: 700,
        color: withAlpha(palette.seriesWhite, 0.8 * stagger),
        baseline: "middle",
        family: fontFamily,
        letterSpacing: 1.5,
      });
    });
  },
};
