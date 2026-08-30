import type { PanelSpec } from "../layout";
import { alpha, both, mono, sans, type DrawArgs } from "../paint";
import { cycle, rInt, rPick } from "../rand";
import { labelsFor, readoutValue } from "../vocab";
import { panelBody } from "./PanelChrome";

/**
 * A grid of numeric values with tiny labels, 4-6 columns. Values reroll
 * continuously - each cell has its own period (a divisor of 900) and phase, and
 * the periods are chosen so a panel turns over roughly 5-8 cells per second.
 */

const CELL_PERIODS = [30, 45, 50, 60, 75, 90, 100, 150];

type Cell = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  period: number;
  phase: number;
  seed: string;
};

const cellCache = new Map<string, Cell[]>();

const cellsFor = (a: DrawArgs, spec: PanelSpec): Cell[] => {
  const key = `${spec.id}:${a.v.domain}`;
  const cached = cellCache.get(key);
  if (cached) return cached;

  const body = panelBody(spec);
  const cols = spec.opts?.cols ?? 4;
  const rows = spec.opts?.rows ?? 4;
  const gap = 8;
  const cw = (body.w - gap * (cols - 1)) / cols;
  const ch = (body.h - gap * (rows - 1)) / rows;
  const labels = labelsFor(a.v.domain);

  const cells: Cell[] = [];
  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const seed = `${spec.id}/c${cx}x${ry}`;
      const period = rPick(`${seed}/p`, CELL_PERIODS);
      cells.push({
        x: body.x + cx * (cw + gap),
        y: body.y + ry * (ch + gap),
        w: cw,
        h: ch,
        label: rPick(`${seed}/l`, labels),
        period,
        phase: rInt(`${seed}/ph`, 0, period),
        seed,
      });
    }
  }
  cellCache.set(key, cells);
  return cells;
};

export const drawReadoutBlockStatic = (a: DrawArgs, spec: PanelSpec) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  for (const cell of cellsFor(a, spec)) {
    c.fillStyle = alpha(pal.panelBorder, 0.07);
    c.fillRect(cell.x, cell.y, cell.w, cell.h);
    c.fillStyle = alpha(pal.accent, 0.55);
    c.fillRect(cell.x, cell.y, 3, cell.h);

    c.font = sans(a.fonts, Math.min(17, cell.h * 0.24), 600);
    c.fillStyle = alpha(pal.textDim, 1);
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText(cell.label, cell.x + 10, cell.y + 6);
  }
};

export const drawReadoutBlock = (a: DrawArgs, spec: PanelSpec) => {
  const pal = a.v.palette;
  const cells = cellsFor(a, spec);
  for (const cell of cells) {
    const cy = cycle(a.frame, cell.period, cell.phase);
    const value = readoutValue(`${cell.seed}:${cy.epoch}`);
    // A brief brighten on the frames right after a reroll.
    const fresh = cy.local < 4 ? 1 - cy.local / 4 : 0;
    const size = Math.min(38, cell.h * 0.46);

    a.p.ctx.font = mono(a.fonts, size, 500);
    a.p.ctx.textAlign = "right";
    a.p.ctx.textBaseline = "alphabetic";
    a.p.ctx.fillStyle = alpha(pal.textPale, 0.82 + 0.18 * fresh);
    a.p.ctx.fillText(value, cell.x + cell.w - 10, cell.y + cell.h - 10);

    if (fresh > 0.01) {
      both(a.p, (c) => {
        c.font = mono(a.fonts, size, 500);
        c.textAlign = "right";
        c.textBaseline = "alphabetic";
        c.fillStyle = alpha(pal.accent, 0.55 * fresh);
        c.fillText(value, cell.x + cell.w - 10, cell.y + cell.h - 10);
      }, 0.7);
    }
  }
  a.p.ctx.textAlign = "left";
};
