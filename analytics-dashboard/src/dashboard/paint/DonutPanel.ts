/**
 * DonutPanel — the animated ring in the right column. The segments sweep out of
 * 12 o'clock on the shared progress, so the donut fills at exactly the pace the
 * lines extend and the counters climb. The accent colour carries the majority
 * segment, as specified.
 */

import { DONUT_SEGMENTS } from "../data";
import { donutCentre, segmentColor } from "./ScreenChrome";
import { drawTabular, withAlpha, type DashboardLayer } from "./utils";

const START_ANGLE = -Math.PI / 2;
const FULL = Math.PI * 2;

export const DonutPanel: DashboardLayer = {
  name: "DonutPanel",
  paint: (env) => {
    const { ctx, palette, anim, fontFamily } = env;
    const { cx, cy, radius, thickness } = donutCentre();
    const swept = anim.donutSweep;
    if (swept <= 0) return;

    ctx.save();
    ctx.lineWidth = thickness;
    ctx.lineCap = "butt";

    let consumed = 0;
    for (const segment of DONUT_SEGMENTS) {
      // How much of THIS segment the shared sweep has reached.
      const local = Math.min(1, Math.max(0, (swept - consumed) / segment.share));
      if (local > 0) {
        const from = START_ANGLE + consumed * FULL;
        const to = from + segment.share * local * FULL;
        ctx.strokeStyle = segmentColor(palette, segment.tone);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, from, to);
        ctx.stroke();
      }
      consumed += segment.share;
    }
    ctx.restore();

    // Percentages sit outside the ring at each segment's midpoint, counting up
    // with the sweep so the labels agree with the geometry at every frame.
    consumed = 0;
    for (const segment of DONUT_SEGMENTS) {
      const local = Math.min(1, Math.max(0, (swept - consumed) / segment.share));
      if (local > 0.02) {
        const mid = START_ANGLE + (consumed + (segment.share * local) / 2) * FULL;
        const lx = cx + Math.cos(mid) * (radius + thickness * 1.25);
        const ly = cy + Math.sin(mid) * (radius + thickness * 1.25);
        drawTabular(ctx, `${(segment.share * local * 100).toFixed(1)}%`, lx, ly, {
          size: 34,
          weight: 700,
          color: withAlpha(palette.seriesWhite, 0.55 + local * 0.45),
          align: "center",
          baseline: "middle",
          family: fontFamily,
        });
      }
      consumed += segment.share;
    }
  },
};
