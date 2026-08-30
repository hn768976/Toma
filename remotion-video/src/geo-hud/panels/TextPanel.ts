import type { PanelSpec } from "../layout";
import { alpha, both, mono, type DrawArgs } from "../paint";
import { cycle, rChance, rInt, rPick } from "../rand";
import { logLine } from "../vocab";
import { panelBody } from "./PanelChrome";

/**
 * Blocks of small, deliberately illegible monospace lines - texture, not data.
 * Every token is invented (see vocab.ts). Most lines are static and live in the
 * blitted chrome layer; a few reroll on staggered cycles, and a highlight bar
 * sweeps down the block.
 */

const LINE_PERIODS = [60, 75, 90, 150, 180];

type Line = { x: number; y: number; size: number; chars: number; live: boolean; seed: string };

const lineCache = new Map<string, Line[]>();

const linesFor = (spec: PanelSpec): Line[] => {
  const cached = lineCache.get(spec.id);
  if (cached) return cached;
  const body = panelBody(spec);
  const n = spec.opts?.lines ?? 10;
  const lh = body.h / n;
  const size = Math.min(19, lh * 0.68);
  const chars = Math.floor(body.w / (size * 0.62));
  const out: Line[] = [];
  for (let i = 0; i < n; i++) {
    const seed = `${spec.id}/ln${i}`;
    out.push({
      x: body.x,
      y: body.y + lh * i + lh * 0.5,
      size,
      chars: Math.max(6, Math.floor(chars * (0.55 + 0.45 * rInt(`${seed}/w`, 3, 11) / 10))),
      live: rChance(`${seed}/live`, 0.28),
      seed,
    });
  }
  lineCache.set(spec.id, out);
  return out;
};

export const drawTextPanelStatic = (a: DrawArgs, spec: PanelSpec) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  c.textAlign = "left";
  c.textBaseline = "middle";
  for (const ln of linesFor(spec)) {
    if (ln.live) continue;
    c.font = mono(a.fonts, ln.size, 400);
    c.fillStyle = alpha(pal.textDim, rChance(`${ln.seed}/hot`, 0.18) ? 1 : 0.62);
    c.fillText(logLine(`${ln.seed}/s`, a.v.domain, ln.chars), ln.x, ln.y);
  }
  c.textBaseline = "alphabetic";
};

export const drawTextPanel = (a: DrawArgs, spec: PanelSpec) => {
  const pal = a.v.palette;
  const body = panelBody(spec);
  const c = a.p.ctx;
  c.textAlign = "left";
  c.textBaseline = "middle";

  for (const ln of linesFor(spec)) {
    if (!ln.live) continue;
    const period = rPick(`${ln.seed}/p`, LINE_PERIODS);
    const phase = rInt(`${ln.seed}/ph`, 0, period);
    const cy = cycle(a.frame, period, phase);
    c.font = mono(a.fonts, ln.size, 400);
    c.fillStyle = alpha(pal.textPale, 0.78);
    c.fillText(logLine(`${ln.seed}:${cy.epoch}`, a.v.domain, ln.chars), ln.x, ln.y);
  }

  // A highlight bar sweeping down the block.
  const sweep = cycle(a.frame, 300, rInt(`${spec.id}/sw`, 0, 300));
  const lines = linesFor(spec);
  const idx = Math.floor(sweep.t * lines.length) % lines.length;
  const target = lines[idx];
  const lh = body.h / lines.length;
  c.fillStyle = alpha(pal.panelFill, 1);
  c.fillRect(body.x - 6, target.y - lh * 0.45, body.w + 12, lh * 0.9);
  both(
    a.p,
    (g) => {
      g.fillStyle = alpha(pal.accent, 0.18);
      g.fillRect(body.x - 6, target.y - lh * 0.45, body.w + 12, lh * 0.9);
    },
    0.35,
  );
  c.font = mono(a.fonts, target.size, 500);
  c.fillStyle = alpha(pal.textPale, 1);
  c.fillText(logLine(`${target.seed}:hi:${sweep.epoch}`, a.v.domain, target.chars), target.x, target.y);
  c.textBaseline = "alphabetic";
};
