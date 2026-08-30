import type { PanelSpec } from "../layout";
import { alpha, both, type DrawArgs } from "../paint";
import { cycle, rInt, rPick, rRange, smooth } from "../rand";
import { panelBody } from "./PanelChrome";

/**
 * Vertical bars of varying height with a baseline. Each bar shifts on its own
 * staggered cycle and eases between the old and new height, so the chart
 * ripples rather than snapping as a block.
 */

const BAR_PERIODS = [45, 60, 75, 90, 100, 150];

export const drawBarChartStatic = (a: DrawArgs, spec: PanelSpec) => {
  const body = panelBody(spec);
  const c = a.p.ctx;
  const pal = a.v.palette;

  // Baseline plus faint gridlines behind the bars.
  c.strokeStyle = alpha(pal.panelBorder, 0.22);
  c.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = body.y + (body.h * i) / 4;
    c.beginPath();
    c.moveTo(body.x, y);
    c.lineTo(body.x + body.w, y);
    c.stroke();
  }
  c.strokeStyle = alpha(pal.panelBorder, 0.9);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(body.x, body.y + body.h);
  c.lineTo(body.x + body.w, body.y + body.h);
  c.stroke();
};

export const drawBarChart = (a: DrawArgs, spec: PanelSpec) => {
  const body = panelBody(spec);
  const pal = a.v.palette;
  const n = spec.opts?.bars ?? 18;
  const gap = Math.max(2, body.w / n / 5);
  const bw = (body.w - gap * (n - 1)) / n;

  for (let i = 0; i < n; i++) {
    const seed = `${spec.id}/bar${i}`;
    const period = rPick(`${seed}/p`, BAR_PERIODS);
    const phase = rInt(`${seed}/ph`, 0, period);
    const cy = cycle(a.frame, period, phase);
    const prev = rRange(`${seed}:${cy.epoch === 0 ? 900 / period - 1 : cy.epoch - 1}`, 0.08, 1);
    const next = rRange(`${seed}:${cy.epoch}`, 0.08, 1);
    const h = (prev + (next - prev) * smooth(Math.min(1, cy.t * 3))) * body.h;

    const x = body.x + i * (bw + gap);
    const y = body.y + body.h - h;

    a.p.ctx.fillStyle = alpha(pal.trace, 0.55);
    a.p.ctx.fillRect(x, y, bw, h);

    // Bright cap on the tallest few bars, which also feeds the bloom pass.
    if (next > 0.72) {
      both(a.p, (c) => {
        c.fillStyle = alpha(pal.accent, 0.95);
        c.fillRect(x, y, bw, Math.min(5, h));
      }, 0.6);
    } else {
      a.p.ctx.fillStyle = alpha(pal.textPale, 0.55);
      a.p.ctx.fillRect(x, y, bw, Math.min(3, h));
    }
  }
};
