import type { PanelSpec } from "../layout";
import { alpha, both, type DrawArgs } from "../paint";
import { LOOP, rRange } from "../rand";
import { panelBody } from "./PanelChrome";

/**
 * A jagged line across a faint grid with node dots at the vertices. The trace
 * scrolls horizontally; the underlying series is periodic over `nodes *
 * density` samples and the scroll advances exactly that many samples across the
 * 900-frame loop, so it tiles perfectly and closes on itself.
 */

const seriesValue = (spec: PanelSpec, index: number, period: number) => {
  const i = ((index % period) + period) % period;
  return rRange(`${spec.id}/pt${i}`, 0.1, 0.92);
};

export const drawLineTraceStatic = (a: DrawArgs, spec: PanelSpec) => {
  const body = panelBody(spec);
  const c = a.p.ctx;
  const pal = a.v.palette;

  c.strokeStyle = alpha(pal.panelBorder, 0.18);
  c.lineWidth = 1;
  const rows = 4;
  const cols = Math.max(6, Math.round(body.w / 120));
  for (let i = 1; i < rows; i++) {
    const y = body.y + (body.h * i) / rows;
    c.beginPath();
    c.moveTo(body.x, y);
    c.lineTo(body.x + body.w, y);
    c.stroke();
  }
  for (let i = 1; i < cols; i++) {
    const x = body.x + (body.w * i) / cols;
    c.beginPath();
    c.moveTo(x, body.y);
    c.lineTo(x, body.y + body.h);
    c.stroke();
  }
  c.strokeStyle = alpha(pal.panelBorder, 0.5);
  c.lineWidth = 1.5;
  c.strokeRect(body.x, body.y, body.w, body.h);
};

export const drawLineTrace = (a: DrawArgs, spec: PanelSpec) => {
  const body = panelBody(spec);
  const pal = a.v.palette;
  const nodes = spec.opts?.nodes ?? 28;
  const density = spec.opts?.density ?? 2;
  const period = nodes * density;
  const spacing = body.w / (nodes - 1);

  // Scroll exactly `period` samples over the loop.
  const offset = (a.frame / LOOP) * period;
  const base = Math.floor(offset);
  const frac = offset - base;

  const pts: [number, number][] = [];
  for (let k = -1; k <= nodes + 1; k++) {
    const x = body.x + (k - frac) * spacing;
    const y = body.y + body.h * (1 - seriesValue(spec, base + k, period));
    pts.push([x, y]);
  }

  const c = a.p.ctx;
  c.save();
  c.beginPath();
  c.rect(body.x, body.y, body.w, body.h);
  c.clip();

  if (spec.opts?.filled) {
    c.beginPath();
    c.moveTo(pts[0][0], body.y + body.h);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(pts[pts.length - 1][0], body.y + body.h);
    c.closePath();
    c.fillStyle = alpha(pal.trace, 0.14);
    c.fill();
  }

  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) c.lineTo(x, y);
  c.strokeStyle = alpha(pal.trace, 0.95);
  c.lineWidth = 2.5;
  c.lineJoin = "round";
  c.stroke();
  c.restore();

  // Node dots at the vertices, in the accent colour so they carry the bloom.
  both(a.p, (g) => {
    g.save();
    g.beginPath();
    g.rect(body.x, body.y, body.w, body.h);
    g.clip();
    g.fillStyle = alpha(pal.accent, 0.95);
    for (const [x, y] of pts) {
      g.beginPath();
      g.arc(x, y, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }, 0.45);
};
