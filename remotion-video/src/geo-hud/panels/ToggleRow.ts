import type { PanelSpec } from "../layout";
import { alpha, both, type DrawArgs } from "../paint";
import { cycle, rChance, rInt, rPick } from "../rand";
import { panelBody } from "./PanelChrome";

/**
 * A grid of small square indicators, some lit. Each square blinks on its own
 * period and duty cycle, so the pattern reads as irregular while remaining a
 * pure function of the frame number.
 */

const TOGGLE_PERIODS = [30, 45, 50, 60, 75, 90, 100, 150, 180];

type Toggle = { x: number; y: number; s: number; period: number; phase: number; duty: number; seed: string };

const toggleCache = new Map<string, Toggle[]>();

const togglesFor = (spec: PanelSpec): Toggle[] => {
  const cached = toggleCache.get(spec.id);
  if (cached) return cached;
  const body = panelBody(spec);
  const cols = spec.opts?.cols ?? 12;
  const rows = spec.opts?.rows ?? 2;
  const gap = 7;
  // Cap the square size so a tall panel does not turn a row of indicators into
  // a wall of glowing blocks.
  const s = Math.min(
    34,
    (body.w - gap * (cols - 1)) / cols,
    (body.h - gap * (rows - 1)) / rows,
  );
  const gridH = rows * s + gap * (rows - 1);
  const top = body.y + (body.h - gridH) / 2;
  const out: Toggle[] = [];
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const seed = `${spec.id}/tg${cx}x${ry}`;
      const period = rPick(`${seed}/p`, TOGGLE_PERIODS);
      out.push({
        x: body.x + cx * (s + gap),
        y: top + ry * (s + gap),
        s,
        period,
        phase: rInt(`${seed}/ph`, 0, period),
        duty: 0.25 + rInt(`${seed}/d`, 0, 5) * 0.12,
        seed,
      });
    }
  }
  toggleCache.set(spec.id, out);
  return out;
};

export const drawToggleRowStatic = (a: DrawArgs, spec: PanelSpec) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  for (const t of togglesFor(spec)) {
    c.fillStyle = alpha(pal.panelBorder, 0.12);
    c.fillRect(t.x, t.y, t.s, t.s);
    c.strokeStyle = alpha(pal.panelBorder, 0.55);
    c.lineWidth = 1.5;
    c.strokeRect(t.x + 0.75, t.y + 0.75, t.s - 1.5, t.s - 1.5);
  }
};

export const drawToggleRow = (a: DrawArgs, spec: PanelSpec) => {
  const pal = a.v.palette;
  for (const t of togglesFor(spec)) {
    const cy = cycle(a.frame, t.period, t.phase);
    const lit = cy.t < t.duty;
    if (!lit) continue;
    const hot = rChance(`${t.seed}:${cy.epoch}`, 0.35);
    both(
      a.p,
      (c) => {
        c.fillStyle = alpha(hot ? pal.accent : pal.trace, hot ? 0.9 : 0.55);
        c.fillRect(t.x + 2, t.y + 2, t.s - 4, t.s - 4);
      },
      0.3,
    );
  }
};
