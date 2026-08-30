import type { PanelSpec } from "../layout";
import { alpha, both, clippedRectPath, sans, tracked, type DrawArgs } from "../paint";

/**
 * A short label in a filled accent bar - the one piece of fully legible text on
 * the dashboard. Sits above the map.
 */
export const drawTitlePlate = (a: DrawArgs, spec: PanelSpec, text: string) => {
  const pal = a.v.palette;

  both(a.p, (c) => {
    clippedRectPath(c, spec.x, spec.y, spec.w, spec.h, 18);
    c.fillStyle = alpha(pal.accent, 0.22);
    c.fill();
    c.strokeStyle = alpha(pal.accent, 0.95);
    c.lineWidth = 2.5;
    c.stroke();

    c.font = sans(a.fonts, spec.h * 0.5, 600);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = alpha(pal.textPale, 1);
    tracked(c, text, spec.x + spec.w / 2, spec.y + spec.h / 2 + 1, 10);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
  }, 0.45);

  // Flanking rules.
  const c = a.p.ctx;
  c.strokeStyle = alpha(pal.accent, 0.5);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(spec.x - 120, spec.y + spec.h / 2);
  c.lineTo(spec.x - 14, spec.y + spec.h / 2);
  c.moveTo(spec.x + spec.w + 14, spec.y + spec.h / 2);
  c.lineTo(spec.x + spec.w + 120, spec.y + spec.h / 2);
  c.stroke();
};
