import type { PanelSpec } from "../layout";
import { alpha, both, mono, sans, type DrawArgs } from "../paint";
import { cycle, rInt, rPick } from "../rand";
import { panelBody } from "./PanelChrome";

/**
 * A horizontal bar with a fill and a percentage. Fills and resets on a cycle
 * that divides 900.
 */

const STRIP_PERIODS = [150, 180, 225, 300];

type Strip = { x: number; y: number; w: number; h: number; period: number; phase: number; seed: string };

const stripCache = new Map<string, Strip[]>();

const stripsFor = (spec: PanelSpec): Strip[] => {
  const cached = stripCache.get(spec.id);
  if (cached) return cached;
  const body = panelBody(spec);
  const n = spec.opts?.cells ?? 3;
  const gap = 10;
  const h = Math.min(34, (body.h - gap * (n - 1)) / n);
  const out: Strip[] = [];
  for (let i = 0; i < n; i++) {
    const seed = `${spec.id}/st${i}`;
    const period = rPick(`${seed}/p`, STRIP_PERIODS);
    out.push({
      x: body.x + 62,
      y: body.y + i * ((body.h - h) / Math.max(1, n - 1) || 0),
      w: body.w - 62 - 78,
      h,
      period,
      phase: rInt(`${seed}/ph`, 0, period),
      seed,
    });
  }
  stripCache.set(spec.id, out);
  return out;
};

export const drawProgressStripStatic = (a: DrawArgs, spec: PanelSpec) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  for (const s of stripsFor(spec)) {
    c.fillStyle = alpha(pal.panelBorder, 0.14);
    c.fillRect(s.x, s.y, s.w, s.h);
    c.strokeStyle = alpha(pal.panelBorder, 0.6);
    c.lineWidth = 1.5;
    c.strokeRect(s.x, s.y, s.w, s.h);
    c.font = sans(a.fonts, Math.min(19, s.h * 0.62), 600);
    c.fillStyle = alpha(pal.textDim, 1);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(`S${rInt(`${s.seed}/id`, 10, 100)}`, s.x - 58, s.y + s.h / 2);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
  }
};

export const drawProgressStrip = (a: DrawArgs, spec: PanelSpec) => {
  const pal = a.v.palette;
  for (const s of stripsFor(spec)) {
    const cy = cycle(a.frame, s.period, s.phase);
    const fill = cy.t;
    both(a.p, (c) => {
      c.fillStyle = alpha(pal.accent, 0.75);
      c.fillRect(s.x + 2, s.y + 2, Math.max(0, (s.w - 4) * fill), s.h - 4);
    }, 0.3);
    const c = a.p.ctx;
    c.font = mono(a.fonts, Math.min(22, s.h * 0.7), 500);
    c.fillStyle = alpha(pal.textPale, 0.95);
    c.textAlign = "right";
    c.textBaseline = "middle";
    c.fillText(`${Math.round(fill * 100)}%`, s.x + s.w + 68, s.y + s.h / 2);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
  }
};
